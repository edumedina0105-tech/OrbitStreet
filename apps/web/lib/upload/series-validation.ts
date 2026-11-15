import type { TimePoint, VariableId } from '@orbitstreet/shared-types';

/**
 * Validación estricta de series comunitarias antes de tocar la base de datos.
 * Principios:
 *  - Nada se guarda sin validar formato, longitud y rangos físicos.
 *  - Los rangos físicos evitan datos absurdos (un "calor" de 500 °C no existe).
 *  - Esta capa es la primera línea anti-abuso; el cooldown es la segunda.
 */

export const MAX_POINTS = 5000;
export const MIN_POINTS = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Rangos físicos plausibles por variable (valores diarios). */
const PHYSICAL_RANGES: Partial<Record<VariableId, [number, number]>> = {
  T2M: [-90, 70],
  T2M_MAX: [-90, 70],
  T2M_MIN: [-90, 70],
  RH2M: [0, 100],
  PRECTOTCORR: [0, 1500],
  PS: [300, 1100]
};

export type ValidationErrorCode =
  | 'invalid_format'
  | 'too_many_points'
  | 'too_few_points'
  | 'invalid_date'
  | 'invalid_value'
  | 'out_of_range';

export interface ValidationResult {
  ok: boolean;
  errorCode?: ValidationErrorCode;
  /** Mensaje técnico para logs (la interfaz muestra textos por i18n). */
  detail?: string;
  points?: TimePoint[];
}

function isValidDate(iso: string): boolean {
  if (!DATE_RE.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

export function isWithinPhysicalRange(
  variable: VariableId,
  value: number
): boolean {
  const range = PHYSICAL_RANGES[variable];
  if (!range) return Number.isFinite(value);
  return value >= range[0] && value <= range[1];
}

/**
 * Acepta:
 *  a) Arreglo JSON: [{ "date": "YYYY-MM-DD", "value": 12.3 }, ...]
 *  b) CSV de texto: una línea por punto "YYYY-MM-DD,12.3" (separador , o ;)
 */
export function parseSeriesPayload(
  raw: unknown,
  variable: VariableId
): ValidationResult {
  let entries: Array<{ date: unknown; value: unknown }>;

  if (typeof raw === 'string') {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    entries = [];
    for (const line of lines) {
      const [datePart, valuePart, ...extra] = line.split(/[,;]/);
      if (extra.length > 0 || datePart === undefined || valuePart === undefined) {
        return { ok: false, errorCode: 'invalid_format', detail: line };
      }
      entries.push({ date: datePart.trim(), value: valuePart.trim() });
    }
  } else if (Array.isArray(raw)) {
    if (raw.length > 20000) {
      return { ok: false, errorCode: 'too_many_points' };
    }
    entries = raw as Array<{ date: unknown; value: unknown }>;
  } else {
    return { ok: false, errorCode: 'invalid_format' };
  }

  if (entries.length > MAX_POINTS) {
    return { ok: false, errorCode: 'too_many_points' };
  }
  if (entries.length < MIN_POINTS) {
    return { ok: false, errorCode: 'too_few_points' };
  }

  const points: TimePoint[] = [];
  for (const entry of entries) {
    const date = typeof entry.date === 'string' ? entry.date : '';
    if (!isValidDate(date)) {
      return { ok: false, errorCode: 'invalid_date', detail: String(entry.date) };
    }
    const value = Number(entry.value);
    if (!Number.isFinite(value)) {
      return { ok: false, errorCode: 'invalid_value', detail: String(entry.value) };
    }
    if (!isWithinPhysicalRange(variable, value)) {
      return { ok: false, errorCode: 'out_of_range', detail: String(value) };
    }
    points.push({ date, value });
  }

  // Cronológico estricto: una serie con fechas duplicadas o desordenadas se rechaza.
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].date === sorted[i - 1].date) {
      return { ok: false, errorCode: 'invalid_date', detail: sorted[i].date };
    }
  }

  return { ok: true, points: sorted };
}
