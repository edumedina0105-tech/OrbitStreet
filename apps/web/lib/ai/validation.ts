import type { SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';
import { VARIABLE_IDS } from '@/lib/analysis/variables';

/**
 * Validación estricta del payload del informe: whitelist de variables y
 * estaciones, límites de tamaño y rangos numéricos. Nada de JSON arbitrario
 * al prompt (mitiga prompt-injection) ni a la base de datos.
 */

export interface ReportAnalysis {
  variableId: VariableId;
  /** Etiqueta ya traducida (la resuelve la ruta con i18n). */
  variableLabel: string;
  season: SeasonOrAnnual;
  seasonLabel: string;
  periodStart: string; // YYYY
  periodEnd: string; // YYYY
  slopePerDecade: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
  n: number;
  significant: boolean;
  /** null si el cálculo dio infinito (nunca se promete un horizonte). */
  yearsNeeded: number | null;
}

const SEASONS: SeasonOrAnnual[] = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'];

function finiteBounded(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function validateReportPayload(raw: unknown): ReportAnalysis | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Record<string, unknown>;

  const variableId = input.variableId as VariableId;
  if (!VARIABLE_IDS.includes(variableId)) return null;

  const season = input.season as SeasonOrAnnual;
  if (!SEASONS.includes(season)) return null;

  const periodStart = typeof input.periodStart === 'string' ? input.periodStart : '';
  const periodEnd = typeof input.periodEnd === 'string' ? input.periodEnd : '';
  if (!/^\d{4}$/.test(periodStart) || !/^\d{4}$/.test(periodEnd)) return null;
  if (periodStart < '1981' || periodEnd < periodStart) return null;

  const slopePerDecade = finiteBounded(input.slopePerDecade, -1e6, 1e6);
  const ciLow = finiteBounded(input.ciLow, -1e6, 1e6);
  const ciHigh = finiteBounded(input.ciHigh, -1e6, 1e6);
  const pValue = finiteBounded(input.pValue, 0, 1);
  const n = finiteBounded(input.n, 3, 1_000_000);
  if (
    slopePerDecade === null ||
    ciLow === null ||
    ciHigh === null ||
    pValue === null ||
    n === null
  ) {
    return null;
  }

  let yearsNeeded: number | null = null;
  if (input.yearsNeeded !== null && input.yearsNeeded !== undefined) {
    yearsNeeded = finiteBounded(input.yearsNeeded, 1, 1e9);
    if (yearsNeeded === null) return null;
  }

  return {
    variableId,
    variableLabel: '', // La ruta la completa con i18n.
    season,
    seasonLabel: '', // Ídem.
    periodStart,
    periodEnd,
    slopePerDecade,
    ciLow,
    ciHigh,
    pValue,
    n,
    significant: input.significant === true,
    yearsNeeded
  };
}
