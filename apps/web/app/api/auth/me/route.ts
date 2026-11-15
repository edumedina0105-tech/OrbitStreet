import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isGeminiConfigured } from '@/lib/ai/gemini';

/** GET /api/auth/me — usuario de la sesión actual (o null) + flags de IA. */
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
      : null,
    // ¿Hay IA de visión disponible? La pestaña "foto" del modal lo usa.
    aiAvailable: isGeminiConfigured()
  });
}
