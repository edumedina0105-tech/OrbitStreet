import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { isGeminiConfigured } from '@/lib/ai/gemini';
import { generateCompareNarration } from '@/lib/ai/compare-report';

/**
 * POST /api/compare-report  { comparison, locale }
 *
 * La IA interpreta la divergencia entre dos regiones SOLO CON LOS
 * NÚMEROS YA CALCULADOS por el motor determinista (pendientes de Sen,
 * p-valores, IC). Sin clave: 503 y el cliente muestra la frase
 * determinista i18n (que siempre está disponible).
 */

const MAX_BODY_BYTES = 2_048;

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ errorCode: 'ai_unavailable' }, { status: 503 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ errorCode: 'payload_too_large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
  }

  const input = body as {
    comparison?: Record<string, unknown>;
    locale?: unknown;
  };
  const locale = input.locale === 'en' ? 'en' : 'es';
  const c = input.comparison ?? {};

  // Solo cifras ya calculadas: se validan rangos, nada de texto libre al prompt.
  const numbers = {
    slopeA: Number(c.slopeA),
    pA: Number(c.pA),
    slopeB: Number(c.slopeB),
    pB: Number(c.pB)
  };
  for (const value of Object.values(numbers)) {
    if (!Number.isFinite(value)) {
      return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
    }
  }
  const ciA: [number, number] = [Number(c.ciALow), Number(c.ciAHigh)];
  const ciB: [number, number] = [Number(c.ciBLow), Number(c.ciBHigh)];
  if (ciA.some(Number.isNaN) || ciB.some(Number.isNaN)) {
    return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
  }

  const td = await getTranslations({
    locale,
    namespace: 'detective'
  });
  const regionA =
    typeof c.regionA === 'string' ? c.regionA.slice(0, 80) : 'Region A';
  const regionB =
    typeof c.regionB === 'string' ? c.regionB.slice(0, 80) : 'Region B';
  const variableLabel =
    typeof c.variable === 'string' && c.variable
      ? td(`variables.${c.variable}.label`)
      : 'variable';
  const seasonLabel =
    typeof c.season === 'string' && c.season
      ? td(`seasons.${c.season}`)
      : td('seasons.ALL');

  try {
    const text = await generateCompareNarration(
      {
        regionA,
        regionB,
        slopeA: numbers.slopeA,
        pA: numbers.pA,
        slopeB: numbers.slopeB,
        pB: numbers.pB,
        ciA,
        ciB,
        variableLabel,
        seasonLabel,
        unit: typeof c.unit === 'string' ? c.unit.slice(0, 8) : ''
      },
      locale
    );
    return NextResponse.json({ engine: 'gemini', text });
  } catch (error) {
    console.error(
      '[api/compare-report] Gemini falló:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { errorCode: 'narration_failed' },
      { status: 502 }
    );
  }
}
