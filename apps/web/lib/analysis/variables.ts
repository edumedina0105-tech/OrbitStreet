import type { PowerParameterId, VariableId } from '@orbitstreet/shared-types';
import type { AnnualAggregation } from '@/lib/stats/seasonal';

/**
 * Configuración de variables analizables por el Modo Detective.
 * Las etiquetas visibles se resuelven siempre por i18n (clave `variables.<id>`).
 */

export interface VariableConfig {
  /** Parámetro(s) de POWER que hay que descargar. */
  powerParameters: PowerParameterId[];
  /** Agregación anual aplicada a la serie diaria. */
  aggregation: AnnualAggregation;
  /** Umbral para la variable derivada DAYS_ABOVE_THRESHOLD. */
  threshold?: number;
  /** Unidad física (universal, no requiere traducción). */
  unit: string;
}

export const VARIABLE_CONFIG: Record<VariableId, VariableConfig> = {
  T2M: { powerParameters: ['T2M'], aggregation: 'mean', unit: '°C' },
  T2M_MAX: { powerParameters: ['T2M_MAX'], aggregation: 'max', unit: '°C' },
  T2M_MIN: { powerParameters: ['T2M_MIN'], aggregation: 'mean', unit: '°C' },
  RH2M: { powerParameters: ['RH2M'], aggregation: 'mean', unit: '%' },
  PRECTOTCORR: {
    powerParameters: ['PRECTOTCORR'],
    aggregation: 'sum',
    unit: 'mm'
  },
  PS: { powerParameters: ['PS'], aggregation: 'mean', unit: 'hPa' },
  DAYS_ABOVE_THRESHOLD: {
    powerParameters: ['T2M_MAX'],
    aggregation: 'countAbove',
    threshold: 35,
    unit: 'd'
  }
};

export const VARIABLE_IDS = Object.keys(VARIABLE_CONFIG) as VariableId[];

/** Primer dato disponible en POWER diario (validado contra la API). */
export const POWER_EARLIEST = '19810101';
