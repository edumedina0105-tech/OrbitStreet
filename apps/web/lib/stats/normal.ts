/**
 * Función de distribución normal estándar y su inversa.
 * Determinista, sin dependencias externas.
 */

/** CDF normal estándar F(z). Aproximación de Zelen & Severo (error < 7.5e-8). */
export function stdNormalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

/**
 * Inversa de la CDF normal estándar, por bisección sobre stdNormalCdf.
 * Determinista y robusta (sin coeficientes de aproximaciones frágiles).
 * La precisión queda limitada solo por la CDF (~1e-7), más que suficiente
 * para los usos estadísticos del proyecto (z_{0.975}, z_{0.80}, etc.).
 */
export function stdNormalInverseCdf(p: number): number {
  if (!Number.isFinite(p)) return Number.NaN;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  let low = -12;
  let high = 12;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (stdNormalCdf(mid) < p) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}
