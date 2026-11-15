import type { MannKendallResult } from '@orbitstreet/shared-types';
import { stdNormalCdf, stdNormalInverseCdf } from './normal';
import { senSlope } from './sen-slope';

/**
 * Prueba de Mann-Kendall (Mann 1945, Kendall 1975).
 *
 *  - mannKendall: versión clásica con corrección por empates. Asume
 *    independencia entre observaciones.
 *  - mannKendallHamedRao: corrige la varianza de S por autocorrelación
 *    (Hamed y Rao 1998), como pymannkendall.hamed_rao_modification_test.
 *    Con series anuales autocorrelacionadas (p. ej. ENSO), el p clásico
 *    sale demasiado optimista; esta versión es la honesta.
 *
 * Deterministas: sin aleatoriedad en ninguna de las dos.
 */

/** Estadístico S: suma de signos de todas las diferencias por pares. */
export function mkScore(x: number[]): number {
  const n = x.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(x[j] - x[i]);
    }
  }
  return s;
}

/** Varianza de S con corrección por empates (Kendall 1975). */
export function varianceS(x: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const counts = new Map<number, number>();
  for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) {
    if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  }
  return (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
}

/** z estandarizado de S (continuidad ±1). */
export function mkZScore(s: number, varS: number): number {
  if (varS <= 0) return 0;
  if (s > 0) return (s - 1) / Math.sqrt(varS);
  if (s < 0) return (s + 1) / Math.sqrt(varS);
  return 0;
}

/** p bilateral a partir de z (z = 0 → p exactamente 1). */
export function mkPValue(z: number): number {
  return z === 0 ? 1 : 2 * (1 - stdNormalCdf(Math.abs(z)));
}

/** Rangos promedio (los empates reciben el rango medio), como rankdata. */
export function averageRanks(x: number[]): number[] {
  const n = x.length;
  const sorted = x
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j++;
    const avg = (i + j) / 2 + 1; // rango 1-based promedio del grupo
    for (let k = i; k <= j; k++) ranks[sorted[k].index] = avg;
    i = j + 1;
  }
  return ranks;
}

function buildResult(
  x: number[],
  s: number,
  varS: number,
  alpha: number,
  varianceCorrection: MannKendallResult['varianceCorrection']
): MannKendallResult {
  const z = mkZScore(s, varS);
  const p = mkPValue(z);

  let trend: MannKendallResult['trend'] = 'no-trend';
  if (p < alpha) {
    trend = z > 0 ? 'increasing' : 'decreasing';
  }

  return { n: x.length, s, varS, z, p, trend, varianceCorrection };
}

/** Mann-Kendall clásico (asume independencia), con corrección por empates. */
export function mannKendall(x: number[], alpha = 0.05): MannKendallResult {
  const n = x.length;
  if (n < 3) {
    return {
      n,
      s: 0,
      varS: 0,
      z: 0,
      p: 1,
      trend: 'no-trend',
      varianceCorrection: 'ties'
    };
  }
  const s = mkScore(x);
  const varS = varianceS(x);
  return buildResult(x, s, varS, alpha, 'ties');
}

/**
 * Mann-Kendall con corrección de varianza por autocorrelación
 * (Hamed y Rao 1998). Implementación equivalente a
 * pymannkendall.hamed_rao_modification_test:
 *
 *  1. Detrend por la pendiente de Sen: x̃_i = x_i − (i+1)·slope (índice 1-based).
 *  2. Rangos I de la serie detrendeda.
 *  3. ACF sesgada de los rangos; solo lag k con |r_k| > z_{1−α/2}/√n.
 *  4. varS* = varS · [1 + 2/(n(n−1)(n−2)) · Σ (n−k)(n−k−1)(n−k−2)·r_k].
 *
 * Con n < 6 no hay lags fiables: cae al Mann-Kendall clásico.
 */
export function mannKendallHamedRao(
  x: number[],
  alpha = 0.05
): MannKendallResult {
  const n = x.length;
  if (n < 6) return mannKendall(x, alpha);

  const s = mkScore(x);
  const baseVar = varianceS(x);

  // 1. Detrend por la pendiente de Sen (sin intercept, como Hamed y Rao).
  const slope = senSlope(x);
  const detrended = x.map((v, i) => v - (i + 1) * slope);

  // 2. Rangos de la serie detrendeda.
  const ranks = averageRanks(detrended);
  const mean = ranks.reduce((a, b) => a + b, 0) / n;
  const y = ranks.map((r) => r - mean);
  const denom = y.reduce((acc, v) => acc + v * v, 0);

  // 3. ACF de los rangos; 4. suma sobre los lags significativos.
  let sni = 0;
  if (denom > 0) {
    const interval = stdNormalInverseCdf(1 - alpha / 2) / Math.sqrt(n);
    for (let k = 1; k <= n - 1; k++) {
      let cov = 0;
      for (let i = 0; i < n - k; i++) cov += y[i] * y[i + k];
      const rk = cov / denom;
      if (Math.abs(rk) > interval) {
        sni += (n - k) * (n - k - 1) * (n - k - 2) * rk;
      }
    }
  }

  let varS = baseVar * (1 + (2 * sni) / (n * (n - 1) * (n - 2)));
  if (!Number.isFinite(varS) || varS <= 0) varS = baseVar;

  return buildResult(x, s, varS, alpha, 'hamed-rao');
}

