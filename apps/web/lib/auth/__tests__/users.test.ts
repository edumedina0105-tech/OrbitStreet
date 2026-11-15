import { describe, expect, it } from 'vitest';
import { validateDisplayName, validatePassword, validateUsername } from '../users';

describe('validateUsername (identidad simple: usuario + contraseña)', () => {
  it('normaliza a minúsculas y acepta letras, dígitos, . _ -', () => {
    expect(validateUsername('detective1')).toBe('detective1');
    expect(validateUsername('  Ana.Py_2026 ')).toBe('ana.py_2026');
    expect(validateUsername('abc-d')).toBe('abc-d');
  });

  it('rechaza muy cortos, muy largos o con caracteres no permitidos', () => {
    expect(validateUsername('ab')).toBeNull();
    expect(validateUsername('a'.repeat(31))).toBeNull();
    expect(validateUsername(' detective! ')).toBeNull(); // '!' no permitido
    expect(validateUsername('ana py')).toBeNull(); // espacios
    expect(validateUsername('')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('exige 8–200 caracteres', () => {
    expect(validatePassword('12345678')).toBe(true);
    expect(validatePassword('corta')).toBe(false);
  });
});

describe('validateDisplayName', () => {
  it('acepta 1–40 caracteres tras recortar', () => {
    expect(validateDisplayName(' Ana ')).toBe(true);
    expect(validateDisplayName('')).toBe(false);
    expect(validateDisplayName('x'.repeat(41))).toBe(false);
  });
});
