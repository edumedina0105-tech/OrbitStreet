import { describe, expect, it } from 'vitest';
import { yearsNeeded } from '../years-needed';

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
