import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';
import { checkUploadCooldown, DEFAULT_UPLOAD_COOLDOWN_MINUTES } from '@/lib/upload/cooldown';
import {
  OBSERVABLE_VARIABLES,
  unitOf,
  withinPhysicalBounds
} from '@/lib/observations/plausibility';
import {
  OBSERVATION_GOAL,
  crossCheckWithCell,
  type NasaCheck
} from '@/lib/observations/cross-check';
import { parseCoordinate } from '@/lib/parse-coord';

/**
 * Observaciones comunitarias puntuales con evidencia (foto o manual).
 *
 * GET  /api/observations — progreso propio (requiere sesión).
 * POST /api/observations — guarda una observación (requiere sesión):
 *  1. Validación física + whitelist en código (nada de entrada libre).
 *  2. Cooldown compartido con las series comunitarias (anti-abuso).
 *  3. Cross-check determinista contra la celda MERRA-2 de ese día:
 *     el veredicto lo calcula código, nunca la IA.
 *  4. Escritura vía Prisma (sin SQL injection). La imagen NUNCA llega aquí.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCATION_SOURCES = ['EXIF', 'GPS', 'MAP'] as const;
const INPUT_MODES = ['PHOTO', 'MANUAL'] as const;

function badRequest(errorCode: string) {
  return NextResponse.json({ errorCode }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  const [count, observations] = await Promise.all([
    prisma.observation.count({ where: { userId: user.id } }),
    prisma.observation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        variable: true,
        value: true,
        unit: true,
        observedAt: true,
        latitude: true,
        longitude: true,
        locationSource: true,
        inputMode: true,
        nasaCheckJson: true
      }
    })
  ]);

  return NextResponse.json({
    count,
    goal: OBSERVATION_GOAL,
    observations
  });
}

export async function POST(request: NextRequest) {
  // 1. Autenticación: subir observaciones exige cuenta (anti-bots).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('invalid_format');
  }
  const input = body as Record<string, unknown>;

  // 2. Validación dura (whitelists, rangos físicos, fecha, coords).
  const variable = typeof input.variable === 'string' ? input.variable : '';
  if (!OBSERVABLE_VARIABLES.includes(variable as never)) {
    return badRequest('invalid_variable');
  }

  const value = parseCoordinate(input.value as string | number);
  if (!withinPhysicalBounds(variable, value)) {
    return badRequest('out_of_range');
  }

  const observedAt =
    typeof input.observedAt === 'string' ? input.observedAt : '';
  if (!DATE_RE.test(observedAt)) {
    return badRequest('invalid_date');
  }
  const year = Number(observedAt.slice(0, 4));
  const nowYear = new Date().getUTCFullYear();
  if (year < 1981 || year > nowYear + 1) {
    return badRequest('invalid_date');
  }

  const latitude = parseCoordinate(input.latitude as string | number);
  const longitude = parseCoordinate(input.longitude as string | number);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return badRequest('invalid_coords');
  }

  const locationSource =
    typeof input.locationSource === 'string' ? input.locationSource : '';
  if (!LOCATION_SOURCES.includes(locationSource as never)) {
    return badRequest('invalid_source');
  }

  const inputMode = typeof input.inputMode === 'string' ? input.inputMode : '';
  if (!INPUT_MODES.includes(inputMode as never)) {
    return badRequest('invalid_mode');
  }

  // Extracción IA (solo PHOTO): confianza acotada + descripción saneada.
  let extractionJson: Prisma.InputJsonValue | null = null;
  if (inputMode === 'PHOTO') {
    const extraction = input.extraction as
      | Record<string, unknown>
      | undefined;
    const confidence = Number(extraction?.confidence);
    const description =
      typeof extraction?.description === 'string'
        ? extraction.description.trim().slice(0, 400)
        : '';
    if (
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      description.length < 3
    ) {
      return badRequest('invalid_extraction');
    }
    extractionJson = { engine: 'gemini', confidence, description };
  }

  // 3. Cooldown compartido con series comunitarias.
  const [lastObservation, lastSeries] = await Promise.all([
    prisma.observation.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.communitySeries.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);
  const lastActivity = [lastObservation?.createdAt, lastSeries?.createdAt]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const cooldown = checkUploadCooldown(
    lastActivity ?? null,
    Number.isFinite(user.uploadCooldownMinutes)
      ? user.uploadCooldownMinutes
      : DEFAULT_UPLOAD_COOLDOWN_MINUTES
  );
  if (!cooldown.allowed) {
    return NextResponse.json(
      {
        errorCode: 'cooldown',
        retryAfterSeconds: cooldown.retryAfterSeconds
      },
      { status: 429 }
    );
  }

  // 4. Cross-check determinista contra la celda MERRA-2 del día.
  let nasaCheck: NasaCheck;
  try {
    nasaCheck = await crossCheckWithCell({
      latitude,
      longitude,
      variable,
      observedAt,
      value
    });
  } catch {
    nasaCheck = {
      cellValue: null,
      bias: null,
      verdict: 'no_reference',
      source: 'sin referencia'
    };
  }

  // 5. Escritura (Prisma). La imagen nunca llegó a este endpoint.
  const created = await prisma.observation.create({
    data: {
      userId: user.id,
      variable,
      value,
      unit: unitOf(variable),
      observedAt: new Date(`${observedAt}T00:00:00Z`),
      latitude,
      longitude,
      locationSource: locationSource as (typeof LOCATION_SOURCES)[number],
      inputMode: inputMode as (typeof INPUT_MODES)[number],
      extractionJson: extractionJson ?? Prisma.JsonNull,
      nasaCheckJson: nasaCheck as unknown as Prisma.InputJsonValue
    }
  });

  const count = await prisma.observation.count({ where: { userId: user.id } });

  return NextResponse.json({
    observation: {
      id: created.id,
      variable: created.variable,
      value: created.value,
      unit: created.unit,
      observedAt: created.observedAt.toISOString().slice(0, 10),
      latitude: created.latitude,
      longitude: created.longitude,
      locationSource: created.locationSource,
      inputMode: created.inputMode
    },
    nasaCheck,
    progress: { count, goal: OBSERVATION_GOAL }
  });
}