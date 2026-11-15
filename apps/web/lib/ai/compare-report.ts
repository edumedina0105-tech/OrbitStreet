import type { ReportAnalysis } from './validation';

/**
 * Narración de la comparación de regiones para Gemini.
 *
 * Reglas de oro (respetadas por código, no solo por prompt):
 *  - La IA SOLO REDACTA: recibe las pendientes/p-valores ya calculados
 *    por el motor determinista y explica qué podría significar la
 *    divergencia. Jamás calcula ni inventa cifras.
 *  - Prohibido afirmar causalidad: la divergencia se describe como
 *    patrón observado, no como causa explicada.
 */

const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 15_000;

/** Exportada para tests: el prompt acota el dominio y prohíbe inventar. */
export function buildComparePrompt(
  data: {
    regionA: string;
    regionB: string;
    slopeA: number;
    pA: number;
    slopeB: number;
    pB: number;
    ciA: [number, number];
    ciB: [number, number];
    variableLabel: string;
    seasonLabel: string;
    unit: string;
  },
  language: string
): string {
  return [
    'You are the narrator of OrbitStreet, a citizen-science tool about',
    'long-term trends in NASA Earth data. Two regions were compared with',
    'deterministic statistics (Mann-Kendall test, Sen slope per decade).',
    'STRICT RULES:',
    '1. Use ONLY the numbers in the JSON below. Never calculate, round, or invent figures.',
    '2. Never claim causation from correlation: describe the divergence as an',
    '   observed pattern, not an explained cause.',
    '3. You may briefly note what opposite trends in nearby regions could',
    '   relate to (regional climate patterns), always hedged with "may",',
    '   "suggests", "is consistent with".',
    '4. If a p-value is >= 0.05, say honestly that the trend is not',
    '   statistically significant.',
    '5. Audience: high-school and college students. Plain, engaging language.',
    '6. Maximum 130 words.',
    `7. Write the narration in ${language}.`,
    '',
    `JSON INPUT: ${JSON.stringify({
      variable: data.variableLabel,
      season: data.seasonLabel,
      unit_per_decade: data.unit,
      region_a: data.regionA,
      region_a_sen_slope_per_decade: data.slopeA,
      region_a_ci95: data.ciA,
      region_a_p_value: data.pA,
      region_b: data.regionB,
      region_b_sen_slope_per_decade: data.slopeB,
      region_b_ci95: data.ciB,
      region_b_p_value: data.pB,
      divergence_rate_per_decade: Math.abs(data.slopeA - data.slopeB)
    })}`
  ].join('\n');
}

export async function generateCompareNarration(
  data: Parameters<typeof buildComparePrompt>[0],
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
        contents: [
          { parts: [{ text: buildComparePrompt(data, language) }] }
        ],
        generationConfig: { temperature: 0.4 }
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }
  );

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // sin cuerpo legible
    }
    throw new Error(`Gemini respondió ${response.status}: ${detail}`);
  }

  const parsed = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = parsed.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini devolvió una respuesta vacía');
  }
  return text;
}
