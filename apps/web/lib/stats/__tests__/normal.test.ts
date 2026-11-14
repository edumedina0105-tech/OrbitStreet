import { describe, expect, it } from 'vitest';
import { stdNormalCdf, stdNormalInverseCdf } from '../normal';

describe('stdNormalCdf', () => {
  it('F(0) = 0.5 (dentro del error documentado < 7.5e-8)', () => {
    expect(stdNormalCdf(0)).toBeCloseTo(0.5, 8);
  });

  it('F(1.96) ≈ 0.975 (error < 7.5e-8)', () => {
    expect(stdNormalCdf(1.96)).toBeCloseTo(0.9750021049, 5);
  });

  it('es simétrica: F(-z) = 1 - F(z)', () => {
    expect(stdNormalCdf(-1.96)).toBeCloseTo(1 - stdNormalCdf(1.96), 10);
  });
});

describe('stdNormalInverseCdf', () => {
  it('F⁻¹(0.975) ≈ 1.959964', () => {
    expect(stdNormalInverseCdf(0.975)).toBeCloseTo(1.9599639845, 5);
  });

  it('F⁻¹(0.8) ≈ 0.8416 (usado en "años necesarios")', () => {
    expect(stdNormalInverseCdf(0.8)).toBeCloseTo(0.8416212336, 6);
  });

  it('roundtrip F⁻¹(F(z)) ≈ z (límite: precisión de la CDF)', () => {
    for (const z of [-2.5, -1.23, 0, 0.7, 2.2]) {
      expect(stdNormalInverseCdf(stdNormalCdf(z))).toBeCloseTo(z, 4);
    }
  });

  it('es monótona', () => {
    let prev = -Infinity;
    for (let i = 1; i <= 99; i++) {
      const x = stdNormalInverseCdf(i / 100);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});
