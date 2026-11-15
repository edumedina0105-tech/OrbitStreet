import type { ReportAnalysis } from './validation';

/**
 * Cliente de Gemini para el "informe del detective".
 *
 * Reglas de oro (respetadas por código, no solo por prompt):
 *  - La IA SOLO redacta: recibe números ya calculados por el motor
 *    determinista y devuelve texto. Jamás calcula cifras.
 *  - Si GEMINI_API_KEY no está configurada, esta función ni se llama:
 *    la interfaz ofrece el resumen determinista local como alternativa.
 *  - Si Gemini falla o tarda (timeout 15 s), el llamador cae al respaldo.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 15_000;

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length >= 10;
}

/** Exportada para tests: el prompt debe contener las reglas duras y SOLO los números dados. */
export function buildPrompt(analysis: ReportAnalysis, language: string): string {
  return [
    'You are the narrator of the "detective report" for OrbitStreet,',
    'a citizen-science tool about long-term trends in NASA Earth data.',
    'STRICT RULES:',
    '1. Use ONLY the numbers from the JSON below. Never calculate, round, or invent any figure.',
    '2. If a figure is missing, write "data not available" instead of guessing.',
    '3. Never claim causation from correlation.',
    '4. Never use weather-forecast language (like "it will rain tomorrow");',
    '   this is about long-term trends and background conditions.',
    '5. When mentioning the data source, say it is NASA POWER, a MERRA-2 reanalysis.',
    '6. Audience: high-school and college students. Plain, engaging language.',
    '7. Maximum 180 words.',
    `8. Write the report in ${language}.`,
    '',
    `JSON INPUT: ${JSON.stringify({
      variable: analysis.variableLabel,
      season: analysis.seasonLabel,
      period: `${analysis.periodStart}–${analysis.periodEnd}`,
      observations: analysis.n,
      sen_slope_per_decade: analysis.slopePerDecade,
      confidence_interval_95: [analysis.ciLow, analysis.ciHigh],
      mann_kendall_p_value: analysis.pValue,
      statistically_significant: analysis.significant,
      years_a_local_sensor_would_need: analysis.yearsNeeded
    })}`
  ].join('\n');
}

export async function generateDetectiveReport(
  analysis: ReportAnalysis,
  locale: 'en' | 'es'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const language = locale === 'en' ? 'English' : 'Spanish (es)';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(analysis, language) }] }]
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini respondió ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini devolvió una respuesta vacía');
  }

  return text;
}
