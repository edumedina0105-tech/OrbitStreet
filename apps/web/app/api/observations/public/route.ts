import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';

/**
 * GET /api/observations/public[?lat=&lon=]
 *
 * Observaciones comunitarias PÚBLICAS (sin sesión):
 *  - `recent`: últimas 50 del planeta (para pines en el globo).
 *  - `nearby`: si viene lat/lon, las de la celda MERRA-2 de ese punto
 *    (±0.25° lat, ±0.3125° lon).
 * Se publican solo campos no sensibles: @usuario, variable, valor, fecha,
 * ubicación y veredicto del cross-check. Los datos comunitarios son
 * públicos por diseño (ciencia ciudadana) y siempre llevan su etiqueta.
 */

const PUBLIC_SELECT = {
  variable: true,
  value: true,
  unit: true,
  observedAt: true,
  latitude: true,
  longitude: true,
  locationSource: true,
  inputMode: true,
  nasaCheckJson: true,
  createdAt: true,
  user: { select: { username: true, displayName: true } }
} as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get('lat'));
  const lon = Number(sp.get('lon'));
  const hasCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;

  const [recent, nearby] = await Promise.all([
    prisma.observation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: PUBLIC_SELECT
    }),
    hasCoords
      ? prisma.observation.findMany({
          where: {
            latitude: { gte: lat - 0.25, lte: lat + 0.25 },
            longitude: { gte: lon - 0.3125, lte: lon + 0.3125 }
          },
          orderBy: { observedAt: 'desc' },
          take: 20,
          select: PUBLIC_SELECT
        })
      : Promise.resolve([])
  ]);

  const serialize = (rows: typeof recent) =>
    rows.map((row) => {
      const check = (row.nasaCheckJson ?? {}) as {
        verdict?: string;
        bias?: number | null;
      };
      return {
        username: row.user.username ?? row.user.displayName,
        variable: row.variable,
        value: row.value,
        unit: row.unit,
        observedAt: row.observedAt.toISOString().slice(0, 10),
        latitude: row.latitude,
        longitude: row.longitude,
        inputMode: row.inputMode,
        verdict: check.verdict ?? 'no_reference',
        bias: typeof check.bias === 'number' ? check.bias : null
      };
    });

  return NextResponse.json({
    recent: serialize(recent),
    nearby: serialize(nearby)
  });
}
