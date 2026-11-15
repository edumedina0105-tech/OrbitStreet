import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';

/**
 * POST /api/auth/login  { identifier, password }
 * identifier = nombre de usuario (o email de cuentas heredadas).
 * Respuesta genérica ante credenciales inválidas (sin enumerar usuarios).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  const input = body as {
    identifier?: unknown;
    email?: unknown;
    password?: unknown;
  };
  // "email" se acepta por compatibilidad con clientes previos.
  const identifier =
    typeof input.identifier === 'string'
      ? input.identifier
      : typeof input.email === 'string'
        ? input.email
        : '';
  if (identifier === '' || typeof input.password !== 'string') {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  const result = await loginUser(identifier, input.password);
  if (!result.ok || !result.userId) {
    return NextResponse.json({ errorCode: 'invalid_credentials' }, { status: 401 });
  }

  await createSession(result.userId);
  return NextResponse.json({ ok: true });
}
