import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { hashToken } from '@/lib/auth/password';

/**
 * Ingesta de telemetría del nodo ESP32 (series de tiempo).
 *
 * POST /api/station/telemetry
 *   Authorization: Bearer <token-de-estación>
 *   { "records": [{ "ts": <epoch-segundos>, "t"?: °C, "h"?: %, "p"?: hPa }] }
 *
 * Seguridad y saneamiento (nunca se confía en el cliente):
 *  - Auth por token Bearer; en la DB solo está su hash SHA-256.
 *  - Máx. 60 registros por lote (buffer de reconexión del ESP32).
 *  - Ventana temporal: [ahora - 7 días, ahora + 5 min] — nada del futuro
 *    ni histórico inventado.
 *  - Rangos físicos: t ∈ [-90, 60] °C, h ∈ [0, 100] %, p ∈ [300, 1100] hPa.
 *  - El registro queda UNVALIDATED hasta el cross-check con NASA (F3).
 *  - Marca la estación ONLINE + lastSeenAt.
 */

const MAX_BATCH = 60;
const MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutos de tolerancia de reloj

interface SanitizedRecord {
  timestamp: Date;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
}

function sanitizeRecords(
  raw: unknown,
  now: number
): { ok: true; records: SanitizedRecord[] } | { ok: false; errorCode: string } {
  if (!Array.isArray(raw)) return { ok: false, errorCode: 'records_not_array' };
  if (raw.length === 0) return { ok: false, errorCode: 'empty_batch' };
  if (raw.length > MAX_BATCH) return { ok: false, errorCode: 'batch_too_large' };

  const records: SanitizedRecord[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, errorCode: 'invalid_record' };
    }
    const rec = item as Record<string, unknown>;

    const ts = Number(rec.ts);
    if (!Number.isFinite(ts) || ts < 1_000_000_000) {
      return { ok: false, errorCode: 'invalid_timestamp' };
    }
    const tsMs = ts * 1000;
    if (tsMs < now - MAX_PAST_MS || tsMs > now + MAX_FUTURE_MS) {
      return { ok: false, errorCode: 'timestamp_out_of_window' };
    }

    let temperature: number | null = null;
    if (rec.t !== undefined && rec.t !== null) {
      const t = Number(rec.t);
      if (!Number.isFinite(t) || t < -90 || t > 60) {
        return { ok: false, errorCode: 'invalid_temperature' };
      }
      temperature = t;
    }

    let humidity: number | null = null;
    if (rec.h !== undefined && rec.h !== null) {
      const h = Number(rec.h);
      if (!Number.isFinite(h) || h < 0 || h > 100) {
        return { ok: false, errorCode: 'invalid_humidity' };
      }
      humidity = h;
    }

    let pressure: number | null = null;
    if (rec.p !== undefined && rec.p !== null) {
      const p = Number(rec.p);
      if (!Number.isFinite(p) || p < 300 || p > 1100) {
        return { ok: false, errorCode: 'invalid_pressure' };
      }
      pressure = p;
    }

    if (temperature === null && humidity === null && pressure === null) {
      return { ok: false, errorCode: 'empty_record' };
    }

    records.push({
      timestamp: new Date(tsMs),
      temperature,
      humidity,
      pressure
    });
  }

  return { ok: true, records };
}

export async function POST(request: NextRequest) {
  // --- Auth por Bearer token (no sesión: el ESP32 no tiene cookies). ---
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token.length < 32) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  const station = await prisma.station.findUnique({
    where: { tokenHash: hashToken(token) }
  });
  if (!station) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  // --- Body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_json' }, { status: 400 });
  }

  const rawRecords = (body as Record<string, unknown>)?.records;
  const sanitized = sanitizeRecords(rawRecords, Date.now());
  if (!sanitized.ok) {
    return NextResponse.json(
      { errorCode: sanitized.errorCode },
      { status: 400 }
    );
  }

  // --- Insertar (ordenado para que el índice [stationId, timestamp] sirva) ---
  sanitized.records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  await prisma.$transaction([
    prisma.telemetryRecord.createMany({
      data: sanitized.records.map((r) => ({
        stationId: station.id,
        timestamp: r.timestamp,
        temperature: r.temperature,
        humidity: r.humidity,
        pressure: r.pressure
      }))
    }),
    prisma.station.update({
      where: { id: station.id },
      data: { status: 'ONLINE', lastSeenAt: new Date() }
    })
  ]);

  return NextResponse.json(
    { accepted: sanitized.records.length },
    { status: 200 }
  );
}
