import type { YearsNeededResult } from '@orbitstreet/shared-types';
import { stdNormalInverseCdf } from './normal';

export interface YearsNeededOptions {
  /** Pendiente detectada, en unidades físicas por año (ej.: °C/año). */
  slopePerYear: number;
  /** Desviación estándar de las anomalías desestacionalizadas. */
  sigma: number;
  /** Nivel de significancia (default 0.05). */
  alpha?: number;
  /** Potencia estadística deseada (default 0.80). */
  power?: number;
}

/**
 * ¿Cuántos años de mediciones anuales necesitaría un sensor local para
 * detectar la tendencia con la potencia estadística indicada?
 *
 * Modelo: y_t = pendiente·t + ruido, con σ = desviación de los residuos
 * anuales respecto a la recta de Sen. En regresión lineal la varianza de
 * la pendiente estimada es Var(β̂) ≈ 12·σ² / n³. Exigiendo que la señal
 * cubra los umbrales de significancia y potencia,
 *
 *   |pendiente| = (z_{1-α/2} + z_{1-potencia}) · √(12·σ²/n³)
 *
 * y despejando n:
 *
 *   n ≈ (√12 · (z_{1-α/2} + z_{1-potencia}) · σ / |pendiente_anual|)^(2/3)
 *
 * Nota estadística: la fórmula cuadrada n = ((z·σ/pendiente)²) corresponde
 * a detectar un SALTO de media entre dos bloques, no una tendencia; usada
 * aquí inflaba los plazos hasta cifras absurdas (p. ej. 20 millones de
 * años). La potencia 2/3 es la correcta para pendientes: duplicar el ruido
 * requiere 2^(2/3) ≈ 1.6× más años, no 4×.
 */
export function yearsNeeded(options: YearsNeededOptions): YearsNeededResult {
  const { slopePerYear, sigma } = options;
  const alpha = options.alpha ?? 0.05;
  const power = options.power ?? 0.8;

  if (
    !Number.isFinite(slopePerYear) ||
    slopePerYear === 0 ||
    !Number.isFinite(sigma) ||
    sigma <= 0
  ) {
    return { years: Number.POSITIVE_INFINITY, slopePerYear, sigma, alpha, power };
  }

  const zAlpha = stdNormalInverseCdf(1 - alpha / 2);
  const zPower = stdNormalInverseCdf(power);
  const years = Math.ceil(
    ((Math.sqrt(12) * (zAlpha + zPower) * sigma) / Math.abs(slopePerYear)) **
      (2 / 3)
  );

  return { years, slopePerYear, sigma, alpha, power };
}
