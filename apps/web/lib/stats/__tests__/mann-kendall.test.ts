import { describe, expect, it } from 'vitest';
import { mannKendall, mannKendallHamedRao } from '../mann-kendall';
import { mulberry32 } from '../random';

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

describe('mannKendallHamedRao (corrección por autocorrelación)', () => {
  it('serie corta (n < 6) cae al Mann-Kendall clásico', () => {
    const x = [1, 2, 3, 4, 5];
    const hr = mannKendallHamedRao(x);
    expect(hr.varS).toBe(mannKendall(x).varS);
    expect(hr.varianceCorrection).toBe('ties');
  });

  it('con autocorrelación positiva, varS corregida > clásica (p menos optimista)', () => {
    // AR(1) con φ = 0.7 y tendencia suave: la autocorrelación de los
    // rangos infla la varianza de S; el p clásico sale demasiado pequeño.
    const rand = mulberry32(3);
    const n = 40;
    const x: number[] = [];
    let prev = 0;
    for (let i = 0; i < n; i++) {
      // Ruido ~gaussiano determinista (suma de 6 uniformes centradas).
      let e = 0;
      for (let k = 0; k < 6; k++) e += rand() - 0.5;
      prev = 0.7 * prev + e;
      x.push(prev + 0.05 * i);
    }
    const mk = mannKendall(x);
    const hr = mannKendallHamedRao(x);
    expect(hr.varS).toBeGreaterThan(mk.varS);
    expect(hr.p).toBeGreaterThanOrEqual(mk.p);
    expect(hr.varianceCorrection).toBe('hamed-rao');
  });

  it('con ruido blanco la corrección es leve (no inventa autocorrelación)', () => {
    const rand = mulberry32(77);
    const x = Array.from({ length: 50 }, () => {
      let e = 0;
      for (let k = 0; k < 6; k++) e += rand() - 0.5;
      return e + 0.03 * 25;
    });
    const mk = mannKendall(x);
    const hr = mannKendallHamedRao(x);
    // Ruido blanco: los lags del ACF caen casi todos bajo el umbral de
    // significancia; la corrección mueve varS menos de ±50%.
    expect(Math.abs(hr.varS - mk.varS)).toBeLessThan(0.5 * mk.varS);
  });
});
