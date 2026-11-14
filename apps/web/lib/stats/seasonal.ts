import type { Season, TimePoint } from '@orbitstreet/shared-types';

/** Mes de una fecha ISO 'YYYY-MM-DD' (1-12). */
export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

/** Año de una fecha ISO 'YYYY-MM-DD' o 'YYYY'. */
export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Estación del año de un mes (1-12). */
export function seasonOfMonth(month: number): Season {
  if (month === 12 || month === 1 || month === 2) return 'DJF';
  if (month >= 3 && month <= 5) return 'MAM';
  if (month >= 6 && month <= 8) return 'JJA';
  return 'SON';
}

/** Filtra una serie diaria/mensual por estación del año. */
export function filterBySeason(points: TimePoint[], season: Season): TimePoint[] {
  return points.filter((p) => seasonOfMonth(monthOf(p.date)) === season);
}

export type AnnualAggregation = 'mean' | 'max' | 'sum' | 'countAbove';

/**
 * Agrega una serie diaria/mensual a valores anuales.
 * - 'mean': media anual (ej.: T2M)
 * - 'max': máximo anual (ej.: T2M_MAX)
 * - 'sum': suma anual (ej.: precipitación acumulada)
 * - 'countAbove': conteo anual de valores sobre el umbral (ej.: días > 35 °C)
 *
 * La salida usa date='YYYY-01-01' para mantener el formato ISO.
 */
export function toAnnual(
  points: TimePoint[],
  agg: AnnualAggregation,
  threshold?: number
): TimePoint[] {
  const byYear = new Map<number, number[]>();
  for (const p of points) {
    const y = yearOf(p.date);
    const bucket = byYear.get(y);
    if (bucket) {
      bucket.push(p.value);
    } else {
      byYear.set(y, [p.value]);
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const out: TimePoint[] = [];

  for (const year of years) {
    const values = byYear.get(year)!;
    let value: number;
    switch (agg) {
      case 'mean':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'countAbove':
        value = values.filter((v) => v > (threshold ?? 0)).length;
        break;
    }
    out.push({ date: `${year}-01-01`, value });
  }
  return out;
}

/**
 * Desestacionalización: resta a cada punto la media de su mes calendario
 * (calculada sobre toda la serie). Así el ciclo estacional no contamina
 * la detección de tendencias, tal como advierte el desafío.
 */
export function monthlyAnomalies(points: TimePoint[]): TimePoint[] {
  const byMonth = new Map<number, number[]>();
  for (const p of points) {
    const m = monthOf(p.date);
    const bucket = byMonth.get(m);
    if (bucket) {
      bucket.push(p.value);
    } else {
      byMonth.set(m, [p.value]);
    }
  }

  const monthMeans = new Map<number, number>();
  for (const [m, values] of byMonth) {
    monthMeans.set(m, values.reduce((a, b) => a + b, 0) / values.length);
  }

  return points.map((p) => ({
    date: p.date,
    value: p.value - (monthMeans.get(monthOf(p.date)) ?? 0)
  }));
}

/** Desviación estándar muestral (n-1). */
export function sampleStdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return Number.NaN;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}
