/**
 * Corrección por tasa de falsos descubrimientos (Benjamini-Hochberg, 1995).
 * Devuelve valores p ajustados conservando el orden de entrada.
 * Se aplica cuando se prueban muchas variables × estaciones a la vez.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];

  const indexed = pValues
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p);

  const adjusted = new Array<number>(m);
  let runningMin = 1;
  for (let k = m - 1; k >= 0; k--) {
    const adj = Math.min(runningMin, (indexed[k].p * m) / (k + 1));
    adjusted[indexed[k].i] = adj;
    runningMin = adj;
  }
  return adjusted;
}
