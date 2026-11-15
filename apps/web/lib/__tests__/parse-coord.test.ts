import { describe, expect, it } from 'vitest';
import { parseCoordinate } from '../parse-coord';

describe('parseCoordinate', () => {
  it('acepta coma decimal en formato español ("-23,6879")', () => {
    expect(parseCoordinate('-23,6879')).toBe(-23.6879);
    expect(parseCoordinate('-57,53')).toBe(-57.53);
  });

  it('acepta punto decimal y números nativos', () => {
    expect(parseCoordinate('-23.6879')).toBe(-23.6879);
    expect(parseCoordinate(19.4326)).toBe(19.4326);
    expect(parseCoordinate(' 40.4168 ')).toBe(40.4168);
  });

  it('devuelve NaN para basura, vacío y ausencias', () => {
    expect(parseCoordinate('abc')).toBeNaN();
    expect(parseCoordinate('')).toBeNaN();
    expect(parseCoordinate(',')).toBeNaN();
    expect(parseCoordinate(undefined)).toBeNaN();
    expect(parseCoordinate(null)).toBeNaN();
    expect(Number.NaN).toBeNaN();
  });
});
