import type { MannKendallResult, TrendResult, VariableId, SeasonOrAnnual } from '@orbitstreet/shared-types';
import { mannKendallHamedRao, mannKendall } from './mann-kendall';
import { senSlopeWithCI } from './sen-slope';

export interface AnalyzeTrendOptions {
  variable: VariableId;
  season?: SeasonOrAnnual;
  periodStart?: string;
  periodEnd?: string;
  /** Nivel de significancia (default 0.05). */
  alpha?: number;
  /** Valor p ajustado por FDR (si se probaron múltiples hipótesis). */
  pFdr?: number;
  /**
   * Corrección de varianza de Mann-Kendall:
   *  - 'hamed-rao' (default): corrige varS por autocorrelación (Hamed y
   *    Rao 1998). Honestidad ante series anuales autocorrelacionadas
   *    (p. ej. ENSO): sin corrección el p sale demasiado optimista.
   *  - 'ties': solo la corrección clásica por empates.
   */
  autocorrelation?: 'hamed-rao' | 'ties';
}

export interface AnalyzeTrendResult extends TrendResult {
  mannKendall: MannKendallResult;
}

/**
 * Análisis de tendencia de una serie ANUAL (un valor por año):
 * Mann-Kendall + pendiente de Sen + IC 95% + significancia.
 *
 * La serie debe estar previamente desestacionalizada o agregada por
 * estación (ver seasonal.ts): el ciclo estacional contamina las tendencias.
 */
export function analyzeTrend(
  annualValues: number[],
  options: AnalyzeTrendOptions
): AnalyzeTrendResult {
  const alpha = options.alpha ?? 0.05;
  const mk =
    (options.autocorrelation ?? 'hamed-rao') === 'ties'
      ? mannKendall(annualValues, alpha)
      : mannKendallHamedRao(annualValues, alpha);
  const sen = senSlopeWithCI(annualValues);

  // La serie es anual: la pendiente por paso es por año; ×10 = por década.
  const senSlopePerDecade = sen.slope * 10;
  const ci95PerDecade = {
    lower: sen.ci95.lower * 10,
    upper: sen.ci95.upper * 10
  };

  const pForSignificance = options.pFdr ?? mk.p;
  const significant = pForSignificance < alpha && mk.trend !== 'no-trend';

  return {
    variable: options.variable,
    season: options.season ?? 'ALL',
    periodStart: options.periodStart ?? '',
    periodEnd: options.periodEnd ?? '',
    n: mk.n,
    mannKendall: mk,
    senSlopePerDecade,
    ci95PerDecade,
    pFdr: options.pFdr,
    significant
  };
}
