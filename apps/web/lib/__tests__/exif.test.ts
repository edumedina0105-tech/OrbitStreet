import { describe, expect, it } from 'vitest';
import { parseJpegExifGps } from '../exif';

/** Construye un JPEG mínimo con EXIF GPS (como lo escribe una cámara). */
function buildExifJpeg(little: boolean): Uint8Array {
  const w16 = (v: number) =>
    little ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff];
  const w32 = (v: number) =>
    little
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
      : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];

  const tiff: number[] = [];
  // Header TIFF: endian + 0x002A + offset de IFD0 (siempre 8)
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(0x2a), ...w32(8));

  const IFD0_ENTRIES = 1;
  const entrySize = 12;
  const ifd0Offset = 8;
  const ifd0Size = 2 + IFD0_ENTRIES * entrySize + 4;
  const gpsIfdOffset = ifd0Offset + ifd0Size;
  const GPS_ENTRIES = 4;
  const gpsDataOffset = gpsIfdOffset + 2 + GPS_ENTRIES * entrySize;
  const lonOffset = gpsDataOffset + 24;

  // IFD0
  tiff.push(...w16(IFD0_ENTRIES));
  // entry: tag GPSInfo (0x8825), type LONG(4), count 1, value = offset GPS IFD
  tiff.push(...w16(0x8825), ...w16(4), ...w32(1), ...w32(gpsIfdOffset));
  tiff.push(...w32(0)); // siguiente IFD = 0

  // GPS IFD
  tiff.push(...w16(GPS_ENTRIES));
  // latRef 'S' (ASCII inline) — entry EXIF = 12 bytes: tag+type+count+value(4)
  tiff.push(...w16(1), ...w16(2), ...w32(2), 0x53, 0x00, 0, 0);
  // lat RATIONAL×3 en gpsDataOffset (25° 15' 30" como en Asunción)
  tiff.push(...w16(2), ...w16(5), ...w32(3), ...w32(gpsDataOffset));
  // lonRef 'W'
  tiff.push(...w16(3), ...w16(2), ...w32(2), 0x57, 0x00, 0, 0);
  // lon RATIONAL×3 en lonOffset (57° 32' 0")
  tiff.push(...w16(4), ...w16(5), ...w32(3), ...w32(lonOffset));

  // Datos GPS: lat = [25, 15, 30], lon = [57, 32, 0]
  const rational = (num: number) => tiff.push(...w32(num), ...w32(1));
  [25, 15, 30].forEach(rational);
  [57, 32, 0].forEach(rational);

  // JPEG: SOI + APP1(size BIG-ENDIAN, siempre, según spec JPEG) + "Exif\0\0" + TIFF + EOI
  const app1Data = [
    ...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // "Exif\0\0"
    ...tiff
  ];
  const app1Size = app1Data.length + 2; // incluye los 2 bytes del tamaño
  const jpeg: number[] = [
    0xff, 0xd8,
    0xff, 0xe1,
    (app1Size >> 8) & 0xff, // tamaño del segmento: SIEMPRE big-endian
    app1Size & 0xff,
    ...app1Data,
    0xff, 0xd9
  ];
  return new Uint8Array(jpeg);
}

describe('parseJpegExifGps', () => {
  it('extrae el GPS de un JPEG little-endian (II)', () => {
    const gps = parseJpegExifGps(buildExifJpeg(true));
    expect(gps).not.toBeNull();
    expect(gps!.latitude).toBeCloseTo(-(25 + 15 / 60 + 30 / 3600), 6);
    expect(gps!.longitude).toBeCloseTo(-(57 + 32 / 60), 6);
  });

  it('extrae el GPS de un JPEG big-endian (MM)', () => {
    const gps = parseJpegExifGps(buildExifJpeg(false));
    expect(gps).not.toBeNull();
    expect(gps!.latitude).toBeCloseTo(-25.258333, 5);
  });

  it('devuelve null sin GPS, sin JPEG o corrupto', () => {
    expect(parseJpegExifGps(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])))
      .toBeNull();
    expect(parseJpegExifGps(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull();
    // APP1 Exif pero TIFF roto
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78]);
    expect(parseJpegExifGps(broken)).toBeNull();
  });
});