import { prisma } from '@orbitstreet/database';
import { hashPassword, verifyPassword } from './password';

/**
 * Registro y login de usuarios.
 * Anti-abuso y seguridad:
 *  - Validación estricta de entradas (formato email, longitud, patrón).
 *  - Mensajes de error genéricos en login (no revelan si el email existe).
 *  - Rate limiting de subidas por cooldown (ver lib/upload).
 *  - Todo pasa por Prisma (parametrizado): sin SQL injection.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AuthErrorCode =
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

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  locale?: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  if (!validateEmail(email)) return { ok: false, errorCode: 'invalid_email' };
  if (!validatePassword(input.password))
    return { ok: false, errorCode: 'weak_password' };
  if (!validateDisplayName(input.displayName))
    return { ok: false, errorCode: 'invalid_name' };

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(input.password),
        displayName: input.displayName.trim(),
        locale: input.locale === 'en' ? 'en' : 'es'
      }
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    // Unique constraint violado → email ya registrado.
    if (
      error instanceof Error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return { ok: false, errorCode: 'email_taken' };
    }
    throw error;
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();

  if (!validateEmail(normalized) || typeof password !== 'string') {
    return { ok: false, errorCode: 'invalid_credentials' };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized }
  });

  // Mensaje genérico: mismo error exista o no el email (no enumeration).
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, errorCode: 'invalid_credentials' };
  }

  return { ok: true, userId: user.id };
}
