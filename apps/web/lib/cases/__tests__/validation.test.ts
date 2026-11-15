import { describe, expect, it } from 'vitest';
import { validateCaseInput } from '../validation';

const VALID = {
  hypothesis: 'Los abuelos dicen que los veranos son cada vez más sofocantes',
  fieldNote:
    'En el barrio registramos noches por encima de 26 °C durante semanas seguidas.',
  placeName: 'Asunción',
  latitude: -25.26,
  longitude: -57.53,
  variable: 'T2M_MAX',
  season: 'SON',
  startYear: 1981,
  endYear: 2025,
  locale: 'es'
};

describe('validateCaseInput', () => {
  it('acepta un caso válido', () => {
    const result = validateCaseInput(VALID);
    expect(result.ok).toBe(true);
  });

  it('recorta espacios y normaliza locale', () => {
    const result = validateCaseInput({ ...VALID, locale: 'xyz' });
    expect(result.ok && result.input.locale).toBe('es');
  });

  it('rechaza hipótesis muy corta o muy larga', () => {
    expect(validateCaseInput({ ...VALID, hypothesis: 'corta' }).ok).toBe(false);
    expect(
      validateCaseInput({ ...VALID, hypothesis: 'x'.repeat(201) }).ok
    ).toBe(false);
  });

  it('rechaza notas de campo fuera de rango', () => {
    expect(
      validateCaseInput({ ...VALID, fieldNote: 'nota corta' }).ok
    ).toBe(false);
    expect(
      validateCaseInput({ ...VALID, fieldNote: 'x'.repeat(1001) }).ok
    ).toBe(false);
  });

  it('rechaza variables/estaciones fuera de whitelist', () => {
    expect(validateCaseInput({ ...VALID, variable: 'NO_EXISTE' }).ok).toBe(
      false
    );
    expect(validateCaseInput({ ...VALID, season: 'VERANO' }).ok).toBe(false);
  });

  it('rechaza periodos inválidos (antes de 1981, invertidos, futuros)', () => {
    expect(validateCaseInput({ ...VALID, startYear: 1900 }).ok).toBe(false);
    expect(
      validateCaseInput({ ...VALID, startYear: 2025, endYear: 2020 }).ok
    ).toBe(false);
    expect(
      validateCaseInput({
        ...VALID,
        endYear: new Date().getUTCFullYear() + 5
      }).ok
    ).toBe(false);
  });

  it('rechaza coordenadas imposibles', () => {
    expect(validateCaseInput({ ...VALID, latitude: 120 }).ok).toBe(false);
    expect(validateCaseInput({ ...VALID, longitude: -200 }).ok).toBe(false);
  });
});
