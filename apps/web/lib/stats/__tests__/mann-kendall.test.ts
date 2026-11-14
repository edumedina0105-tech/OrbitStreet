import { describe, expect, it } from 'vitest';
import { mannKendall } from '../mann-kendall';

describe('mannKendall', () => {
  it('calcula S correcto a mano para [5,3,4,1,2] (S = -6)', () => {
    const result = mannKendall([5, 3, 4, 1, 2]);
    // Pares negativos: 8; positivos: 2 → S = -6.
    expect(result.s).toBe(-6);
  });

  it('corrige la varianza por empates ([1,1,2,2,3,3] → varS = 456/18)', () => {
    const result = mannKendall([1, 1, 2, 2, 3, 3]);
    // n=6, tres grupos de 2 → término de empates 3·(2·1·9) = 54.
    // varS = (6·5·17 - 54)/18 = 456/18 ≈ 25.3333.
    expect(result.varS).toBeCloseTo(456 / 18, 10);
  });

  it('detecta tendencia creciente fuerte (0..39) con p ≈ 0', () => {
    const result = mannKendall(Array.from({ length: 40 }, (_, i) => i));
    expect(result.trend).toBe('increasing');
    expect(result.z).toBeGreaterThan(5);
    expect(result.p).toBeLessThan(1e-10);
  });

  it('detecta tendencia decreciente', () => {
    const result = mannKendall(Array.from({ length: 40 }, (_, i) => 100 - i));
    expect(result.trend).toBe('decreasing');
    expect(result.z).toBeLessThan(-5);
  });

  it('serie constante → sin tendencia, p = 1', () => {
    const result = mannKendall([5, 5, 5, 5, 5]);
    expect(result.s).toBe(0);
    expect(result.z).toBe(0);
    expect(result.p).toBe(1);
    expect(result.trend).toBe('no-trend');
  });

  it('es determinista: mismas entradas, mismo resultado', () => {
    const x = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    expect(mannKendall(x)).toEqual(mannKendall(x));
  });
});
