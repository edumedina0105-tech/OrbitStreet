/**
 * OrbitStreet — tipos compartidos entre web y servidor.
 * La estadística es determinista: estos tipos representan resultados
 * calculados por código, nunca por un modelo de lenguaje.
 */

/** Idiomas soportados con paridad 1:1. */
export type Locale = 'en' | 'es';

/** Parámetros de NASA POWER usados por el Modo Detective. */
export type PowerParameterId =
  | 'T2M' // Temperatura media a 2 m (°C)
  | 'T2M_MAX' // Temperatura máxima diaria (°C)
  | 'T2M_MIN' // Temperatura mínima diaria (°C)
  | 'RH2M' // Humedad relativa a 2 m (%)
  | 'PRECTOTCORR' // Precipitación corregida (mm)
  | 'PS'; // Presión superficial (hPa)

/** Variables derivadas calculadas a partir de los parámetros. */
export type DerivedVariableId = 'DAYS_ABOVE_THRESHOLD';

export type VariableId = PowerParameterId | DerivedVariableId;

/** Estaciones meteorológicas (hemisferio sur y norte comparten etiquetas). */
export type Season = 'DJF' | 'MAM' | 'JJA' | 'SON';
export type SeasonOrAnnual = Season | 'ALL';

/** Punto de una serie temporal (date: ISO 'YYYY-MM-DD' o 'YYYY' para anual). */
export interface TimePoint {
  date: string;
  value: number;
}

export type TrendDirection = 'increasing' | 'decreasing' | 'no-trend';

/** Resultado de la prueba de Mann-Kendall (con corrección por empates). */
export interface MannKendallResult {
  n: number;
  s: number;
  varS: number;
  z: number;
  /** Valor p bilateral. */
  p: number;
  trend: TrendDirection;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

/** Pendiente de Sen con intervalo de confianza por bootstrap determinista. */
export interface SenSlopeResult {
  /** Pendiente por paso temporal (ej.: °C/año si la serie es anual). */
  slope: number;
  ci95: ConfidenceInterval;
}

/** Resultado completo del análisis de tendencia (responde las 4 preguntas). */
export interface TrendResult {
  variable: VariableId;
  season: SeasonOrAnnual;
  periodStart: string;
  periodEnd: string;
  n: number;
  mannKendall: MannKendallResult;
  /** Pendiente de Sen por década, en la unidad física de la variable. */
  senSlopePerDecade: number;
  ci95PerDecade: ConfidenceInterval;
  /** Valor p ajustado por comparaciones múltiples (Benjamini-Hochberg). */
  pFdr?: number;
  /** Significancia estadística (p < 0.05, usando pFdr si existe). */
  significant: boolean;
}

/** Proveniencia de una serie (para etiquetado honesto en la interfaz). */
export type SeriesSource = 'nasa-power' | 'community' | 'simulated';

/**
 * ¿Cuántos años necesitaría un sensor local para confirmar la tendencia?
 * n ≈ (√12 · (z_{1-α/2} + z_{1-potencia}) · σ / |pendiente_anual|)^(2/3)
 */
export interface YearsNeededResult {
  years: number;
  slopePerYear: number;
  sigma: number;
  alpha: number;
  power: number;
}

/** Etiqueta obligatoria para datos de prueba. */
export const SIMULATED_BADGE = '[DATOS SIMULADOS / TESTBED]';

/**
 * Límite práctico del horizonte "años que necesitaría un sensor local".
 *
 * n ≈ ((z_{1-α/2} + z_{1-potencia}) · σ / |pendiente_anual|)² puede dar
 * millones de años cuando el ruido supera a la señal: matemáticamente
 * correcto, pero sin sentido práctico. Por encima de este límite la
 * interfaz muestra el mensaje honesto "no detectable en plazo humano"
 * y al informe de IA no se le pasa la cifra (null = sin horizonte).
 */
export const YEARS_NEEDED_PRACTICAL_LIMIT = 1000;
