import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import {
  generateDetectiveReport,
  isGeminiConfigured
} from '@/lib/ai/gemini';
import { buildTemplateReport } from '@/lib/ai/template-report';
import { validateReportPayload } from '@/lib/ai/validation';

/**
 * POST /api/detective-report  { analysis, locale }
 *
 * Comportamiento según configuración (requisito del producto):
 *  - Sin GEMINI_API_KEY: la función de IA ni se intenta. Se devuelve el
 *    RESUMEN DETERMINISTA local (alternativa honesta, sin red ni IA).
 *  - Con GEMINI_API_KEY: Gemini SOLO redacta (recibe números ya calculados).
 *    Si falla o tarda, cae al mismo resumen local: nunca se miente.
 */

const MAX_BODY_BYTES = 4_096;

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ errorCode: 'payload_too_large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_payload' }, { status: 400 });
  }

  const input = body as { analysis?: unknown; locale?: unknown };
  const locale = input.locale === 'en' ? 'en' : 'es';

  const analysis = validateReportPayload(input.analysis);
  if (!analysis) {
    return NextResponse.json({ errorCode: 'invalid_payload' }, { status: 400 });
  }

  // Etiquetas traducidas por i18n (nada de texto libre del cliente al prompt).
  const td = await getTranslations({ locale, namespace: 'detective' });
  analysis.variableLabel = td(`variables.${analysis.variableId}.label`);
  analysis.seasonLabel = td(`seasons.${analysis.season}`);

  const tr = await getTranslations({ locale, namespace: 'detective.report' });

  // Sin clave configurada: alternativa determinista, sin llamar a la IA.
  if (!isGeminiConfigured()) {
    return NextResponse.json({
      engine: 'template',
      aiAvailable: false,
      text: buildTemplateReport(analysis, (key, values) => tr(key, values))
    });
  }

  try {
    const text = await generateDetectiveReport(analysis, locale);
    return NextResponse.json({ engine: 'gemini', aiAvailable: true, text });
  } catch {
    // Clave configurada pero Gemini falló: respaldo honesto.
    return NextResponse.json({
      engine: 'template',
      aiAvailable: true,
      fallback: true,
      text: buildTemplateReport(analysis, (key, values) => tr(key, values))
    });
  }
}
