import { describe, expect, it } from 'vitest';
import type { TimePoint } from '@orbitstreet/shared-types';
import { mulberry32 } from '../../stats/random';
import { analyzeDailySeries, senFit } from '../analyze-series';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(month: number): number {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Serie sintética: 45 años de datos diarios con ciclo estacional,
 * tendencia real de +0.04/año (+0.4/década) y ruido determinista.
 */
function syntheticDailySeries(): TimePoint[] {
  const seasonalOffset = [10, 8, 5, 0, -3, -6, -7, -5, -1, 4, 8, 11];
  const rand = mulberry32(2026);
  const points: TimePoint[] = [];
  for (let year = 1981; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= daysInMonth(month); day++) {
        points.push({
          date: `${year}-${pad(month)}-${pad(day)}`,
          value:
            20 +
            seasonalOffset[month - 1] +
            0.04 * (year - 1981) +
            (rand() - 0.5) * 1.5
        });
      }
    }
  }
  return points;
}

describe('senFit', () => {
  it('recupera intersección y ajuste de una serie lineal exacta', () => {
    const values = Array.from({ length: 10 }, (_, i) => 2 * i + 5);
    const fit = senFit(values, 2);
    expect(fit.intercept).toBe(5);
    expect(fit.fitAt(0)).toBe(5);
    expect(fit.fitAt(4)).toBe(13);
  });
});

describe('analyzeDailySeries', () => {
  it('recupera una tendencia real de +0.4 °C/década sobre 45 años con ruido', () => {
    const analysis = analyzeDailySeries(syntheticDailySeries(), {
      variable: 'T2M',
      periodStart: '19810101',
      periodEnd: '20251231'
    });

    expect(analysis.annual).toHaveLength(45);
    expect(analysis.trend.significant).toBe(true);
    expect(analysis.trend.senSlopePerDecade).toBeGreaterThan(0.25);
    expect(analysis.trend.senSlopePerDecade).toBeLessThan(0.55);
    expect(analysis.years.years).toBeGreaterThan(0);
    expect(Number.isFinite(analysis.years.years)).toBe(true);
  });

  it('el filtro por estación reduce la serie pero mantiene el análisis', () => {
    const analysis = analyzeDailySeries(syntheticDailySeries(), {
      variable: 'T2M',
      season: 'SON'
    });
    expect(analysis.annual).toHaveLength(45);
    expect(analysis.trend.season).toBe('SON');
  });

  it('DAYS_ABOVE_THRESHOLD cuenta días sobre 35 °C y detecta el aumento', () => {
    // Máximos que crecen de ~30-33 °C a ~36-38 °C en 45 años.
    const rand = mulberry32(7);
    const points: TimePoint[] = [];
    for (let year = 1981; year <= 2025; year++) {
      for (let day = 1; day <= 90; day++) {
        // Diciembre: el año 2025 queda cerrado y entra al análisis.
        points.push({
          date: `${year}-12-${pad(day % 28 + 1)}`,
          value: 30 + 0.13 * (year - 1981) + rand() * 3
        });
      }
    }
    const analysis = analyzeDailySeries(points, {
      variable: 'DAYS_ABOVE_THRESHOLD'
    });

    // Los primeros años no superan el umbral; los últimos sí.
    expect(analysis.annual[0].value).toBe(0);
    expect(analysis.annual[44].value).toBeGreaterThan(20);
    expect(analysis.trend.mannKendall.trend).toBe('increasing');
    expect(analysis.trend.significant).toBe(true);
  });

  it('una serie plana no produce tendencia ni promete años', () => {
    const points: TimePoint[] = [];
    for (let year = 1981; year <= 2025; year++) {
      for (let day = 1; day <= 365; day++) {
        points.push({ date: `${year}-01-01`, value: 20 });
      }
    }
    const analysis = analyzeDailySeries(points, { variable: 'T2M' });
    expect(analysis.trend.significant).toBe(false);
    // Pendiente 0 → horizonte infinito (honestidad: no se promete nada).
    expect(analysis.years.years).toBe(Number.POSITIVE_INFINITY);
  });
});
