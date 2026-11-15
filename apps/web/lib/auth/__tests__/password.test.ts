import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword
} from '../password';

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('roundtrip: la contraseña correcta verifica, y el hash nunca contiene la contraseña', () => {
    const stored = hashPassword('orbiTrek2026!');
    expect(stored).not.toContain('orbiTrek2026!');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('orbiTrek2026!', stored)).toBe(true);
  });

  it('contraseña incorrecta → false', () => {
    const stored = hashPassword('correcta-clave-8');
    expect(verifyPassword('incorrecta-clave', stored)).toBe(false);
  });

  it('cada hash tiene sal única (dos hashes de la misma contraseña difieren)', () => {
    const a = hashPassword('misma-clave-secreta');
    const b = hashPassword('misma-clave-secreta');
    expect(a).not.toEqual(b);
    expect(verifyPassword('misma-clave-secreta', a)).toBe(true);
    expect(verifyPassword('misma-clave-secreta', b)).toBe(true);
  });

  it('hash corrupto o de otro esquema → false (sin lanzar excepción)', () => {
    expect(verifyPassword('x'.repeat(8), 'plaintext')).toBe(false);
    expect(verifyPassword('x'.repeat(8), 'bcrypt$abc$def')).toBe(false);
    expect(verifyPassword('x'.repeat(8), 'scrypt$solo-dos-partes')).toBe(false);
    expect(verifyPassword('x'.repeat(8), 'scrypt$salt$zzzz')).toBe(false);
  });
});

describe('tokens de sesión', () => {
  it('token aleatorio de 256 bits, distinto en cada generación', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a.token).toHaveLength(64); // 32 bytes en hex
    expect(a.token).not.toEqual(b.token);
  });

  it('el hash del token es determinista pero no reversible al token original', () => {
    const { token, tokenHash } = newSessionToken();
    expect(hashToken(token)).toEqual(tokenHash);
    expect(tokenHash).not.toEqual(token);
    expect(tokenHash).toHaveLength(64); // SHA-256 en hex
  });
});
