import { cookies } from 'next/headers';
import { prisma } from '@orbitstreet/database';
import { hashToken, newSessionToken } from './password';

/**
 * Sesiones con cookie httpOnly + tabla Session en PostgreSQL.
 * Seguridad:
 *  - La cookie lleva el token; la DB guarda solo su hash SHA-256.
 *  - httpOnly (inaccesible a JS del navegador), SameSite=Lax (mitiga CSRF),
 *    Secure en producción.
 *  - Todas las consultas pasan por Prisma: consultas parametrizadas,
 *    inmunes a SQL injection por diseño.
 */

const SESSION_COOKIE = 'orbitstreet_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  /** Identidad simple: usuario; el email es opcional/heredado. */
  username: string | null;
  email: string | null;
  displayName: string;
  locale: string;
  uploadCooldownMinutes: number;
}

export async function createSession(userId: string): Promise<void> {
  const { token, tokenHash } = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { id: tokenHash, userId, expiresAt }
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          locale: true,
          uploadCooldownMinutes: true
        }
      }
    }
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  return session.user;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    // Borrar la fila aunque expire la cookie: higiene de sesiones.
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}
