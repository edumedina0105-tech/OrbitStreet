import type { PowerParameterId, TimePoint } from '@orbitstreet/shared-types';

/**
 * Cliente de la API de NASA POWER (daily point API).
 * Documentación: https://power.larc.nasa.gov/docs/services/api/
 *
 * Importante para la honestidad científica: POWER es un REANÁLISIS
 * (MERRA-2), no una medición satelital directa. Ver POWER_SOURCE.
 */

const POWER_DAILY_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const FILL_VALUE = -999;
const YEARS_PER_CHUNK = 10;

interface PowerProperties {
  parameter?: Record<string, Record<string, number>>;
}

export const POWER_SOURCE = 'NASA POWER (MERRA-2 reanalysis)';

export interface PowerDailyRequest {
  latitude: number;
  longitude: number;
  parameter: PowerParameterId;
  /** Fecha de inicio, formato YYYYMMDD. */
  start: string;
  /** Fecha de fin, formato YYYYMMDD. */
  end: string;
}

export interface DateRange {
  start: string;
  end: string;
}

/** Construye la URL de la API (separada en función para testearla). */
export function buildPowerDailyUrl(req: PowerDailyRequest): string {
  return (
    `${POWER_DAILY_URL}?parameters=${req.parameter}` +
    `&community=RE&longitude=${req.longitude}&latitude=${req.latitude}` +
    `&start=${req.start}&end=${req.end}&format=JSON`
  );
}

/**
 * Divide el rango YYYYMMDD en bloques de años (por defecto, décadas)
 * para no depender de una única respuesta gigante de la API.
 */
export function splitRange(
  start: string,
  end: string,
  yearsPerChunk = YEARS_PER_CHUNK
): DateRange[] {
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const ranges: DateRange[] = [];

  let year = startYear;
  while (year <= endYear) {
    const chunkEndYear = Math.min(year + yearsPerChunk - 1, endYear);
    ranges.push({
      start: year === startYear ? start : `${year}0101`,
      end: chunkEndYear === endYear ? end : `${chunkEndYear}1231`
    });
    year = chunkEndYear + 1;
  }
  return ranges;
}

/**
 * Parsea la respuesta GeoJSON de POWER a TimePoint[].
 * La API real devuelve un Feature suelto (type: "Feature" con properties
 * en el nivel superior); por robustez también se acepta un FeatureCollection.
 * Descarta el valor de relleno (-999) y ordena por fecha.
 */
export function parsePowerDaily(
  json: unknown,
  parameter: string
): TimePoint[] {
  const obj = json as {
    type?: string;
    features?: Array<{ properties?: PowerProperties }>;
    properties?: PowerProperties;
  };

  // Forma real de la API: Feature suelto. Forma defensiva: FeatureCollection.
  const properties = obj.features?.[0]?.properties ?? obj.properties;

  const series = properties?.parameter?.[parameter];
  if (!series) {
    throw new Error(
      `POWER: formato inesperado de respuesta o parámetro ausente (${parameter})`
    );
  }

  const points: TimePoint[] = [];
  for (const [key, raw] of Object.entries(series)) {
    const value = Number(raw);
    // El relleno -999 indica dato faltante: se omite, nunca se inventa.
    if (!Number.isFinite(value) || value === FILL_VALUE) continue;
    points.push({
      date: `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`,
      value
    });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/** Descarga la serie diaria completa, por bloques de años. */
export async function fetchPowerDaily(
  req: PowerDailyRequest
): Promise<TimePoint[]> {
  const points: TimePoint[] = [];

  for (const range of splitRange(req.start, req.end)) {
    const url = buildPowerDailyUrl({
      ...req,
      start: range.start,
      end: range.end
    });

    const response = await fetch(url, {
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(
        `POWER API respondió ${response.status} para el bloque ${range.start}-${range.end}`
      );
    }

    const json: unknown = await response.json();
    points.push(...parsePowerDaily(json, req.parameter));
  }

  return points;
}
