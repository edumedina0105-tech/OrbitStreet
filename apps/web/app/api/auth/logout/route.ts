import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/auth/session';

/** POST /api/auth/logout — cierra la sesión actual. */
export async function POST() {
  await destroyCurrentSession();
  return NextResponse.json({ ok: true });
}
