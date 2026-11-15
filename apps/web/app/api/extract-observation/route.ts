import { NextRequest, NextResponse } from 'next/server';
import { parseJpegExifGps } from '@/lib/exif';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';
import { OBSERVABLE_VARIABLES } from '@/lib/observations/plausibility';
import { isGeminiConfigured } from '@/lib/ai/gemini';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extractObservationFromImage
} from '@/lib/ai/extract-observation';

/**
 * POST /api/extract-observation (multipart/form-data, campo "image")
 *
 * Lee una foto de una lectura ambiental con IA de visión y devuelve:
 *  - extraction: { variable, value, unit, observedAt, confidence, description }
 *    (validada contra whitelist + rangos físicos ANTES de responder).
 *  - exifGps: GPS del EXIF si existe y es válido — se ofrece al usuario,
 *    que confirma; la imagen NUNCA se persiste (solo se lee en memoria).
 *
 * Sin GEMINI_API_KEY: 503 { errorCode: 'ai_unavailable' } (la pestaña foto
 * se oculta en el cliente; el modo manual siempre está disponible).
 */

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ errorCode: 'ai_unavailable' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
  }

  const file = form.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ errorCode: 'invalid_format' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ errorCode: 'payload_too_large' }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Magia de bytes: el Content-Type se puede falsificar.
  const sniffed = (() => {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0x52 && bytes[8] === 0x57) return 'image/webp';
    return null;
  })();
  const mimeType =
    sniffed && ALLOWED_IMAGE_TYPES.includes(sniffed as never)
      ? sniffed
      : file.type && ALLOWED_IMAGE_TYPES.includes(file.type as never)
        ? file.type
        : null;
  if (!mimeType) {
    return NextResponse.json({ errorCode: 'bad_image_type' }, { status: 400 });
  }

  // GPS del EXIF (solo JPEG): se ofrece como opción de ubicación, no se impone.
  const exifGps =
    mimeType === 'image/jpeg' ? parseJpegExifGps(bytes) : null;

  const canonicalUnits: Record<string, string> = {};
  for (const id of OBSERVABLE_VARIABLES) {
    canonicalUnits[id] = VARIABLE_CONFIG[id].unit;
  }

  try {
    const base64 = Buffer.from(bytes).toString('base64');
    const extraction = await extractObservationFromImage(
      mimeType,
      base64,
      canonicalUnits
    );
    return NextResponse.json({
      engine: 'gemini',
      extraction,
      exifGps
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('ilegible')) {
      // La IA no vio una lectura legible: no es error del servidor.
      return NextResponse.json({ errorCode: 'no_readout' }, { status: 422 });
    }
    return NextResponse.json({ errorCode: 'extraction_failed' }, { status: 502 });
  }
}