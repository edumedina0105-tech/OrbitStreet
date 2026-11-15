import type {
  SeasonOrAnnual,
  TimePoint,
  TrendResult,
  VariableId,
  YearsNeededResult
} from '@orbitstreet/shared-types';
import { analyzeTrend } from '@/lib/stats/analyze-trend';
import {
  filterBySeason,
  monthOf,
  sampleStdDev,
  toAnnual,
  yearOf
} from '@/lib/stats/seasonal';
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

/**
 * Mes en que TERMINA la ventana de cada estación dentro de un año
 * calendario (la agrupación por año calendario define el invierno DJF
 * como {Dic-Y, Ene-Y, Feb-Y}: ventana contigua que termina en diciembre):
 *   ALL → diciembre · DJF → diciembre · MAM → mayo · JJA → agosto · SON → noviembre
 */
const WINDOW_END_MONTH: Record<SeasonOrAnnual, number> = {
  ALL: 12,
  DJF: 12,
  MAM: 5,
  JJA: 8,
  SON: 11
};

export function analyzeDailySeries(
  points: TimePoint[],
  options: AnalyzeSeriesOptions
): SeriesAnalysis {
  const config = VARIABLE_CONFIG[options.variable];
  const season = options.season ?? 'ALL';

  // 1. Filtro por estación (elimina el ciclo estacional del agregado).
  const seasonal =
    season === 'ALL' ? points : filterBySeason(points, season);

  // 2. Agregación anual con reglas de cobertura: años con huecos
  //    (cobertura < 90%) o ventanas aún abiertas quedan fuera.
  //    El cierre del último año se evalúa sobre la serie SIN FILTRAR:
  //    una ventana SON ya está cerrada en noviembre aunque el filtro
  //    deje el último punto en ese mes.
  const lastDate = points.length
    ? points.reduce((m, p) => (p.date > m ? p.date : m), points[0].date)
    : '';
  const lastYearClosed =
    lastDate.length <= 4 ||
    (lastDate ? monthOf(lastDate) >= WINDOW_END_MONTH[season] : false);

  const threshold = options.threshold ?? config.threshold;
  const annual = toAnnual(seasonal, config.aggregation, threshold, {
    lastYearClosed
  });
  const values = annual.map((p) => p.value);

  // 3. El periodo efectivo es el de los años REALMENTE analizados: si el
  //    último año quedó descartado por incompleto, no se afirma que el
  //    análisis cubre hasta la fecha pedida (honestidad del periodo).
  const effectivePeriodEnd =
    annual.length > 0
      ? `${yearOf(annual[annual.length - 1].date)}-12-31`
      : (options.periodEnd ?? '');

  // 4. Mann-Kendall + pendiente de Sen + IC (motor determinista).
  const trend = analyzeTrend(values, {
    variable: options.variable,
    season,
    periodStart: options.periodStart ?? annual[0]?.date ?? '',
    periodEnd: effectivePeriodEnd
  });

  // 5. σ de los residuos respecto a la recta de Sen → "años necesarios".
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
