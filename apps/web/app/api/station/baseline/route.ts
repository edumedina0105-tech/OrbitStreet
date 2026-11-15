import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyTemperatureNormals } from '@/lib/power/climatology';

/**
 * Línea base NASA para el nodo en tierra (F3).
 *
 * GET /api/station/baseline?lat=-25.26&lon=-57.53
 *
 * Devuelve las 12 normales mensuales de temperatura (°C, NASA POWER /
 * MERRA-2). El ESP32 las guarda en LittleFS (baseline.json) y calcula
 * anomalías offline: tempMedida − normalDelMes.
 */

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get('lat'));
  const lon = Number(sp.get('lon'));

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ errorCode: 'invalid_latitude' }, { status: 400 });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json({ errorCode: 'invalid_longitude' }, { status: 400 });
  }

  try {
    const normals = await getMonthlyTemperatureNormals(lat, lon);
    return NextResponse.json(normals);
  } catch (error) {
    console.error('[BASELINE]', error);
    return NextResponse.json(
      { errorCode: 'power_unavailable' },
      { status: 502 }
    );
  }
}
