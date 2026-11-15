import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';

/**
 * POST /api/auth/register  { username, password, displayName?, email?, locale? }
 * Cuenta simple: usuario + contraseña (sin correo obligatorio) e inicia
 * sesión inmediatamente.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_username' }, { status: 400 });
  }

  const input = body as {
    username?: unknown;
    password?: unknown;
    displayName?: unknown;
    email?: unknown;
    locale?: unknown;
  };

  if (
    typeof input.username !== 'string' ||
    typeof input.password !== 'string'
  ) {
    return NextResponse.json({ errorCode: 'invalid_username' }, { status: 400 });
  }

  const result = await registerUser({
    username: input.username,
    password: input.password,
    displayName:
      typeof input.displayName === 'string' ? input.displayName : undefined,
    email: typeof input.email === 'string' ? input.email : undefined,
    locale: input.locale === 'en' ? 'en' : 'es'
  });

  if (!result.ok || !result.userId) {
    return NextResponse.json({ errorCode: result.errorCode }, { status: 400 });
  }

  await createSession(result.userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
