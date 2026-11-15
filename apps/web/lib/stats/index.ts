/**
 * OrbitStreet — motor estadístico determinista.
 * Todos los cálculos son matemáticos y reproducibles; la IA jamás
 * participa en el cálculo de cifras.
 */
export { stdNormalCdf, stdNormalInverseCdf } from './normal';
export { mulberry32 } from './random';
export {
  mannKendall,
  mannKendallHamedRao,
  mkScore,
  varianceS,
  averageRanks
} from './mann-kendall';
export {
  median,
  pairwiseSlopes,
  senSlope,
  senSlopeWithCI,
  type SenSlopeWithCI
} from './sen-slope';
export { benjaminiHochberg } from './fdr';
export { yearsNeeded, type YearsNeededOptions } from './years-needed';
export {
  monthOf,
  yearOf,
  seasonOfMonth,
  filterBySeason,
  toAnnual,
  monthlyAnomalies,
  sampleStdDev,
  type AnnualAggregation
} from './seasonal';
export {
  analyzeTrend,
  type AnalyzeTrendOptions,
  type AnalyzeTrendResult
} from './analyze-trend';
