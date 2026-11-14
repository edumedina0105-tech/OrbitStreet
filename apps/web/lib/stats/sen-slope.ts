import type { ConfidenceInterval } from '@orbitstreet/shared-types';
import { mulberry32 } from './random';

export interface SenSlopeWithCI {
  slope: number;
  ci95: ConfidenceInterval;
  bootstraps: number;
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
 * Pendiente de Sen con intervalo de confianza por bootstrap.
 * Determinista: el remuestreo usa un PRNG con semilla fija, por lo que
 * el mismo input produce exactamente el mismo output.
 */
export function senSlopeWithCI(
  x: number[],
  options: { bootstraps?: number; confidence?: number; seed?: number } = {}
): SenSlopeWithCI {
  const { bootstraps = 1000, confidence = 0.95, seed = 42 } = options;
  const slopes = pairwiseSlopes(x);
  const slope = median(slopes);

  if (slopes.length === 0) {
    return {
      slope,
      ci95: { lower: Number.NaN, upper: Number.NaN },
      bootstraps: 0
    };
  }

  const rand = mulberry32(seed);
  const medians = new Array<number>(bootstraps);
  for (let b = 0; b < bootstraps; b++) {
    // Remuestreo de las pendientes por pares con reemplazo.
    const resample = new Array<number>(slopes.length);
    for (let k = 0; k < slopes.length; k++) {
      resample[k] = slopes[Math.floor(rand() * slopes.length)];
    }
    medians[b] = median(resample);
  }
  medians.sort((a, b) => a - b);

  const errorRate = 1 - confidence;
  const lowerIndex = Math.floor((errorRate / 2) * medians.length);
  const upperIndex =
    Math.min(
      medians.length - 1,
      Math.ceil((1 - errorRate / 2) * medians.length) - 1
    );

  return {
    slope,
    ci95: { lower: medians[lowerIndex], upper: medians[upperIndex] },
    bootstraps
  };
}
