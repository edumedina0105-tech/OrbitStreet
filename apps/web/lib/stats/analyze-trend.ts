import type { MannKendallResult, TrendResult, VariableId, SeasonOrAnnual } from '@orbitstreet/shared-types';
import { mannKendall } from './mann-kendall';
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
  /** Bootstrap para el IC de Sen (default 1000, determinista con semilla fija). */
  bootstraps?: number;
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
  const mk = mannKendall(annualValues, alpha);
  const sen = senSlopeWithCI(annualValues, {
    bootstraps: options.bootstraps
  });

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
