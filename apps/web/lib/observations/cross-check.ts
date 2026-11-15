import { VARIABLE_CONFIG } from '@/lib/analysis/variables';
import { getDailySeries } from '@/lib/power/service';
import { biasVerdict, type BiasVerdict } from './plausibility';
import type { VariableId } from '@orbitstreet/shared-types';

/**
 * Cross-check determinista de una observación puntual contra la celda
 * MERRA-2 de NASA POWER del mismo día. El veredicto ("¿es más o menos
 * cierto?") lo calcula CÓDIGO, jamás la IA: la IA solo extrajo el número.
 *
 * Se trae el MES completo (no solo el día) para estabilizar el caché de
 * PowerCache: 30 llamadas de días distintos de la misma celda → 1 fila.
 */

export interface NasaCheck {
  /** Valor de la celda MERRA-2 ese día (null si no hay referencia). */
  cellValue: number | null;
  /** Observación − celda, en unidades de la variable. */
  bias: number | null;
  verdict: BiasVerdict;
  /** Proveniencia visible para el etiquetado honesto. */
  source: string;
}

export const OBSERVATION_GOAL = 10;

export async function crossCheckWithCell(input: {
  latitude: number;
  longitude: number;
  variable: string;
  /** YYYY-MM-DD */
  observedAt: string;
  value: number;
}): Promise<NasaCheck> {
  const year = Number(input.observedAt.slice(0, 4));
  const month = Number(input.observedAt.slice(5, 7));
  if (!Number.isFinite(year) || year < 1981) {
    return {
      cellValue: null,
      bias: null,
      verdict: 'no_reference',
      source: 'sin referencia'
    };
  }

  const parameter = VARIABLE_CONFIG[input.variable as VariableId]
    ?.powerParameters[0];
  if (!parameter) {
    return {
      cellValue: null,
      bias: null,
      verdict: 'no_reference',
      source: 'sin referencia'
    };
  }

  // Mes completo para estabilizar el caché (ver cabecera).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = `${input.observedAt.slice(0, 7)}-01`.replace(/-/g, '');
  const end = `${input.observedAt.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`.replace(
    /-/g,
    ''
  );

  let cellValue: number | null = null;
  let source = 'sin referencia';
  try {
    const series = await getDailySeries({
      latitude: input.latitude,
      longitude: input.longitude,
      parameter,
      start,
      end
    });
    source = series.source;
    const cellPoint = series.points.find((p) => p.date === input.observedAt);
    cellValue = cellPoint ? cellPoint.value : null;
  } catch {
    return {
      cellValue: null,
      bias: null,
      verdict: 'no_reference',
      source: 'sin referencia'
    };
  }

  return evaluateAgainstCell(input.value, cellValue, input.variable, source);
}

/**
 * Versión con valor observado: sesgo + veredicto en código determinista.
 * (Separada para poder testear sin red.)
 */
export function evaluateAgainstCell(
  observedValue: number,
  cellValue: number | null,
  variable: string,
  source: string
): NasaCheck {
  if (cellValue === null || !Number.isFinite(cellValue)) {
    return {
      cellValue: null,
      bias: null,
      verdict: 'no_reference',
      source
    };
  }
  const bias = observedValue - cellValue;
  return {
    cellValue,
    bias,
    verdict: biasVerdict(variable, bias),
    source
  };
}