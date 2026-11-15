import { prisma, type Prisma } from '@orbitstreet/database';
import type { TimePoint } from '@orbitstreet/shared-types';
import {
  fetchPowerDaily,
  POWER_SOURCE,
  type PowerDailyRequest
} from './power-api';

/**
 * Servicio de series NASA POWER con caché en PostgreSQL (tabla PowerCache).
 * La resolución de la celda POWER es ~0.5°: redondeamos coordenadas a 2
 * decimales para estabilizar la clave de caché sin perder precisión.
 */

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 'YYYYMMDD' → Date (UTC, sin desfases de zona horaria). */
export function yyyymmddToDate(yyyymmdd: string): Date {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date → 'YYYYMMDD'. */
export function dateToYyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export interface DailySeriesResult {
  points: TimePoint[];
  /** true si la serie vino de la caché (no se llamó a la API). */
  cached: boolean;
  /** Proveniencia, siempre visible para el etiquetado honesto. */
  source: string;
}

export async function getDailySeries(
  req: PowerDailyRequest
): Promise<DailySeriesResult> {
  const latitude = roundCoord(req.latitude);
  const longitude = roundCoord(req.longitude);
  const start = yyyymmddToDate(req.start);
  const end = yyyymmddToDate(req.end);

  const existing = await prisma.powerCache.findUnique({
    where: {
      latitude_longitude_parameter_temporal_start_end: {
        latitude,
        longitude,
        parameter: req.parameter,
        temporal: 'daily',
        start,
        end
      }
    }
  });

  if (existing) {
    // Prisma tipa dataJson como JsonValue: validamos la forma antes de usarlo.
    const points = existing.dataJson as unknown as TimePoint[];
    if (!Array.isArray(points)) {
      throw new Error('POWER: caché corrupta (dataJson no es un arreglo)');
    }
    return {
      points,
      cached: true,
      source: POWER_SOURCE
    };
  }

  const points = await fetchPowerDaily({ ...req, latitude, longitude });

  // Si la descarga falla, no se crea la fila: el error se propaga tal cual.
  await prisma.powerCache.create({
    data: {
      latitude,
      longitude,
      parameter: req.parameter,
      temporal: 'daily',
      start,
      end,
      // Los objetos tipados no son directamente asignables a InputJsonValue.
      dataJson: points as unknown as Prisma.InputJsonValue
    }
  });

  return { points, cached: false, source: POWER_SOURCE };
}
