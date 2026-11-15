import { NextRequest, NextResponse } from 'next/server';
import type { PowerParameterId } from '@orbitstreet/shared-types';
import { getDailySeries } from '@/lib/power/service';
import { parseCoordinate } from '@/lib/parse-coord';

/**
 * GET /api/power/daily?lat=-25.26&lon=-57.53&parameter=T2M&start=19810101&end=20251231
 * Devuelve la serie diaria de NASA POWER (con caché en PostgreSQL).
 */

const PARAMETERS: readonly PowerParameterId[] = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'RH2M',
  'PRECTOTCORR',
  'PS'
];

const EARLIEST = '19810101';

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const latitude = parseCoordinate(sp.get('lat'));
  const longitude = parseCoordinate(sp.get('lon'));
  const parameter = (sp.get('parameter') ?? 'T2M') as PowerParameterId;
  const start = sp.get('start') ?? EARLIEST;
  const end = sp.get('end') ?? todayYyyymmdd();

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return badRequest('Parámetro "lat" inválido (se espera -90..90).');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return badRequest('Parámetro "lon" inválido (se espera -180..180).');
  }
  if (!PARAMETERS.includes(parameter)) {
    return badRequest(
      `Parámetro "parameter" inválido. Válidos: ${PARAMETERS.join(', ')}.`
    );
  }
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
    return badRequest('"start" y "end" deben tener formato YYYYMMDD.');
  }
  if (start > end) {
    return badRequest('"start" debe ser menor o igual que "end".');
  }
  if (start < EARLIEST) {
    return badRequest(`POWER diario solo está disponible desde ${EARLIEST}.`);
  }

  try {
    const result = await getDailySeries({
      latitude,
      longitude,
      parameter,
      start,
      end
    });

    return NextResponse.json({
      parameter,
      latitude,
      longitude,
      start,
      end,
      count: result.points.length,
      cached: result.cached,
      source: result.source,
      points: result.points
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `No se pudo obtener la serie de NASA POWER: ${message}` },
      { status: 502 }
    );
  }
}
