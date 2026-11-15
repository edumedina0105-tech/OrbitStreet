import { describe, expect, it } from 'vitest';
import type { TimePoint } from '@orbitstreet/shared-types';
import {
  filterBySeason,
  monthlyAnomalies,
  sampleStdDev,
  seasonOfMonth,
  toAnnual,
  yearOf
} from '../seasonal';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

describe('seasonOfMonth', () => {
  it('mapea meses a estaciones correctamente', () => {
    expect(seasonOfMonth(1)).toBe('DJF');
    expect(seasonOfMonth(12)).toBe('DJF');
    expect(seasonOfMonth(4)).toBe('MAM');
    expect(seasonOfMonth(7)).toBe('JJA');
    expect(seasonOfMonth(10)).toBe('SON');
  });
});

describe('filterBySeason', () => {
  const points: TimePoint[] = [
    { date: '2024-01-15', value: 1 },
    { date: '2024-04-15', value: 2 },
    { date: '2024-07-15', value: 3 },
    { date: '2024-10-15', value: 4 }
  ];

  it('filtra por estación', () => {
    const son = filterBySeason(points, 'SON');
    expect(son).toHaveLength(1);
    expect(son[0].value).toBe(4);
  });
});

describe('monthlyAnomalies (desestacionalización)', () => {
  it('elimina por completo un ciclo estacional constante', () => {
    const seasonalOffset = [10, 8, 5, 0, -3, -6, -7, -5, -1, 4, 8, 11];
    const points: TimePoint[] = [];
    for (let year = 2000; year <= 2009; year++) {
      for (let month = 1; month <= 12; month++) {
        points.push({
          date: `${year}-${pad(month)}-15`,
          value: 20 + seasonalOffset[month - 1]
        });
      }
    }
    const anomalies = monthlyAnomalies(points);
    for (const a of anomalies) {
      expect(Math.abs(a.value)).toBeLessThan(1e-9);
    }
  });

  it('conserva una tendencia superpuesta al ciclo estacional', () => {
    const seasonalOffset = [10, 8, 5, 0, -3, -6, -7, -5, -1, 4, 8, 11];
    const points: TimePoint[] = [];
    for (let year = 2000; year <= 2009; year++) {
      for (let month = 1; month <= 12; month++) {
        points.push({
          date: `${year}-${pad(month)}-15`,
          value: 20 + seasonalOffset[month - 1] + 0.5 * (year - 2000)
        });
      }
    }
    const anomalies = monthlyAnomalies(points);
    // El último año debe ser ~+2.25 sobre la media de su mes (tendencia 0.5/año).
    const lastYear = anomalies.filter((p) => yearOf(p.date) === 2009);
    const mean = lastYear.reduce((a, b) => a + b.value, 0) / lastYear.length;
    expect(mean).toBeCloseTo(2.25, 6);
  });
});

describe('toAnnual', () => {
  const points: TimePoint[] = [
    { date: '2023-01-01', value: 30 },
    { date: '2023-07-01', value: 10 },
    { date: '2024-01-01', value: 36 },
    { date: '2024-07-01', value: 14 }
  ];

  it('mean: promedio anual', () => {
    const annual = toAnnual(points, 'mean');
    expect(annual).toHaveLength(2);
    expect(annual[0].value).toBe(20);
    expect(annual[1].value).toBe(25);
  });

  it('max: máximo anual', () => {
    expect(toAnnual(points, 'max')[0].value).toBe(30);
  });

  it('sum: suma anual (precipitación)', () => {
    expect(toAnnual(points, 'sum')[0].value).toBe(40);
  });

  it('countAbove: días sobre umbral (ej.: > 35 °C)', () => {
    // 2023: [30, 10] → solo 30 supera 15 → 1
    expect(toAnnual(points, 'countAbove', 15)[0].value).toBe(1);
    // 2024: [36, 14] → ambos superan 12 → 2
    expect(toAnnual(points, 'countAbove', 12)[1].value).toBe(2);
  });
});

describe('sampleStdDev', () => {
  it('σ muestral de [2, 4, 4, 4, 5, 5, 7, 9] = 2.138...', () => {
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
  });
});
