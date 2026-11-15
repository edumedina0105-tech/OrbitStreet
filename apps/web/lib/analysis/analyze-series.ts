import type {
  SeasonOrAnnual,
  TimePoint,
  TrendResult,
  VariableId,
  YearsNeededResult
} from '@orbitstreet/shared-types';
import { analyzeTrend } from '@/lib/stats/analyze-trend';
import { filterBySeason, sampleStdDev, toAnnual } from '@/lib/stats/seasonal';
import { median } from '@/lib/stats/sen-slope';
import { yearsNeeded } from '@/lib/stats/years-needed';
import { VARIABLE_CONFIG } from './variables';

/**
 * Análisis puro de una serie diaria ya descargada (sin red ni DB):
 * filtra por estación, agrega a valores anuales y corre el motor
 * estadístico determinista. Es la composición de las piezas ya testeadas.
 */

export interface AnalyzeSeriesOptions {
  variable: VariableId;
  season?: SeasonOrAnnual;
  /** Umbral opcional que sobreescribe el de la variable derivada. */
  threshold?: number;
  periodStart?: string;
  periodEnd?: string;
}

export interface SeriesAnalysis {
  /** Serie anual agregada (un valor por año). */
  annual: TimePoint[];
  trend: TrendResult;
  /** Desviación estándar de los residuos respecto a la recta de Sen. */
  sigma: number;
  years: YearsNeededResult;
}

export interface SenFit {
  /** Pendiente por año (por paso de la serie anual). */
  slopePerYear: number;
  /** Ordenada en el origen para graficar (mediana robusta). */
  intercept: number;
  /** Ajuste para el punto i-ésimo de la serie anual. */
  fitAt: (index: number) => number;
}

/** Recta de Sen para graficar: intercept = mediana(x_i − slope·i). */
export function senFit(values: number[], slopePerYear: number): SenFit {
  let intercept = 0;
  if (values.length > 0) {
    const residuals = values.map((v, i) => v - slopePerYear * i);
    intercept = median(residuals);
  }
  return {
    slopePerYear,
    intercept,
    fitAt: (index: number) => intercept + slopePerYear * index
  };
}

export function analyzeDailySeries(
  points: TimePoint[],
  options: AnalyzeSeriesOptions
): SeriesAnalysis {
  const config = VARIABLE_CONFIG[options.variable];
  const season = options.season ?? 'ALL';

  // 1. Filtro por estación (elimina el ciclo estacional del agregado).
  const seasonal =
    season === 'ALL' ? points : filterBySeason(points, season);

  // 2. Agregación anual: media/máximo/suma/conteo sobre el umbral.
  const threshold = options.threshold ?? config.threshold;
  const annual = toAnnual(seasonal, config.aggregation, threshold);
  const values = annual.map((p) => p.value);

  // 3. Mann-Kendall + pendiente de Sen + IC (motor determinista).
  const trend = analyzeTrend(values, {
    variable: options.variable,
    season,
    periodStart: options.periodStart ?? annual[0]?.date ?? '',
    periodEnd:
      options.periodEnd ?? annual[annual.length - 1]?.date ?? ''
  });

  // 4. σ de los residuos respecto a la recta de Sen → "años necesarios".
  const fit = senFit(values, trend.senSlopePerDecade / 10);
  const residuals = values.map((v, i) => v - fit.fitAt(i));
  const sigma = sampleStdDev(residuals);

  const years = yearsNeeded({
    slopePerYear: trend.senSlopePerDecade / 10,
    sigma,
    alpha: 0.05,
    power: 0.8
  });

  return { annual, trend, sigma, years };
}
