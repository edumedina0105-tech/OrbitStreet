import type { SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';
import { VARIABLE_IDS } from '@/lib/analysis/variables';

/**
 * Validación estricta de un caso del "Tablón de Casos".
 * El usuario aporta la hipótesis y la nota de campo; el resto son
 * parámetros de la investigación que el SERVIDOR recalcula determinista-
 * mente al publicar (nunca se confía en cifras del navegador).
 */

export const SEASONS: SeasonOrAnnual[] = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'];

export type CaseErrorCode =
  | 'invalid_hypothesis'
  | 'invalid_field_note'
  | 'invalid_place'
  | 'invalid_variable'
  | 'invalid_season'
  | 'invalid_period'
  | 'invalid_coords';

export interface CaseInput {
  hypothesis: string;
  fieldNote: string;
  placeName: string;
  latitude: number;
  longitude: number;
  variable: VariableId;
  season: SeasonOrAnnual;
  /** Años YYYY. */
  startYear: number;
  endYear: number;
  locale: 'es' | 'en';
}

export function validateCaseInput(raw: {
  hypothesis?: unknown;
  fieldNote?: unknown;
  placeName?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  variable?: unknown;
  season?: unknown;
  startYear?: unknown;
  endYear?: unknown;
  locale?: unknown;
}): { ok: true; input: CaseInput } | { ok: false; errorCode: CaseErrorCode } {
  const hypothesis =
    typeof raw.hypothesis === 'string' ? raw.hypothesis.trim() : '';
  if (hypothesis.length < 10 || hypothesis.length > 200) {
    return { ok: false, errorCode: 'invalid_hypothesis' };
  }

  const fieldNote =
    typeof raw.fieldNote === 'string' ? raw.fieldNote.trim() : '';
  if (fieldNote.length < 20 || fieldNote.length > 1000) {
    return { ok: false, errorCode: 'invalid_field_note' };
  }

  const placeName =
    typeof raw.placeName === 'string' ? raw.placeName.trim() : '';
  if (placeName.length < 2 || placeName.length > 80) {
    return { ok: false, errorCode: 'invalid_place' };
  }

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, errorCode: 'invalid_coords' };
  }

  const variable = raw.variable as VariableId;
  if (typeof raw.variable !== 'string' || !VARIABLE_IDS.includes(variable)) {
    return { ok: false, errorCode: 'invalid_variable' };
  }

  const season = raw.season as SeasonOrAnnual;
  if (typeof raw.season !== 'string' || !SEASONS.includes(season)) {
    return { ok: false, errorCode: 'invalid_season' };
  }

  const startYear = Number(raw.startYear);
  const endYear = Number(raw.endYear);
  const nowYear = new Date().getUTCFullYear();
  if (
    !Number.isInteger(startYear) ||
    !Number.isInteger(endYear) ||
    startYear < 1981 ||
    endYear > nowYear + 1 ||
    startYear >= endYear
  ) {
    return { ok: false, errorCode: 'invalid_period' };
  }

  return {
    ok: true,
    input: {
      hypothesis,
      fieldNote,
      placeName,
      latitude,
      longitude,
      variable,
      season,
      startYear,
      endYear,
      locale: raw.locale === 'en' ? 'en' : 'es'
    }
  };
}
