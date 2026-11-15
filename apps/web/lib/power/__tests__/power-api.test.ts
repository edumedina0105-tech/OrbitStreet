import { describe, expect, it } from 'vitest';
import {
  buildPowerDailyUrl,
  parsePowerDaily,
  splitRange
} from '../power-api';

describe('buildPowerDailyUrl', () => {
  it('construye la URL exacta del endpoint validado', () => {
    const url = buildPowerDailyUrl({
      latitude: -25.26,
      longitude: -57.53,
      parameter: 'T2M',
      start: '19810101',
      end: '19810105'
    });
    expect(url).toBe(
      'https://power.larc.nasa.gov/api/temporal/daily/point' +
        '?parameters=T2M&community=RE&longitude=-57.53&latitude=-25.26' +
        '&start=19810101&end=19810105&format=JSON'
    );
  });
});

describe('splitRange', () => {
  it('divide 1981–2025 en bloques de una década, sin huecos ni solapes', () => {
    const ranges = splitRange('19810101', '20251231');
    expect(ranges).toHaveLength(5);
    expect(ranges[0]).toEqual({ start: '19810101', end: '19901231' });
    expect(ranges[1]).toEqual({ start: '19910101', end: '20001231' });
    expect(ranges[4]).toEqual({ start: '20210101', end: '20251231' });
    // Continuidad: el bloque siguiente empieza justo después del anterior.
    for (let i = 1; i < ranges.length; i++) {
      expect(Number(ranges[i].start.slice(0, 4))).toBe(
        Number(ranges[i - 1].end.slice(0, 4)) + 1
      );
    }
  });

  it('un rango corto produce un único bloque', () => {
    expect(splitRange('20240101', '20240131')).toEqual([
      { start: '20240101', end: '20240131' }
    ]);
  });
});

describe('parsePowerDaily', () => {
  // Fixture con la forma REAL de la respuesta de POWER (verificada en vivo
  // contra la API: es un Feature suelto, no un FeatureCollection).
  const fixture = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-57.53, -25.26, 99.85] },
    properties: {
      parameter: {
        T2M: {
          '19810101': 30.52,
          '19810102': 29.77,
          '19810103': -999, // valor de relleno: dato faltante
          '19810104': 27.5
        }
      }
    },
    header: {
      title: 'NASA/POWER Source Native Resolution Daily Data',
      sources: ['MERRA2'],
      time_standard: 'LST',
      fill_value: -999.0
    }
  };

  it('parsea las fechas a ISO y descarta el relleno -999', () => {
    const points = parsePowerDaily(fixture, 'T2M');
    expect(points).toEqual([
      { date: '1981-01-01', value: 30.52 },
      { date: '1981-01-02', value: 29.77 },
      { date: '1981-01-04', value: 27.5 }
    ]);
  });

  it('también acepta la forma defensiva FeatureCollection', () => {
    const wrapped = { type: 'FeatureCollection', features: [fixture] };
    expect(parsePowerDaily(wrapped, 'T2M')).toEqual(
      parsePowerDaily(fixture, 'T2M')
    );
  });

  it('ordena cronológicamente aunque el JSON venga desordenado', () => {
    const unordered = {
      features: [
        {
          properties: {
            parameter: {
              T2M: { '19810203': 3, '19810101': 1, '19810115': 2 }
            }
          }
        }
      ]
    };
    const points = parsePowerDaily(unordered, 'T2M');
    expect(points.map((p) => p.date)).toEqual([
      '1981-01-01',
      '1981-01-15',
      '1981-02-03'
    ]);
  });

  it('lanza un error claro si falta el parámetro pedido', () => {
    expect(() => parsePowerDaily(fixture, 'RH2M')).toThrow(/RH2M/);
  });

  it('lanza un error claro ante un formato inesperado', () => {
    expect(() => parsePowerDaily({}, 'T2M')).toThrow(/formato inesperado/);
  });
});
