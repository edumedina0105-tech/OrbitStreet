import type { ConfidenceInterval } from '@orbitstreet/shared-types';
import { stdNormalInverseCdf } from './normal';
import { varianceS } from './mann-kendall';

export interface SenSlopeWithCI {
  slope: number;
  ci95: ConfidenceInterval;
  /** Método del IC: ordenes estadísticos clásicos (Sen 1968 / Gilbert 1987). */
  method: 'sen-1968';
}

/** Mediana de un arreglo (par: promedio de los dos centrales). */
export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Todas las pendientes por pares (x[i], i) con j > i. */
export function pairwiseSlopes(x: number[]): number[] {
  const slopes: number[] = [];
  for (let i = 0; i < x.length - 1; i++) {
    for (let j = i + 1; j < x.length; j++) {
      slopes.push((x[j] - x[i]) / (j - i));
    }
  }
  return slopes;
}

/** Pendiente de Sen (1968): mediana de las pendientes por pares. */
export function senSlope(x: number[]): number {
  return median(pairwiseSlopes(x));
}

/**
 * Pendiente de Sen con intervalo de confianza CLÁSICO no paramétrico
 * (Sen 1968; Gilbert 1987, §16.4.2): el IC de la mediana de las N
 * pendientes por pares NO se remuestrea — se ubica por ordenes
 * estadísticos usando la varianza de S de Mann-Kendall (corregida por
 * empates):
 *
 *   Cα = z_{1−α/2} · √varS
 *   M1 = (N − Cα)/2    (rango 1-based del límite inferior)
 *   M2 = (N + Cα)/2    (el superior es el orden M2 + 1)
 *
 * y se interpolan las pendientes ordenadas en esos rangos. Determinista,
 * sin aleatoriedad y sin asumir independencia entre pendientes por pares
 * (el bootstrap anterior las remuestreaba como si fueran independientes,
 * lo que subestimaba la varianza).
 */
export function senSlopeWithCI(
  x: number[],
  options: { confidence?: number } = {}
): SenSlopeWithCI {
  const { confidence = 0.95 } = options;
  const slopes = pairwiseSlopes(x).sort((a, b) => a - b);
  const slope = median(slopes);
  const N = slopes.length;

  if (N === 0 || x.length < 3) {
    return {
      slope,
      ci95: { lower: Number.NaN, upper: Number.NaN },
      method: 'sen-1968'
    };
  }

  const varS = varianceS(x);
  if (!Number.isFinite(varS) || varS <= 0) {
    return {
      slope,
      ci95: { lower: Number.NaN, upper: Number.NaN },
      method: 'sen-1968'
    };
  }

  const z = stdNormalInverseCdf(1 - (1 - confidence) / 2);
  const cAlpha = z * Math.sqrt(varS);
  if (!Number.isFinite(cAlpha) || cAlpha <= 0) {
    return {
      slope,
      ci95: { lower: Number.NaN, upper: Number.NaN },
      method: 'sen-1968'
    };
  }

  const m1 = (N - cAlpha) / 2;
  const m2 = (N + cAlpha) / 2 + 1;

  // Orden estadístico 1-based con interpolación lineal en rangos fraccionarios.
  const orderStat = (rank: number): number => {
    if (rank <= 1) return slopes[0];
    if (rank >= N) return slopes[N - 1];
    const lo = Math.floor(rank);
    const frac = rank - lo;
    const a = slopes[lo - 1];
    const b = slopes[Math.min(lo, N - 1)];
    return a + (b - a) * frac;
  };

  return {
    slope,
    ci95: { lower: orderStat(m1), upper: orderStat(m2) },
    method: 'sen-1968'
  };
}

