import type { MannKendallResult } from '@orbitstreet/shared-types';
import { stdNormalCdf } from './normal';

/**
 * Prueba de Mann-Kendall (Mann 1945, Kendall 1975) con corrección por empates.
 * Detecta tendencia monótona sin asumir normalidad de los residuos.
 * Determinista: sin aleatoriedad.
 */
export function mannKendall(x: number[], alpha = 0.05): MannKendallResult {
  const n = x.length;

  if (n < 3) {
    return { n, s: 0, varS: 0, z: 0, p: 1, trend: 'no-trend' };
  }

  // Estadístico S: suma de signos de todas las diferencias por pares.
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      s += Math.sign(x[j] - x[i]);
    }
  }

  // Corrección por empates (grupos de valores repetidos).
  const counts = new Map<number, number>();
  for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) {
    if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  }

  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;

  let z: number;
  if (s > 0) {
    z = (s - 1) / Math.sqrt(varS);
  } else if (s < 0) {
    z = (s + 1) / Math.sqrt(varS);
  } else {
    z = 0;
  }

  // z = 0 → sin evidencia de tendencia: p exactamente 1.
  const p = z === 0 ? 1 : 2 * (1 - stdNormalCdf(Math.abs(z)));

  let trend: MannKendallResult['trend'] = 'no-trend';
  if (p < alpha) {
    trend = z > 0 ? 'increasing' : 'decreasing';
  }

  return { n, s, varS, z, p, trend };
}
