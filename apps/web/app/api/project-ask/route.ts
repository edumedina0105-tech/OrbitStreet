import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { isGeminiConfigured } from '@/lib/ai/gemini';
import {
  answerProjectQuestion,
  glossaryMatch,
  sanitizeQuestion
} from '@/lib/ai/project-qa';

/**
 * POST /api/project-ask  { question, locale }
 *
 * Tutor de metodología del proyecto:
 *  - Sin GEMINI_API_KEY: glosario determinista local (i18n, honesto).
 *  - Con GEMINI_API_KEY: Gemini responde con reglas duras (solo metodología,
 *    sin cifras); si falla, cae al mismo glosario local.
 */

const MAX_BODY_BYTES = 2_048;

export async function POST(request: NextRequest) {
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

  const input = body as { question?: unknown; locale?: unknown };
  const locale = input.locale === 'en' ? 'en' : 'es';
  const question = sanitizeQuestion(input.question);
  if (question.length < 3) {
    return NextResponse.json({ errorCode: 'invalid_question' }, { status: 400 });
  }

  const gemini = isGeminiConfigured();
  if (gemini) {
    try {
      const text = await answerProjectQuestion(question, locale);
      return NextResponse.json({ engine: 'gemini', aiAvailable: true, text });
    } catch (error) {
      // Registrar el motivo del fallo en los logs del deploy.
      console.error(
        '[api/project-ask] Gemini falló, usando glosario local:',
        error instanceof Error ? error.message : error
      );
    }
  }

  const tq = await getTranslations({ locale, namespace: 'home.map.qa' });
  return NextResponse.json({
    engine: 'template',
    aiAvailable: gemini,
    fallback: gemini,
    text: tq(glossaryMatch(question))
  });
}
