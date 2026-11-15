import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';

/**
 * Hash de contraseñas con scrypt (criptografía estándar de Node, sin
 * dependencias externas) y verificación en tiempo constante.
 * Formato almacenado: scrypt$<salt-hex>$<hash-hex>
 */

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }; // 2^14: ~50 ms por hash

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString(
    'hex'
  );
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;

  let expected: Buffer;
  try {
    expected = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const candidate = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  // timingSafeEqual exige igual longitud: ya validada arriba.
  return timingSafeEqual(candidate, expected);
}

/** Token de sesión aleatorio (256 bits) + su hash SHA-256 para la DB. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

/** En la base de datos jamás se guarda el token en claro. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
