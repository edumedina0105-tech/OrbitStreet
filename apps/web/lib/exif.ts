/**
 * Parser EXIF mínimo (SOLO GPS) para JPEG — sin dependencias.
 *
 * Privacidad: se ejecuta en el servidor SOLO para ofrecer la ubicación de
 * la foto al usuario; la imagen original nunca se persiste (ver
 * /api/extract-observation). Recorre segmentos APP1 buscando "Exif\0\0",
 * luego el TIFF: IFD0 → tag GPSInfo (0x8825) → GPS IFD (latRef, lat, lonRef,
 * lon en grados/minutos/segundos racionales).
 */

export interface ExifGps {
  latitude: number;
  longitude: number;
}

export function parseJpegExifGps(bytes: Uint8Array): ExifGps | null {
  if (bytes.length < 16) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // no es JPEG

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // SOS: empiezan los datos de imagen
    if ((marker & 0xf8) === 0xe0 && marker !== 0xe1) break; // solo APP1 nos interesa
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) return null;
    if (marker === 0xe1) {
      const segStart = offset + 4;
      if (segStart + 6 <= bytes.length) {
        const exifId = String.fromCharCode(
          ...bytes.slice(segStart, segStart + 6)
        );
        if (exifId === 'Exif\0\0') {
          return parseTiffGps(bytes, segStart + 6);
        }
      }
    }
    offset += 2 + size;
  }
  return null;
}

function parseTiffGps(bytes: Uint8Array, tiffStart: number): ExifGps | null {
  if (tiffStart + 8 > bytes.length) return null;
  const endian = String.fromCharCode(bytes[tiffStart], bytes[tiffStart + 1]);
  const little = endian === 'II';
  if (!little && endian !== 'MM') return null;

  const read16 = (p: number) =>
    little
      ? bytes[p] | (bytes[p + 1] << 8)
      : (bytes[p] << 8) | bytes[p + 1];
  const read32 = (p: number) =>
    little
      ? ((bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0)
      : ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
  const readRational = (p: number) => {
    const denom = read32(p + 4);
    if (denom === 0) return 0;
    return read32(p) / denom;
  };

  // IFD0: buscar el tag GPSInfo (0x8825).
  const ifd0 = tiffStart + read32(tiffStart + 4);
  if (ifd0 + 2 > bytes.length) return null;
  const entries = read16(ifd0);
  let gpsRelative = -1;
  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > bytes.length) return null;
    if (read16(entry) === 0x8825) {
      gpsRelative = read32(entry + 8);
      break;
    }
  }
  if (gpsRelative < 0) return null;

  // GPS IFD: 1=latRef(ASCII), 2=lat(RATIONAL×3), 3=lonRef, 4=lon.
  const gps = tiffStart + gpsRelative;
  if (gps + 2 > bytes.length) return null;
  const gpsEntries = read16(gps);
  let latRef = '';
  let lonRef = '';
  let lat: [number, number, number] | null = null;
  let lon: [number, number, number] | null = null;

  for (let i = 0; i < gpsEntries; i++) {
    const entry = gps + 2 + i * 12;
    if (entry + 12 > bytes.length) return null;
    const tag = read16(entry);
    const type = read16(entry + 2);
    const count = read32(entry + 4);
    if (tag === 1 && type === 2 && count >= 1) {
      latRef = String.fromCharCode(bytes[entry + 8]);
    } else if (tag === 3 && type === 2 && count >= 1) {
      lonRef = String.fromCharCode(bytes[entry + 8]);
    } else if (tag === 2 && type === 5 && count === 3) {
      const p = tiffStart + read32(entry + 8);
      lat = [readRational(p), readRational(p + 8), readRational(p + 16)];
    } else if (tag === 4 && type === 5 && count === 3) {
      const p = tiffStart + read32(entry + 8);
      lon = [readRational(p), readRational(p + 8), readRational(p + 16)];
    }
  }

  if (!lat || !lon || !latRef || !lonRef) return null;

  const dms = (dms3: [number, number, number]) =>
    dms3[0] + dms3[1] / 60 + dms3[2] / 3600;

  let latitude = dms(lat);
  let longitude = dms(lon);
  if (latRef === 'S') latitude = -latitude;
  if (lonRef === 'W') longitude = -longitude;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}