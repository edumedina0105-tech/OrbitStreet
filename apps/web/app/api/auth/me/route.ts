import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

/** GET /api/auth/me — usuario de la sesión actual (o null). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          uploadCooldownMinutes: user.uploadCooldownMinutes
        }
      : null
  });
}
