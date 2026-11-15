import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';

/**
 * POST /api/auth/register  { email, password, displayName }
 * Crea la cuenta (hash scrypt) e inicia sesión inmediatamente.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_email' }, { status: 400 });
  }

  const input = body as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
    locale?: unknown;
  };

  if (
    typeof input.email !== 'string' ||
    typeof input.password !== 'string' ||
    typeof input.displayName !== 'string'
  ) {
    return NextResponse.json({ errorCode: 'invalid_email' }, { status: 400 });
  }

  const result = await registerUser({
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    locale: input.locale === 'en' ? 'en' : 'es'
  });

  if (!result.ok || !result.userId) {
    return NextResponse.json({ errorCode: result.errorCode }, { status: 400 });
  }

  await createSession(result.userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
