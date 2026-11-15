import { OBSERVABLE_VARIABLES, withinPhysicalBounds } from '@/lib/observations/plausibility';

/**
 * Extracción de observaciones desde imágenes con Gemini (visión).
 *
 * Reglas de oro (respetadas por código, no solo por prompt):
 *  - La IA SOLO LEE la imagen y extrae {variable, valor, unidad, fecha,
 *    confianza, descripción}. NUNCA adjudica verdad ni calcula veredictos:
 *    eso lo hace el cross-check determinista contra la celda MERRA-2.
 *  - La respuesta se valida contra whitelist + rangos físicos ANTES de
 *    devolverse al cliente (mitiga alucinaciones fuera de rango).
 *  - El usuario siempre confirma/edita el valor extraído (humano en el loop).
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 20_000;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export interface ExtractedObservation {
  variable: string;
  value: number;
  unit: string;
  /** YYYY-MM-DD si era legible en la imagen; '' si no. */
  observedAt: string;
  /** Confianza declarada por la IA (0..1). */
  confidence: number;
  /** Qué ve en la imagen (para mostrar al usuario). */
  description: string;
  /** true si había una lectura legible; false = "no veo un dato". */
  hasReadout: boolean;
}

/** Magia de bytes mínima: JPEG/PNG/WEBP reales, no solo el Content-Type. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45
  ) {
    return 'image/webp';
  }
  return null;
}

/** Exportada para tests: el prompt acota el dominio y prohíbe adivinar. */
export function buildExtractionPrompt(canonicalUnits: Record<string, string>): string {
  return [
    'You are the instrument reader of OrbitStreet, a citizen-science app',
    'about climate trends. You receive a photo that may contain an',
    'environmental reading: a thermometer, a weather station screen, a',
    'sensor LCD, or a newspaper/climate report snippet.',
    'STRICT RULES:',
    '1. Read ONLY what is actually visible and legible. Never guess a',
    '   number that you cannot fully read.',
    '2. Report your own confidence honestly (0 to 1) and DESCRIBE what you',
    '   see (device type, screen, text around it).',
    '3. Convert the value to the canonical unit of the variable if needed.',
    `   Canonical units: ${Object.entries(canonicalUnits)
      .map(([v, u]) => `${v}=${u}`)
      .join(', ')}.`,
    '4. "variable" must be one of: T2M (mean temperature), T2M_MAX (max',
    '   temperature), T2M_MIN (min temperature), RH2M (relative humidity),',
    '   PRECTOTCORR (precipitation per day), PS (surface pressure).',
    '5. "observedAt": the date VISIBLE in the image (YYYY-MM-DD); empty',
    '   string if there is no legible date.',
    '6. "hasReadout": false if there is NO readable environmental value',
    '   in the image (photo of a cat, blurry screen). Do not invent one.',
    '7. A temperature in Fahrenheit must be converted to Celsius; pressure',
    '   in inHg to hPa. Describe the original unit in "description".',
    '',
    'Respond ONLY with the JSON object matching the given schema.'
  ].join('\n');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validación dura del resultado de la IA: whitelist, rangos, fecha. */
export function validateExtraction(raw: unknown): ExtractedObservation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const input = raw as Record<string, unknown>;

  if (input.hasReadout !== true) return null;

  const variable = typeof input.variable === 'string' ? input.variable : '';
  if (!OBSERVABLE_VARIABLES.includes(variable as never)) return null;

  const value = Number(input.value);
  if (!withinPhysicalBounds(variable, value)) return null;

  const unit = typeof input.unit === 'string' ? input.unit.slice(0, 12) : '';
  if (unit === '') return null;

  const observedAt = typeof input.observedAt === 'string' ? input.observedAt : '';
  if (observedAt !== '' && !DATE_RE.test(observedAt)) return null;
  if (observedAt !== '') {
    const year = Number(observedAt.slice(0, 4));
    const now = new Date().getUTCFullYear();
    if (year < 1981 || year > now + 1) return null;
  }

  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return null;
  }

  const description =
    typeof input.description === 'string'
      ? input.description.trim().slice(0, 400)
      : '';
  if (description.length < 3) return null;

  return {
    variable,
    value,
    unit,
    observedAt,
    confidence,
    description,
    hasReadout: true
  };
}

/** Esquema de respuesta estricto (responseSchema de Gemini). */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    variable: { type: 'STRING', enum: [...OBSERVABLE_VARIABLES] },
    value: { type: 'NUMBER' },
    unit: { type: 'STRING' },
    observedAt: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    description: { type: 'STRING' },
    hasReadout: { type: 'BOOLEAN' }
  },
  required: [
    'variable',
    'value',
    'unit',
    'observedAt',
    'confidence',
    'description',
    'hasReadout'
  ]
} as const;

export async function extractObservationFromImage(
  mimeType: string,
  base64Data: string,
  canonicalUnits: Record<string, string>
): Promise<ExtractedObservation> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

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
          {
            parts: [
              { text: buildExtractionPrompt(canonicalUnits) },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0
        }
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

  const extraction = validateExtraction(JSON.parse(text));
  if (!extraction) {
    throw new Error('Extracción inválida o ilegible');
  }
  return extraction;
}
