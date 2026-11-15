import { NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';

/**
 * GET /api/me/data — TODO lo subido por el usuario autenticado:
 * observaciones (con veredicto NASA), casos (con insignia) y series
 * comunitarias. Para gestionarlos (editar/eliminar) desde el perfil.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  const [observations, cases, series] = await Promise.all([
    prisma.observation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        variable: true,
        value: true,
        unit: true,
        observedAt: true,
        latitude: true,
        longitude: true,
        locationSource: true,
        inputMode: true,
        nasaCheckJson: true,
        createdAt: true
      }
    }),
    prisma.case.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        hypothesis: true,
        fieldNote: true,
        placeName: true,
        variable: true,
        season: true,
        periodStart: true,
        periodEnd: true,
        significant: true,
        slopePerDecade: true,
        createdAt: true,
        _count: { select: { confirmations: true } }
      }
    }),
    prisma.communitySeries.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        label: true,
        variable: true,
        unit: true,
        createdAt: true
      }
    })
  ]);

  return NextResponse.json({
    observations: observations.map((obs) => {
      const check = (obs.nasaCheckJson ?? {}) as {
        verdict?: string;
        bias?: number | null;
      };
      return {
        id: obs.id,
        variable: obs.variable,
        value: obs.value,
        unit: obs.unit,
        observedAt: obs.observedAt.toISOString().slice(0, 10),
        latitude: obs.latitude,
        longitude: obs.longitude,
        locationSource: obs.locationSource,
        inputMode: obs.inputMode,
        verdict: check.verdict ?? 'no_reference',
        bias: typeof check.bias === 'number' ? check.bias : null,
        createdAt: obs.createdAt.toISOString()
      };
    }),
    cases: cases.map((c) => ({
      id: c.id,
      hypothesis: c.hypothesis,
      fieldNote: c.fieldNote,
      placeName: c.placeName,
      variable: c.variable,
      season: c.season,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      significant: c.significant,
      slopePerDecade: c.slopePerDecade,
      unit: VARIABLE_CONFIG[c.variable as keyof typeof VARIABLE_CONFIG]?.unit ?? '',
      confirmations: c._count.confirmations,
      createdAt: c.createdAt.toISOString()
    })),
    series: series.map((s) => ({
      id: s.id,
      label: s.label,
      variable: s.variable,
      unit: s.unit,
      createdAt: s.createdAt.toISOString()
    }))
  });
}
