/**
 * Geolocalización honesta del navegador (wrapper de la Geolocation API).
 *
 * Jerarquía de ubicación para observaciones comunitarias:
 *   1. EXIF GPS de la foto (se parsea en el servidor, el usuario confirma)
 *   2. Geolocation API del navegador (este módulo, con permiso explícito)
 *   3. Punto seleccionado en el globo
 * La IP NUNCA es fuente de verdad: una VPN la derriba. Solo serviría como
 * señal auxiliar de inconsistencia, y ni siquiera la usamos aquí.
 */

export interface BrowserLocation {
  lat: number;
  lon: number;
  /** Radio de precisión en metros (para mostrarlo, no para ocultarlo). */
  accuracy: number;
}

export type BrowserLocationError =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export async function getBrowserLocation(
  timeoutMs = 10_000
): Promise<{ ok: true; location: BrowserLocation } | { ok: false; errorCode: BrowserLocationError }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ok: false, errorCode: 'unsupported' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          location: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        });
      },
      (error) => {
        const map: Record<number, BrowserLocationError> = {
          1: 'denied',
          2: 'unavailable',
          3: 'timeout'
        };
        resolve({ ok: false, errorCode: map[error.code] ?? 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
