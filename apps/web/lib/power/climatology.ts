import { prisma, type Prisma } from '@orbitstreet/database';
import { POWER_SOURCE } from './power-api';

/**
 * Climatología NASA POWER (normales mensuales de temperatura).
 * Endpoint: /api/temporal/climatology/point — promedio del periodo
 * climatológico (climatology = estadísticas de largo plazo de MERRA-2).
 *
 * La usa el nodo ESP32 como LÍNEA BASE para calcular anomalías offline
 * (temperatura medida − normal del mes), incluso sin conexión.
 *
 * Caché: tabla PowerCache con temporal='climatology' (rango dummy fijo
 * 20000101-20001231: las normales cambian a escala de años, no de días).
 */

const POWER_CLIMATOLOGY_URL =
  'https://power.larc.nasa.gov/api/temporal/climatology/point';

/** Claves de mes que devuelve la API, en orden calendario. */
export const MONTH_KEYS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
] as const;

export interface MonthlyNormals {
  /** 12 normales en orden calendario (índice 0 = enero). */
  months: number[];
  unit: string;
  source: string;
  cached: boolean;
}

export function buildPowerClimatologyUrl(
  latitude: number,
  longitude: number,
  parameter: string
): string {
  return (
    `${POWER_CLIMATOLOGY_URL}?parameters=${parameter}` +
    `&community=RE&longitude=${longitude}&latitude=${latitude}&format=JSON`
  );
}

/** Parsea la respuesta de climatología: { T2M: { JAN: v, ..., ANN: v } }. */
export function parsePowerClimatology(
  json: unknown,
  parameter: string
): number[] {
  const obj = json as {
    properties?: { parameter?: Record<string, Record<string, number>> };
  };
  const series = obj.properties?.parameter?.[parameter];
  if (!series) {
    throw new Error(`POWER: parámetro de climatología ausente (${parameter})`);
  }

  const months: number[] = [];
  for (const key of MONTH_KEYS) {
    const value = Number(series[key]);
    // El relleno -999 indica dato faltante: se omite, nunca se inventa.
    if (!Number.isFinite(value) || value === -999) {
      throw new Error(`POWER: normal mensual ausente (${key})`);
    }
    months.push(value);
  }
  return months;
}

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normales mensuales con caché en PostgreSQL.
 * Devuelve 12 valores en °C (índice 0 = enero).
 */
export async function getMonthlyTemperatureNormals(
  latitude: number,
  longitude: number
): Promise<MonthlyNormals> {
  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);

  // Rango dummy fijo como clave de caché para climatología.
  const cacheStart = new Date(Date.UTC(2000, 0, 1));
  const cacheEnd = new Date(Date.UTC(2000, 11, 31));

  const existing = await prisma.powerCache.findUnique({
    where: {
      latitude_longitude_parameter_temporal_start_end: {
        latitude: lat,
        longitude: lon,
        parameter: 'T2M',
        temporal: 'climatology',
        start: cacheStart,
        end: cacheEnd
      }
    }
  });

  if (existing) {
    const months = (existing.dataJson as unknown as { months?: number[] })
      ?.months;
    if (Array.isArray(months) && months.length === 12) {
      return { months, unit: '°C', source: POWER_SOURCE, cached: true };
    }
  }

  const response = await fetch(
    buildPowerClimatologyUrl(lat, lon, 'T2M'),
    { headers: { accept: 'application/json' } }
  );
  if (!response.ok) {
    throw new Error(`POWER climatología respondió ${response.status}`);
  }

  const json: unknown = await response.json();
  const months = parsePowerClimatology(json, 'T2M');

  await prisma.powerCache.create({
    data: {
      latitude: lat,
      longitude: lon,
      parameter: 'T2M',
      temporal: 'climatology',
      start: cacheStart,
      end: cacheEnd,
      dataJson: { months } as unknown as Prisma.InputJsonValue
    }
  });

  return { months, unit: '°C', source: POWER_SOURCE, cached: false };
}
