import type { VariableId } from '@orbitstreet/shared-types';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';

/**
 * Plausibilidad de observaciones comunitarias puntuales.
 *
 * Nada de esto dice "el dato es verdad": da un veredicto GRADUAL y
 * transparente en código determinista. La IA solo extrae cifras de la
 * imagen; los umbrales físicos y el veredicto del sesgo contra la celda
 * MERRA-2 los calcula este módulo, jamás el modelo de lenguaje.
 */

/**
 * Variables que pueden reportarse como observación puntual.
 * DAYS_ABOVE_THRESHOLD queda fuera: es una métrica DERIVADA de la serie
 * anual, no una lectura física que un instrumento o foto pueda mostrar.
 */
export const OBSERVABLE_VARIABLES: VariableId[] = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'RH2M',
  'PRECTOTCORR',
  'PS'
];

/** Rangos físicamente plausibles (fuera de esto = dato imposible). */
const PHYSICAL_BOUNDS: Record<string, { min: number; max: number }> = {
  T2M: { min: -90, max: 60 },
  T2M_MAX: { min: -90, max: 60 },
  T2M_MIN: { min: -90, max: 60 },
  RH2M: { min: 0, max: 100 },
  PRECTOTCORR: { min: 0, max: 500 }, // mm/día (récords mundiales ~500 en 24 h)
  PS: { min: 300, max: 1100 } // hPa (rango 870–1084 medidos en superficie)
};

export function withinPhysicalBounds(variable: string, value: number): boolean {
  const bounds = PHYSICAL_BOUNDS[variable];
  if (!bounds) return false;
  return (
    Number.isFinite(value) && value >= bounds.min && value <= bounds.max
  );
}

export type BiasVerdict = 'plausible' | 'doubtful' | 'suspicious' | 'no_reference';

/**
 * Umbrales de sesgo |valor_observado − valor_celda_NASA| por variable.
 * La celda cubre ~50 × 70 km: un sesgo pequeño es EXPECTABLE (tu calle
 * difiere de la celda); uno enorme es señal de dato dudoso.
 */
const BIAS_THRESHOLDS: Record<string, { doubtful: number; suspicious: number }> = {
  T2M: { doubtful: 2, suspicious: 5 },
  T2M_MAX: { doubtful: 3, suspicious: 6 },
  T2M_MIN: { doubtful: 2, suspicious: 5 },
  RH2M: { doubtful: 10, suspicious: 25 },
  PRECTOTCORR: { doubtful: 10, suspicious: 30 }, // la lluvia es muy ruidosa
  PS: { doubtful: 3, suspicious: 8 }
};

export function biasVerdict(
  variable: string,
  bias: number
): BiasVerdict {
  const thresholds = BIAS_THRESHOLDS[variable];
  if (!thresholds || !Number.isFinite(bias)) return 'no_reference';
  const absolute = Math.abs(bias);
  if (absolute <= thresholds.doubtful) return 'plausible';
  if (absolute <= thresholds.suspicious) return 'doubtful';
  return 'suspicious';
}

/** Unidad canónica de la variable (para almacenar y comparar sesgos). */
export function unitOf(variable: string): string {
  return VARIABLE_CONFIG[variable as VariableId]?.unit ?? '';
}
