import { NextRequest, NextResponse } from 'next/server';
import { prisma, type Prisma } from '@orbitstreet/database';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { checkUploadCooldown, DEFAULT_UPLOAD_COOLDOWN_MINUTES } from '@/lib/upload/cooldown';
import { analyzePowerLocation } from '@/lib/analysis/analyze-power';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';
import { YEARS_NEEDED_PRACTICAL_LIMIT } from '@orbitstreet/shared-types';
import { validateCaseInput } from '@/lib/cases/validation';
import { generateDetectiveReport, isGeminiConfigured } from '@/lib/ai/gemini';
import { buildTemplateReport } from '@/lib/ai/template-report';

/**
 * Casos del "Tablón de Casos del Detective".
 *
 * POST /api/cases (requiere sesión + cooldown): publica un expediente.
 *  1. Validación estricta (whitelists, rangos) en código.
 *  2. El análisis determinista se RECALCULA EN EL SERVIDOR con
 *     analyzePowerLocation: nunca se confía en cifras del navegador.
 *  3. La IA solo REDACTA la conclusión con los números ya calculados
 *     (plantilla determinista si no hay clave).
 * GET /api/cases (público): muro de casos con filtros.
 */

async function lastActivityOf(userId: string): Promise<Date | null> {
  const [lastCase, lastObservation, lastSeries] = await Promise.all([
    prisma.case.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.observation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    prisma.communitySeries.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
  ]);
  return [
    lastCase?.createdAt,
    lastObservation?.createdAt,
    lastSeries?.createdAt
  ]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errorCode: 'invalid_hypothesis' },
      { status: 400 }
    );
  }

  const validated = validateCaseInput(body as Record<string, unknown>);
  if (!validated.ok) {
    return NextResponse.json(
      { errorCode: validated.errorCode },
      { status: 400 }
    );
  }
  const input = validated.input;

  // Cooldown compartido con observaciones y series.
  const lastActivity = await lastActivityOf(user.id);
  const cooldown = checkUploadCooldown(
    lastActivity,
    Number.isFinite(user.uploadCooldownMinutes)
      ? user.uploadCooldownMinutes
      : DEFAULT_UPLOAD_COOLDOWN_MINUTES
  );
  if (!cooldown.allowed) {
    return NextResponse.json(
      { errorCode: 'cooldown', retryAfterSeconds: cooldown.retryAfterSeconds },
      { status: 429 }
    );
  }

  // RECALCULAR el análisis en el servidor: la fuente de verdad del caso.
  const start = `${input.startYear}0101`;
  const end = `${input.endYear}1231`;
  const analysis = await analyzePowerLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    variable: input.variable,
    season: input.season,
    start,
    end,
    locale: input.locale
  });

  // Conclusión: IA solo redacta (plantilla determinista como respaldo).
  const td = await getTranslations({
    locale: input.locale,
    namespace: 'detective'
  });
  const tr = await getTranslations({
    locale: input.locale,
    namespace: 'detective.report'
  });
  const yearsNeeded =
    Number.isFinite(analysis.years.years) &&
    analysis.years.years <= YEARS_NEEDED_PRACTICAL_LIMIT
      ? analysis.years.years
      : null;
  const reportAnalysis = {
    variableId: analysis.trend.variable,
    variableLabel: td(`variables.${analysis.trend.variable}.label`),
    season: analysis.trend.season,
    seasonLabel: td(`seasons.${analysis.trend.season}`),
    periodStart: String(input.startYear),
    periodEnd: String(input.endYear),
    slopePerDecade: analysis.trend.senSlopePerDecade,
    ciLow: analysis.trend.ci95PerDecade.lower,
    ciHigh: analysis.trend.ci95PerDecade.upper,
    pValue: analysis.trend.mannKendall.p,
    n: analysis.trend.n,
    significant: analysis.trend.significant,
    yearsNeeded
  };
  let aiConclusion: string;
  let aiEngine: 'gemini' | 'template' = 'template';
  if (isGeminiConfigured()) {
    try {
      aiConclusion = await generateDetectiveReport(
        reportAnalysis,
        input.locale
      );
      aiEngine = 'gemini';
    } catch (error) {
      console.error(
        '[api/cases] Gemini falló al redactar la conclusión, usando plantilla:',
        error instanceof Error ? error.message : error
      );
      aiConclusion = buildTemplateReport(reportAnalysis, (key, values) =>
        tr(key, values)
      );
    }
  } else {
    aiConclusion = buildTemplateReport(reportAnalysis, (key, values) =>
      tr(key, values)
    );
  }

  const created = await prisma.case.create({
    data: {
      userId: user.id,
      hypothesis: input.hypothesis,
      fieldNote: input.fieldNote,
      placeName: input.placeName,
      locale: input.locale,
      latitude: input.latitude,
      longitude: input.longitude,
      variable: input.variable,
      season: input.season,
      periodStart: String(input.startYear),
      periodEnd: String(input.endYear),
      resultJson: {
        trend: analysis.trend,
        sigma: analysis.sigma,
        yearsNeeded: analysis.years
      } as unknown as Prisma.InputJsonValue,
      significant: analysis.trend.significant,
      slopePerDecade: analysis.trend.senSlopePerDecade,
      aiConclusion
    }
  });

  return NextResponse.json(
    {
      case: {
        id: created.id,
        placeName: created.placeName,
        significant: created.significant,
        slopePerDecade: created.slopePerDecade,
        unit:
          VARIABLE_CONFIG[created.variable as keyof typeof VARIABLE_CONFIG]
            ?.unit ?? ''
      },
      aiEngine
    },
    { status: 201 }
  );
}

