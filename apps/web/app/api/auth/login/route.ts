import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';

/**
 * POST /api/auth/login  { email, password }
 * Respuesta genérica ante credenciales inválidas (sin enumerar usuarios).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  const input = body as { email?: unknown; password?: unknown };
  if (typeof input.email !== 'string' || typeof input.password !== 'string') {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  const result = await loginUser(input.email, input.password);
  if (!result.ok || !result.userId) {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  await createSession(result.userId);
  return NextResponse.json({ ok: true });
}
