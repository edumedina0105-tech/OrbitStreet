import { describe, expect, it } from 'vitest';
import { yearsNeeded } from '../years-needed';

describe('yearsNeeded', () => {
  it('calcula el ejemplo de referencia: pendiente 0.1 °C/año, σ = 1 → 785 años', () => {
    // z_{0.975} = 1.959964, z_{0.80} = 0.841621
    // n = ((1.959964 + 0.841621) · 1 / 0.1)² = 2.801585² = 784.89 → 785
    const result = yearsNeeded({ slopePerYear: 0.1, sigma: 1 });
    expect(result.years).toBe(785);
    expect(result.alpha).toBe(0.05);
    expect(result.power).toBe(0.8);
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
