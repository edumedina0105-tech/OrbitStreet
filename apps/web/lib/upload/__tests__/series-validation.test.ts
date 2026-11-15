import { describe, expect, it } from 'vitest';
import {
  isWithinPhysicalRange,
  parseSeriesPayload
} from '../series-validation';

describe('parseSeriesPayload', () => {
  it('acepta CSV de una línea por día y lo ordena', () => {
    const csv =
      '2024-01-05,22.5\n2024-01-03,22.8\n2024-01-01,23.5\n2024-01-04,23.0\n2024-01-02,24.1';
    const result = parseSeriesPayload(csv, 'T2M');
    expect(result.ok).toBe(true);
    expect(result.points?.map((p) => p.date)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05'
    ]);
  });

  it('acepta arreglo JSON y descarta comentarios en CSV', () => {
    const json = [
      { date: '2024-01-01', value: 23.5 },
      { date: '2024-01-02', value: 24.1 },
      { date: '2024-01-03', value: 22.8 },
      { date: '2024-01-04', value: 23.0 },
      { date: '2024-01-05', value: 22.5 }
    ];
    const result = parseSeriesPayload(json, 'T2M');
    expect(result.ok).toBe(true);
    expect(result.points).toHaveLength(5);

    const csvWithComments = '# mi pluviómetro\n2024-01-01,5\n2024-01-02,0\n2024-01-03,12\n2024-01-04,3\n2024-01-05,1';
    const resultCsv = parseSeriesPayload(csvWithComments, 'PRECTOTCORR');
    expect(resultCsv.ok).toBe(true);
    expect(resultCsv.points).toHaveLength(5);
  });

  it('rechaza fecha inválida (formato, mes inexistente, duplicada)', () => {
    expect(parseSeriesPayload('2024-1-1,5\n' + '2024-01-02,5\n'.repeat(4).trim(), 'T2M').ok).toBe(false);
    expect(
      parseSeriesPayload('2024-13-01,5\n2024-01-02,5\n2024-01-03,5\n2024-01-04,5\n2024-01-05,5', 'T2M').errorCode
    ).toBe('invalid_date');
    // Duplicada:
    expect(
      parseSeriesPayload(
        '2024-01-01,5\n2024-01-01,5\n2024-01-02,5\n2024-01-03,5\n2024-01-04,5\n2024-01-05,5',
        'T2M'
      ).errorCode
    ).toBe('invalid_date');
  });

  it('rechaza valores no numéricos y fuera de rango físico', () => {
    const base = (value: string) =>
      `2024-01-01,${value}\n2024-01-02,5\n2024-01-03,5\n2024-01-04,5\n2024-01-05,5`;
    expect(parseSeriesPayload(base('abc'), 'T2M').errorCode).toBe('invalid_value');
    expect(parseSeriesPayload(base('500'), 'T2M').errorCode).toBe('out_of_range');
    expect(parseSeriesPayload(base('150'), 'RH2M').errorCode).toBe('out_of_range');
    // 150 mm/día de lluvia es extremo pero físicamente posible:
    expect(parseSeriesPayload(base('150'), 'PRECTOTCORR').ok).toBe(true);
  });

  it('rechaza series demasiado cortas o demasiado largas', () => {
    expect(parseSeriesPayload('2024-01-01,5', 'T2M').errorCode).toBe('too_few_points');
    const many = Array.from({ length: 5001 }, (_, i) => ({
      date: `2020-01-01`,
      value: i
    }));
    expect(parseSeriesPayload(many, 'T2M').errorCode).toBe('too_many_points');
  });

  it('rechaza formatos desconocidos', () => {
    expect(parseSeriesPayload(42, 'T2M').errorCode).toBe('invalid_format');
    expect(parseSeriesPayload(null, 'T2M').errorCode).toBe('invalid_format');
  });
});

describe('isWithinPhysicalRange', () => {
  it('temperaturas, humedad, presión y lluvia con rangos plausibles', () => {
    expect(isWithinPhysicalRange('T2M', -80)).toBe(true);
    expect(isWithinPhysicalRange('T2M', 75)).toBe(false);
    expect(isWithinPhysicalRange('RH2M', 100)).toBe(true);
    expect(isWithinPhysicalRange('RH2M', 101)).toBe(false);
    expect(isWithinPhysicalRange('PS', 850)).toBe(true);
    expect(isWithinPhysicalRange('PS', 100)).toBe(false);
    // Variable sin rango definido (derivada): solo exige número finito.
    expect(isWithinPhysicalRange('DAYS_ABOVE_THRESHOLD', 99999)).toBe(true);
  });
});
