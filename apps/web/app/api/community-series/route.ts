import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import {
  listRecentCommunitySeries,
  uploadCommunitySeries
} from '@/lib/upload/community-series';

/**
 * GET  /api/community-series — últimas series comunitarias (público).
 * POST /api/community-series — sube una serie (requiere sesión + cooldown).
 */
export async function GET() {
  const series = await listRecentCommunitySeries(20);
  return NextResponse.json({ series });
}

export async function POST(request: NextRequest) {
  // 1. Autenticación: subir datos exige cuenta con contraseña (anti-bots).
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  // 2. Límite de tamaño del cuerpo: 1 MB (subida masiva, imposible de entrada).
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ errorCode: 'payload_too_large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
  }

  const input = body as {
    label?: unknown;
    variable?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    data?: unknown;
  };

  const result = await uploadCommunitySeries(user.id, user.uploadCooldownMinutes, {
    label: typeof input.label === 'string' ? input.label : '',
    variable: typeof input.variable === 'string' ? input.variable : '',
    latitude:
      input.latitude === null || input.latitude === undefined
        ? undefined
        : Number(input.latitude),
    longitude:
      input.longitude === null || input.longitude === undefined
        ? undefined
        : Number(input.longitude),
    data: input.data
  });

  if (!result.ok) {
    const status =
      result.errorCode === 'cooldown'
        ? 429
        : result.errorCode === 'invalid_label' ||
            result.errorCode === 'invalid_variable' ||
            result.errorCode === 'invalid_coords'
          ? 400
          : 400;
    return NextResponse.json(
      {
        errorCode: result.errorCode,
        retryAfterSeconds: result.retryAfterSeconds
      },
      {
        status,
        ...(result.errorCode === 'cooldown'
          ? { headers: { 'Retry-After': String(result.retryAfterSeconds ?? 60) } }
          : {})
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      seriesId: result.seriesId,
      analysis: result.analysis
        ? {
            n: result.analysis.trend.n,
            senSlopePerDecade: result.analysis.trend.senSlopePerDecade,
            ci95PerDecade: result.analysis.trend.ci95PerDecade,
            pValue: result.analysis.trend.mannKendall.p,
            trend: result.analysis.trend.mannKendall.trend,
            significant: result.analysis.trend.significant,
            yearsNeeded: result.analysis.years.years
          }
        : null
    },
    { status: 201 }
  );
}