/**
 * GET /api/cases?variable=&significant=&q= (público)
 * Muro de casos: tarjetas con datos recalculados, insignias automáticas
 * y conteo de confirmaciones ciudadanas.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const variable = sp.get('variable');
  const significant = sp.get('significant');
  const q = sp.get('q')?.trim().slice(0, 100) ?? '';

  const cases = await prisma.case.findMany({
    where: {
      ...(variable ? { variable } : {}),
      ...(significant === 'true' || significant === 'false'
        ? { significant: significant === 'true' }
        : {}),
      ...(q
        ? {
            OR: [
              { hypothesis: { contains: q, mode: 'insensitive' } },
              { fieldNote: { contains: q, mode: 'insensitive' } },
              { placeName: { contains: q, mode: 'insensitive' } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      hypothesis: true,
      fieldNote: true,
      placeName: true,
      latitude: true,
      longitude: true,
      variable: true,
      season: true,
      periodStart: true,
      periodEnd: true,
      significant: true,
      slopePerDecade: true,
      aiConclusion: true,
      createdAt: true,
      resultJson: true,
      user: { select: { username: true, displayName: true } },
      _count: { select: { confirmations: true } }
    }
  });

  return NextResponse.json({
    cases: cases.map((row) => {
      const result = (row.resultJson ?? {}) as {
        trend?: { mannKendall?: { p?: number }; ci95PerDecade?: { lower?: number; upper?: number } };
      };
      return {
        id: row.id,
        hypothesis: row.hypothesis,
        fieldNote: row.fieldNote,
        placeName: row.placeName,
        latitude: row.latitude,
        longitude: row.longitude,
        variable: row.variable,
        season: row.season,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        significant: row.significant,
        slopePerDecade: row.slopePerDecade,
        unit:
          VARIABLE_CONFIG[row.variable as keyof typeof VARIABLE_CONFIG]?.unit ??
          '',
        pValue: result.trend?.mannKendall?.p ?? null,
        ci95: result.trend?.ci95PerDecade
          ? [
              result.trend.ci95PerDecade.lower ?? null,
              result.trend.ci95PerDecade.upper ?? null
            ]
          : null,
        aiConclusion: row.aiConclusion,
        username: row.user.username ?? row.user.displayName,
        confirmations: row._count.confirmations,
        createdAt: row.createdAt.toISOString()
      };
    })
  });
}
