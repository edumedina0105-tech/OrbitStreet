import { describe, expect, it } from 'vitest';
import { benjaminiHochberg } from '../fdr';

describe('benjaminiHochberg', () => {
  it('ajusta los valores p del ejemplo clásico', () => {
    // p = [0.01, 0.02, 0.03, 0.4], m = 4
    // k=4: 0.4·4/4 = 0.4 | k=3: 0.03·4/3 = 0.04 | k=2: 0.02·4/2 = 0.04
    // k=1: min(0.04, 0.01·4/1 = 0.04) = 0.04
    const adjusted = benjaminiHochberg([0.01, 0.02, 0.03, 0.4]);
    expect(adjusted[0]).toBeCloseTo(0.04, 10);
    expect(adjusted[1]).toBeCloseTo(0.04, 10);
    expect(adjusted[2]).toBeCloseTo(0.04, 10);
    expect(adjusted[3]).toBeCloseTo(0.4, 10);
  });

  it('conserva el orden de entrada', () => {
    const adjusted = benjaminiHochberg([0.4, 0.01, 0.03, 0.02]);
    expect(adjusted[0]).toBeCloseTo(0.4, 10);
    expect(adjusted[1]).toBeCloseTo(0.04, 10);
    expect(adjusted[2]).toBeCloseTo(0.04, 10);
    expect(adjusted[3]).toBeCloseTo(0.04, 10);
  });

  it('con una sola hipótesis, el ajuste no cambia el p', () => {
    expect(benjaminiHochberg([0.03])).toEqual([0.03]);
  });

  it('jamás produce valores p fuera de [0, 1]', () => {
    const adjusted = benjaminiHochberg([0.9, 0.95, 0.99, 0.001]);
    for (const p of adjusted) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
