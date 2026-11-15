import { describe, expect, it } from 'vitest';
import {
  OBSERVABLE_VARIABLES,
  biasVerdict,
  unitOf,
  withinPhysicalBounds
} from '../plausibility';

describe('withinPhysicalBounds', () => {
  it('acepta valores físicamente posibles', () => {
    expect(withinPhysicalBounds('T2M', 23.5)).toBe(true);
    expect(withinPhysicalBounds('RH2M', 100)).toBe(true);
    expect(withinPhysicalBounds('PS', 1013)).toBe(true);
    expect(withinPhysicalBounds('PRECTOTCORR', 0)).toBe(true);
  });

  it('rechaza valores imposibles y variables fuera de la lista', () => {
    expect(withinPhysicalBounds('T2M', 150)).toBe(false);
    expect(withinPhysicalBounds('RH2M', -1)).toBe(false);
    expect(withinPhysicalBounds('PS', 2000)).toBe(false);
    expect(withinPhysicalBounds('DAYS_ABOVE_THRESHOLD', 10)).toBe(false);
    expect(withinPhysicalBounds('NO_EXISTE', 10)).toBe(false);
    expect(withinPhysicalBounds('T2M', Number.NaN)).toBe(false);
  });

  it('la variable derivada no es observable directamente', () => {
    expect(OBSERVABLE_VARIABLES).not.toContain('DAYS_ABOVE_THRESHOLD');
    expect(OBSERVABLE_VARIABLES).toContain('T2M');
  });
});

describe('biasVerdict (sesgo vs celda MERRA-2)', () => {
  it('sesgo pequeño = plausible (tu calle difiere de la celda, es esperable)', () => {
    expect(biasVerdict('T2M', 1.2)).toBe('plausible');
    expect(biasVerdict('T2M', -1.9)).toBe('plausible');
  });

  it('sesgo intermedio = doubtful; sesgo enorme = suspicious', () => {
    expect(biasVerdict('T2M', 3.5)).toBe('doubtful');
    expect(biasVerdict('T2M', 12)).toBe('suspicious');
    expect(biasVerdict('RH2M', 15)).toBe('doubtful');
    expect(biasVerdict('RH2M', 40)).toBe('suspicious');
  });

  it('la lluvia tolera más sesgo por su variabilidad natural', () => {
    expect(biasVerdict('PRECTOTCORR', 8)).toBe('plausible');
    expect(biasVerdict('PRECTOTCORR', 50)).toBe('suspicious');
  });

  it('sin celda de referencia o variable inválida = no_reference', () => {
    expect(biasVerdict('T2M', Number.NaN)).toBe('no_reference');
    expect(biasVerdict('DESCONOCIDA', 1)).toBe('no_reference');
  });
});

describe('unitOf', () => {
  it('devuelve la unidad canónica', () => {
    expect(unitOf('T2M')).toBe('°C');
    expect(unitOf('PS')).toBe('hPa');
    expect(unitOf('RH2M')).toBe('%');
  });
});
