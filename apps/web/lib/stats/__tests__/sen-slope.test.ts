import { describe, expect, it } from 'vitest';
import { median, senSlope, senSlopeWithCI } from '../sen-slope';
import { mulberry32 } from '../random';

describe('median', () => {
  it('impar: mediana exacta', () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it('par: promedio de los centrales', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('senSlope', () => {
  it('recupera pendiente exacta de serie lineal (y = x)', () => {
    expect(senSlope(Array.from({ length: 100 }, (_, i) => i))).toBe(1);
  });

  it('recupera pendiente exacta de y = 2x + 5', () => {
    expect(
      senSlope(Array.from({ length: 100 }, (_, i) => 2 * i + 5))
    ).toBe(2);
  });

  it('es robusta al ruido: pendiente real 0.5 con ruido ±5', () => {
    const rand = mulberry32(7);
    const x = Array.from(
      { length: 60 },
      (_, i) => 0.5 * i + (rand() * 10 - 5)
    );
    const slope = senSlope(x);
    expect(slope).toBeGreaterThan(0.3);
    expect(slope).toBeLessThan(0.7);
  });
});

describe('senSlopeWithCI', () => {
  it('IC excluye el 0 y rodea a la pendiente (serie con ruido determinista)', () => {
    const rand = mulberry32(5);
    const result = senSlopeWithCI(
      Array.from({ length: 50 }, (_, i) => 3 * i + rand() * 2)
    );
    expect(result.ci95.lower).toBeGreaterThan(0);
    expect(result.ci95.lower).toBeLessThan(result.slope);
    expect(result.ci95.upper).toBeGreaterThan(result.slope);
  });

  it('IC por debajo de 0 para tendencia decreciente clara', () => {
    const result = senSlopeWithCI(
      Array.from({ length: 50 }, (_, i) => 50 - 2 * i)
    );
    expect(result.ci95.upper).toBeLessThan(0);
  });

  it('es determinista: misma entrada → mismo IC (sin aleatoriedad)', () => {
    const rand = mulberry32(99);
    const x = Array.from({ length: 40 }, (_, i) => 0.1 * i + rand());
    const a = senSlopeWithCI(x);
    const b = senSlopeWithCI(x);
    expect(a.ci95.lower).toBe(b.ci95.lower);
    expect(a.ci95.upper).toBe(b.ci95.upper);
    expect(a.slope).toBe(b.slope);
  });
});
