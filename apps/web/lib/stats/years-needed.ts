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
 *   n ≈ ((z_{1-α/2} + z_{1-potencia}) · σ / |pendiente_anual|)²
 *
 * Este cálculo convierte la limitación física (un sensor nuevo no tiene
 * décadas de historia) en un resultado científico explícito.
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
    ((zAlpha + zPower) * sigma / Math.abs(slopePerYear)) ** 2
  );

  return { years, slopePerYear, sigma, alpha, power };
}
