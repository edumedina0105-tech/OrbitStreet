import { describe, expect, it } from 'vitest';
import { yearsNeeded } from '../years-needed';
import { mannKendall } from '../mann-kendall';
import { mulberry32 } from '../random';

describe('yearsNeeded', () => {
  it('calcula el ejemplo corregido: pendiente 0.1 °C/año, σ = 1 → 22 años', () => {
    // z_{0.975} = 1.959964, z_{0.80} = 0.841621
    // n = (√12 · 2.801585 · 1 / 0.1)^(2/3) = (97.05)^(2/3) ≈ 21.1 → 22
    // (fórmula de tendencia, potencia 2/3 — no la cuadrada de salto de media)
    const result = yearsNeeded({ slopePerYear: 0.1, sigma: 1 });
    expect(result.years).toBe(22);
    expect(result.alpha).toBe(0.05);
    expect(result.power).toBe(0.8);
  });

  it('detecta una tendencia en plazo realista: 0.04 °C/año con σ 0.7 → ~13 años', () => {
    // n = (√12 · 2.8016 · 0.7 / 0.04)^(2/3) = (169.8)^(2/3) ≈ 30.5 → 31
    const result = yearsNeeded({ slopePerYear: 0.04, sigma: 0.7 });
    expect(result.years).toBeLessThan(100);
    expect(result.years).toBeGreaterThan(5);
  });

  it('pendiente más fuerte requiere menos años', () => {
    const slow = yearsNeeded({ slopePerYear: 0.01, sigma: 1 });
    const fast = yearsNeeded({ slopePerYear: 0.1, sigma: 1 });
    expect(fast.years).toBeLessThan(slow.years);
  });

  it('más ruido (σ) requiere más años', () => {
    const calm = yearsNeeded({ slopePerYear: 0.1, sigma: 0.5 });
    const noisy = yearsNeeded({ slopePerYear: 0.1, sigma: 2 });
    expect(noisy.years).toBeGreaterThan(calm.years);
  });

  it('pendiente cero o sigma inválido → infinito (sin prometer nada)', () => {
    expect(yearsNeeded({ slopePerYear: 0, sigma: 1 }).years).toBe(
      Number.POSITIVE_INFINITY
    );
    expect(yearsNeeded({ slopePerYear: 0.1, sigma: 0 }).years).toBe(
      Number.POSITIVE_INFINITY
    );
  });
});

describe('yearsNeeded — validación Monte Carlo', () => {
  it('en el n recomendado, Mann-Kendall detecta la tendencia con potencia ≈ 80%', () => {
    const slopePerYear = 0.02;
    const sigma = 1.0;
    const { years: n } = yearsNeeded({ slopePerYear, sigma });
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(200);

    // Ruido gaussiano determinista (Box-Muller con mulberry32).
    const rand = mulberry32(2026);
    const gaussian = (): number => {
      const u1 = Math.max(rand(), 1e-12);
      const u2 = rand();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    const sims = 400;
    let detected = 0;
    for (let s = 0; s < sims; s++) {
      const x = Array.from(
        { length: n },
        (_, i) => slopePerYear * i + sigma * gaussian()
      );
      if (mannKendall(x).p < 0.05) detected++;
    }
    const power = detected / sims;
    // La fórmula se deriva para el test t de la pendiente OLS
    // (Var(β̂) ≈ 12σ²/n³); Mann-Kendall tiene eficiencia asintótica
    // ≈ 0.98 frente a él en ruido gaussiano. La tasa de detección debe
    // caer cerca del 80% buscado (banda generosa por ruido de la MC).
    expect(power).toBeGreaterThan(0.6);
    expect(power).toBeLessThan(0.95);
  });
});
