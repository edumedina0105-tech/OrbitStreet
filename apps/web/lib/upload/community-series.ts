import { prisma, type Prisma } from '@orbitstreet/database';
import type { Locale, TimePoint, VariableId } from '@orbitstreet/shared-types';
import { analyzeDailySeries, type SeriesAnalysis } from '@/lib/analysis/analyze-series';
import { VARIABLE_CONFIG, VARIABLE_IDS } from '@/lib/analysis/variables';
import { checkUploadCooldown, DEFAULT_UPLOAD_COOLDOWN_MINUTES } from './cooldown';
import { parseSeriesPayload, type ValidationErrorCode, type ValidationResult } from './series-validation';

/**
 * Subida de series comunitarias.
 * Seguridad por capas:
 *  1. Requiere sesión (cuenta con contraseña) → bloquea bots simples.
 *  2. Validación estricta del contenido (formato, rango físico, duplicados).
 *  3. Cooldown por usuario (flexible) → sin subida masiva.
 *  4. Todas las escrituras pasan por Prisma → sin SQL injection.
 */

export interface UploadInput {
  label: string;
  variable: string;
  latitude?: number;
  longitude?: number;
  data: unknown;
  locale?: Locale;
}

export type UploadErrorCode =
  | 'invalid_label'
  | 'invalid_variable'
  | 'invalid_coords'
  | ValidationErrorCode
  | 'cooldown';

export interface UploadResult {
  ok: boolean;
  errorCode?: UploadErrorCode;
  retryAfterSeconds?: number;
  seriesId?: string;
  analysis?: SeriesAnalysis;
}

export async function uploadCommunitySeries(
  userId: string,
  userCooldownMinutes: number,
  input: UploadInput
): Promise<UploadResult> {
  // 1. Etiqueta: 1-80 caracteres.
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (label.length < 1 || label.length > 80) {
    return { ok: false, errorCode: 'invalid_label' };
  }

  // 2. Variable: solo las permitidas (whitelist, nunca entrada libre).
  const variable = input.variable as VariableId;
  if (!VARIABLE_IDS.includes(variable)) {
    return { ok: false, errorCode: 'invalid_variable' };
  }

  // 3. Coordenadas opcionales pero válidas si vienen.
  const hasLat = input.latitude !== undefined && input.latitude !== null;
  const hasLon = input.longitude !== undefined && input.longitude !== null;
  if (hasLat !== hasLon) return { ok: false, errorCode: 'invalid_coords' };
  if (hasLat) {
    const lat = Number(input.latitude);
    const lon = Number(input.longitude);
    if (
      !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180
    ) {
      return { ok: false, errorCode: 'invalid_coords' };
    }
  }

  // 4. Cooldown: consulta la última subida del usuario (índice [userId, createdAt]).
  const lastUpload = await prisma.communitySeries.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });
  const cooldown = checkUploadCooldown(
    lastUpload?.createdAt ?? null,
    Number.isFinite(userCooldownMinutes)
      ? userCooldownMinutes
      : DEFAULT_UPLOAD_COOLDOWN_MINUTES
  );
  if (!cooldown.allowed) {
    return {
      ok: false,
      errorCode: 'cooldown',
      retryAfterSeconds: cooldown.retryAfterSeconds
    };
  }

  // 5. Validación del contenido.
  const validation: ValidationResult = parseSeriesPayload(input.data, variable);
  if (!validation.ok || !validation.points) {
    return { ok: false, errorCode: validation.errorCode as UploadErrorCode };
  }

  // 6. Mismo análisis determinista que a los datos de la NASA.
  const analysis = analyzeDailySeries(validation.points, {
    variable,
    periodStart: validation.points[0]?.date,
    periodEnd: validation.points[validation.points.length - 1]?.date
  });

  // 7. Escritura parametrizada (Prisma).
  const created = await prisma.communitySeries.create({
    data: {
      userId,
      label,
      variable,
      latitude: hasLat ? Number(input.latitude) : null,
      longitude: hasLon ? Number(input.longitude) : null,
      unit: VARIABLE_CONFIG[variable].unit,
      dataJson: validation.points as unknown as Prisma.InputJsonValue,
      analysisJson: {
        trend: analysis.trend,
        sigma: analysis.sigma,
        yearsNeeded: analysis.years
      } as unknown as Prisma.InputJsonValue
    },
    select: { id: true }
  });

  return { ok: true, seriesId: created.id, analysis };
}

/** Listado público de las últimas series comunitarias (solo resumen). */
export async function listRecentCommunitySeries(limit = 20) {
  const rows = await prisma.communitySeries.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 50),
    select: {
      id: true,
      label: true,
      variable: true,
      unit: true,
      createdAt: true,
      user: { select: { displayName: true } },
      analysisJson: true
    }
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    variable: row.variable,
    unit: row.unit,
    createdAt: row.createdAt.toISOString(),
    author: row.user.displayName,
    analysis: row.analysisJson
  }));
}

export type { TimePoint };
