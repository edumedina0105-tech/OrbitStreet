import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@orbitstreet/database';
import { getCurrentUser } from '@/lib/auth/session';
import { newSessionToken } from '@/lib/auth/password';

/**
 * Registro de estación IoT (nodo ESP32).
 *
 * POST /api/station/register (requiere sesión):
 *  { name, latitude, longitude, altitude?, sensorType?, deviceId? }
 *
 * El servidor genera un token de 256 bits, guarda SOLO su hash SHA-256
 * y devuelve el token en claro UNA ÚNICA VEZ. El usuario lo copia al
 * asistente del ESP32; si lo pierde, puede rotarlo re-registrando.
 *
 * Idempotencia por deviceId: si la estación ya existe y pertenece al
 * mismo usuario, se ACTUALIZA y se rota el token. Si pertenece a otro
 * usuario, se rechaza.
 */

const SENSOR_TYPES = ['bme280', 'dht11', 'dht22', 'b3950', 'none'] as const;

interface RegisterInput {
  name: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  sensorType?: string;
  deviceId?: string;
}

function validateRegisterInput(
  body: Record<string, unknown>
): { ok: true; input: RegisterInput } | { ok: false; errorCode: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) {
    return { ok: false, errorCode: 'invalid_name' };
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, errorCode: 'invalid_latitude' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, errorCode: 'invalid_longitude' };
  }

  let altitude: number | undefined;
  if (body.altitude !== undefined && body.altitude !== null) {
    const alt = Number(body.altitude);
    if (!Number.isFinite(alt) || alt < -500 || alt > 10000) {
      return { ok: false, errorCode: 'invalid_altitude' };
    }
    altitude = alt;
  }

  let sensorType: string | undefined;
  if (body.sensorType !== undefined && body.sensorType !== null) {
    const sensor = String(body.sensorType);
    if (!(SENSOR_TYPES as readonly string[]).includes(sensor)) {
      return { ok: false, errorCode: 'invalid_sensor_type' };
    }
    sensorType = sensor;
  }

  let deviceId: string | undefined;
  if (body.deviceId !== undefined && body.deviceId !== null) {
    const dev = String(body.deviceId).trim();
    if (dev.length < 1 || dev.length > 64) {
      return { ok: false, errorCode: 'invalid_device_id' };
    }
    deviceId = dev;
  }

  return {
    ok: true,
    input: { name, latitude, longitude, altitude, sensorType, deviceId }
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ errorCode: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: 'invalid_json' }, { status: 400 });
  }

  const validated = validateRegisterInput(body as Record<string, unknown>);
  if (!validated.ok) {
    return NextResponse.json(
      { errorCode: validated.errorCode },
      { status: 400 }
    );
  }
  const input = validated.input;

  // Idempotencia por deviceId: re-registrar rota el token del dueño.
  if (input.deviceId) {
    const existing = await prisma.station.findUnique({
      where: { deviceId: input.deviceId }
    });
    if (existing) {
      if (existing.userId && existing.userId !== user.id) {
        return NextResponse.json(
          { errorCode: 'device_taken' },
          { status: 409 }
        );
      }
      const rotated = newSessionToken();
      const updated = await prisma.station.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          altitude: input.altitude ?? existing.altitude,
          sensorType: input.sensorType ?? existing.sensorType,
          userId: user.id,
          tokenHash: rotated.tokenHash,
          status: 'PENDING'
        }
      });
      return NextResponse.json(
        {
          stationId: updated.id,
          token: rotated.token,
          rotated: true
        },
        { status: 200 }
      );
    }
  }

  const { token, tokenHash } = newSessionToken();
  const station = await prisma.station.create({
    data: {
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude: input.altitude,
      sensorType: input.sensorType,
      deviceId: input.deviceId,
      userId: user.id,
      tokenHash
    }
  });

  return NextResponse.json(
    { stationId: station.id, token, rotated: false },
    { status: 201 }
  );
}
