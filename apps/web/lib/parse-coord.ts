/**
 * Parsea una coordenada escrita por un usuario o llegada por URL.
 *
 * Acepta coma decimal (formato español: "-23,6879") además del punto,
 * devolviendo NaN si el valor no es numérico. Así el Modo Detective,
 * el mapa y el API no rechazan coordenadas perfectamente válidas por
 * culpa del separador regional.
 */
export function parseCoordinate(
  value: string | number | null | undefined
): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = String(value).trim().replace(',', '.');
  if (raw === '' || raw === '.') return NaN;
  return Number(raw);
}
