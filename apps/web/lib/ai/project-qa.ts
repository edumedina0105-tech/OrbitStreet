/**
 * Tutor de metodología de OrbitStreet ("Preguntar a la IA").
 *
 * Reglas de oro (respetadas por código, no solo por prompt):
 *  - Responde SOLO sobre el proyecto y su metodología; no consulta datos
 *    de lugares ni calcula cifras (eso lo hace el motor determinista).
 *  - Sin GEMINI_API_KEY: glosario determinista local por palabras clave
 *    (i18n), como alternativa honesta — nunca se disimula el motor usado.
 *  - La pregunta se sanitiza (longitud y saltos de línea) antes de entrar
 *    al prompt para reducir inyección de instrucciones.
 */

const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 15_000;

/** Exportada para tests: el prompt debe acotar el dominio y el idioma. */
export function buildProjectQaPrompt(question: string, language: string): string {
  return [
    'You are the methodology tutor of OrbitStreet, a citizen-science web app',
    'that analyzes long-term trends in NASA POWER data (MERRA-2 reanalysis)',
    'with deterministic statistics, and compares them with ground IoT nodes.',
    'STRICT RULES:',
    '1. Answer ONLY questions about this project and its methodology: the',
    '   statistical concepts, the data sources, the app workflow, the science.',
    '2. You have NO access to measurements or computed results. If the user',
    '   asks about specific data or a specific place, explain HOW the app',
    '   answers that (which tools to use) instead of inventing figures.',
    '3. Never invent numbers, dates or API responses.',
    '4. Key facts you may teach: data source NASA POWER (MERRA-2 reanalysis,',
    '   grid cells of 0.5 degrees latitude x 0.625 degrees longitude, roughly',
    '   50x70 km, daily data since 1981); the Mann-Kendall test is a',
    '   non-parametric test for trend detection; p-value < 0.05 means the',
    "   trend is statistically significant; Sen's slope is a robust estimator",
    '   of trend magnitude (median of pairwise slopes); the 95% confidence',
    '   interval comes from a deterministic bootstrap; the difference between',
    '   a ~50 km satellite cell and a street is exactly why ground nodes',
    '   exist: they validate the cell locally, day by day.',
    '5. Audience: high-school and college students. Plain, engaging language.',
    '6. Maximum 120 words.',
    `7. Write the answer in ${language}.`,
    '',
    `USER QUESTION: ${question}`
  ].join('\n');
}

/** Sanitiza la pregunta: un solo renglón, sin espacios extremos, acotada. */
export function sanitizeQuestion(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 300);
}

export async function answerProjectQuestion(
  question: string,
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
        contents: [{ parts: [{ text: buildProjectQaPrompt(question, language) }] }]
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }
  );

  if (!response.ok) {
    // Motivo del fallo visible en los logs (clave, cuota, modelo...).
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // sin cuerpo legible
    }
    throw new Error(`Gemini respondió ${response.status}: ${detail}`);
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

/**
 * Glosario determinista (respaldo sin IA): mapea la pregunta a una clave
 * i18n de home.map.qa por palabras clave. Exportada para tests.
 */
const GLOSSARY: Array<{ re: RegExp; key: string }> = [
  { re: /mann[- ]?kendall|prueba de tendencia|trend test/i, key: 'answerMannKendall' },
  {
    re: /\bsen\b|pendiente de sen|sen'?s slope|\bslope\b|pendiente/i,
    key: 'answerSen'
  },
  {
    re: /merra|celda|rejilla|resoluci|sat[eé]lite|power|rean[aá]lisis|grid/i,
    key: 'answerMerra'
  },
  { re: /valor\s*p|p-?value|\bp\b.*significan/i, key: 'answerPValue' },
  { re: /intervalo|confianza|bootstrap|\bci\b|\bic\b/i, key: 'answerCI' },
  { re: /a[ñn]os|sensor|nodo|tardar[aí]?|horizonte|red de/i, key: 'answerYears' }
];

export function glossaryMatch(question: string): string {
  for (const entry of GLOSSARY) {
    if (entry.re.test(question)) return entry.key;
  }
  return 'answerDefault';
}
