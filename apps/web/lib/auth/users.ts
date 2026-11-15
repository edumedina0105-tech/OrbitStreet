import { prisma } from '@orbitstreet/database';
import { hashPassword, verifyPassword } from './password';

/**
 * Registro y login de usuarios.
 * Identidad simple: usuario + contraseña (el correo NO es obligatorio).
 * Anti-abuso y seguridad:
 *  - Validación estricta de entradas (patrón de usuario, longitud, contraseña).
 *  - Mensajes de error genéricos en login (no revelan si la cuenta existe).
 *  - Rate limiting de subidas por cooldown (ver lib/upload).
 *  - Todo pasa por Prisma (parametrizado): sin SQL injection.
 * Compatibilidad: las cuentas heredadas (con email) siguen pudiendo
 * iniciar sesión con su email.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;

export type AuthErrorCode =
  | 'invalid_username'
  | 'username_taken'
  | 'invalid_email'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_name'
  | 'invalid_credentials';

export interface AuthResult {
  ok: boolean;
  errorCode?: AuthErrorCode;
  userId?: string;
}

/**
 * Nombre de usuario válido: 3–30 caracteres, minúsculas, con letras,
 * dígitos, punto, guion o guion bajo. Se normaliza a minúsculas.
 */
export function validateUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (username.length < 3 || username.length > 30) return null;
  if (!USERNAME_RE.test(username)) return null;
  return username;
}

export function validateEmail(email: string): boolean {
  return (
    email.length <= 120 &&
    email.length >= 5 &&
    EMAIL_RE.test(email)
  );
}

export function validatePassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}

export function validateDisplayName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 40;
}

/**
 * Registro simple: usuario + contraseña. El correo es opcional.
 * displayName por defecto = username (no se exige ningún campo extra).
 */
export async function registerUser(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  locale?: string;
}): Promise<AuthResult> {
  const username = validateUsername(input.username);
  if (!username) return { ok: false, errorCode: 'invalid_username' };

  if (!validatePassword(input.password)) {
    return { ok: false, errorCode: 'weak_password' };
  }

  let email: string | null = null;
  if (typeof input.email === 'string' && input.email.trim() !== '') {
    const candidate = input.email.trim().toLowerCase();
    if (!validateEmail(candidate)) {
      return { ok: false, errorCode: 'invalid_email' };
    }
    email = candidate;
  }

  const displayName =
    typeof input.displayName === 'string' && input.displayName.trim() !== ''
      ? input.displayName.trim()
      : username;
  if (!validateDisplayName(displayName)) {
    return { ok: false, errorCode: 'invalid_name' };
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashPassword(input.password),
        displayName,
        locale: input.locale === 'en' ? 'en' : 'es'
      }
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    // Unique constraint violado → usuario (o email) ya registrado.
    if (
      error instanceof Error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return { ok: false, errorCode: 'username_taken' };
    }
    throw error;
  }
}

/**
 * Login por nombre de usuario o (compatibilidad) email heredado.
 * Mensaje de error genérico exista o no la cuenta (no enumeration).
 */
export async function loginUser(
  identifier: string,
  password: string
): Promise<AuthResult> {
  const normalized = identifier.trim().toLowerCase();
  if (normalized === '' || typeof password !== 'string') {
    return { ok: false, errorCode: 'invalid_credentials' };
  }

  const user = normalized.includes('@')
    ? await prisma.user.findUnique({ where: { email: normalized } })
    : await prisma.user.findUnique({ where: { username: normalized } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, errorCode: 'invalid_credentials' };
  }

  return { ok: true, userId: user.id };
}
