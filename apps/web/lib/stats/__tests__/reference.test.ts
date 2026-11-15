import { describe, expect, it } from 'vitest';
import { mannKendall, mannKendallHamedRao } from '../mann-kendall';
import { senSlope, senSlopeWithCI } from '../sen-slope';
import fixtures from './reference.fixtures.json';

/**
 * Validación EXTERNA del motor estadístico contra pymannkendall 1.4.2
 * (original_test, hamed_rao_modification_test, sens_slope) y
 * scipy.stats.theilslopes (IC de Sen).
 *
 * Los fixtures (reference.fixtures.json) se generan con
 * apps/web/scripts/generate-reference-fixtures.py sobre series
 * sintéticas deterministas (numpy default_rng(42)):
 *  - ar1:   serie AR(1) autocorrelacionada con tendencia (caso Hamed-Rao).
 *  - ties:  ~50% de empates, como la lluvia diaria.
 *  - white: ruido blanco puro.
 *
 * Si este test falla tras un cambio intencional del motor, regenerar los
 * fixtures con el script y revisar que las diferencias sean las esperadas.
 */

interface Fixture {
  series: number[];
  original: { s: number; varS: number; z: number; p: number };
  hamedRao: { varS: number; z: number; p: number };
  theilslopes: { slope: number; lowSlope: number; highSlope: number };
  senSlope: number;
}

const data = fixtures as Record<'ar1' | 'ties' | 'white', Fixture>;

describe('validación contra pymannkendall (referencia externa)', () => {
  for (const name of ['ar1', 'ties', 'white'] as const) {
    const f = data[name];

    it(`Mann-Kendall clásico coincide con pymannkendall.original_test (${name})`, () => {
      const mk = mannKendall(f.series);
      expect(mk.s).toBeCloseTo(f.original.s, 10);
      expect(mk.varS).toBeCloseTo(f.original.varS, 6);
      expect(mk.z).toBeCloseTo(f.original.z, 8);
      // p depende de la CDF normal: la aproximación erf propia difiere de
      // scipy en ~1e-7 (precisión numérica, no del método).
      expect(mk.p).toBeCloseTo(f.original.p, 6);
    });

    it(`Hamed-Rao coincide con pymannkendall.hamed_rao_modification_test (${name})`, () => {
      const hr = mannKendallHamedRao(f.series);
      expect(hr.varS).toBeCloseTo(f.hamedRao.varS, 6);
      expect(hr.z).toBeCloseTo(f.hamedRao.z, 8);
      expect(hr.p).toBeCloseTo(f.hamedRao.p, 6);
      expect(hr.varianceCorrection).toBe('hamed-rao');
    });

    it(`pendiente de Sen coincide con pymannkendall.sens_slope (${name})`, () => {
      expect(senSlope(f.series)).toBeCloseTo(f.senSlope, 10);
    });

    it(`IC de Sen es coherente con scipy.theilslopes al 95% (${name})`, () => {
      const sen = senSlopeWithCI(f.series);
      // scipy redondea los rangos (ceil/floor); OrbitStreet interpola.
      // Con N = n(n−1)/2 pendientes densas, la diferencia es despreciable.
      expect(sen.ci95.lower).toBeCloseTo(f.theilslopes.lowSlope, 2);
      expect(sen.ci95.upper).toBeCloseTo(f.theilslopes.highSlope, 2);
      expect(sen.ci95.lower).toBeLessThanOrEqual(sen.slope + 1e-12);
      expect(sen.ci95.upper).toBeGreaterThanOrEqual(sen.slope - 1e-12);
    });
  }
});
