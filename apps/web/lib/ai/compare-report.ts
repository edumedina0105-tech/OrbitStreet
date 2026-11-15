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
    'You are the friendly narrator of OrbitStreet, a citizen-science tool',
    'about long-term trends in NASA Earth data. Two regions were compared',
    'with deterministic statistics (Mann-Kendall test, Sen slope per decade).',
    'STRICT RULES:',
    '1. Speak PLAINLY: your reader is a curious neighbor, not a scientist.',
    '2. Use at most 2 decimal places for any figure. The numbers below are',
    '   already rounded for you: quote them as-is, never re-calculate.',
    '3. Prefer everyday comparisons over raw numbers: say "a barely',
    '   noticeable change", "a clear warming", "slightly wetter" rather',
    '   than listing every figure. Mention each slope at most once.',
    '4. For significance, translate the p-value into plain words:',
    '   "statistically solid evidence" (p < 0.05) or "natural variability',
    '   cannot be ruled out yet" (p >= 0.05). Show the p-value in',
    '   parentheses at most once per region.',
    '5. If both trends point in opposite directions, note it as a striking',
    '   contrast and mention (hedged with "may", "suggests") that regional',
    '   climate patterns could be involved. NEVER claim causation.',
    '6. Skip the confidence intervals unless the contrast between regions',
    '   depends on them.',
    '7. Audience: high-school students. Warm, engaging detective tone.',
    '8. Maximum 110 words.',
    `9. Write the narration in ${language}.`,
    '',
    `JSON INPUT (already rounded): ${JSON.stringify({
      variable: data.variableLabel,
      season: data.seasonLabel,
      unit_per_decade: data.unit,
      region_a: data.regionA,
      region_a_change_per_decade: Number(data.slopeA.toFixed(2)),
      region_a_p_value: Number(data.pA.toFixed(3)),
      region_a_ci95: [Number(data.ciA[0].toFixed(2)), Number(data.ciA[1].toFixed(2))],
      region_b: data.regionB,
      region_b_change_per_decade: Number(data.slopeB.toFixed(2)),
      region_b_p_value: Number(data.pB.toFixed(3)),
      region_b_ci95: [Number(data.ciB[0].toFixed(2)), Number(data.ciB[1].toFixed(2))],
      divergence_rate_per_decade: Number(
        Math.abs(data.slopeA - data.slopeB).toFixed(2)
      )
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
