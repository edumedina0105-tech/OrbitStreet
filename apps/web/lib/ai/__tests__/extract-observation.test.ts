import { describe, expect, it } from 'vitest';
import {
  buildExtractionPrompt,
  sniffImageType,
  validateExtraction
} from '../extract-observation';
import { evaluateAgainstCell } from '@/lib/observations/cross-check';

const VALID = {
  variable: 'T2M',
  value: 23.5,
  unit: '°C',
  observedAt: '2025-11-15',
  confidence: 0.9,
  description: 'Pantalla de estación meteorológica mostrando 23.5 °C',
  hasReadout: true
};

describe('sniffImageType', () => {
  it('reconoce JPEG, PNG y WEBP por magia de bytes', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0, 0]))).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe('buildExtractionPrompt', () => {
  it('prohíbe adivinar y exige conversión a unidades canónicas', () => {
    const prompt = buildExtractionPrompt({ T2M: '°C', RH2M: '%' });
    expect(prompt).toContain('Never guess');
    expect(prompt).toContain('T2M=°C');
    expect(prompt).toContain('Fahrenheit');
    expect(prompt).toContain('hasReadout');
  });
});

describe('validateExtraction (validación dura de la salida de IA)', () => {
  it('acepta una extracción válida', () => {
    expect(validateExtraction(VALID)).not.toBeNull();
  });

  it('rechaza "no veo una lectura" (hasReadout false)', () => {
    expect(validateExtraction({ ...VALID, hasReadout: false })).toBeNull();
  });

  it('rechaza variables fuera de la whitelist y valores imposibles', () => {
    expect(validateExtraction({ ...VALID, variable: 'DAYS_ABOVE_THRESHOLD' })).toBeNull();
    expect(validateExtraction({ ...VALID, variable: 'CUALQUIER_COSA' })).toBeNull();
    expect(validateExtraction({ ...VALID, value: 150 })).toBeNull();
    expect(validateExtraction({ ...VALID, value: 'no-numero' })).toBeNull();
  });

  it('rechaza fechas inválidas y confianza fuera de rango', () => {
    expect(validateExtraction({ ...VALID, observedAt: '15/11/2025' })).toBeNull();
    expect(validateExtraction({ ...VALID, observedAt: '1899-01-01' })).toBeNull();
    expect(validateExtraction({ ...VALID, confidence: 1.5 })).toBeNull();
    expect(validateExtraction({ ...VALID, description: 'x' })).toBeNull();
  });

  it('acepta fecha vacía (no legible) y límites de confianza', () => {
    expect(validateExtraction({ ...VALID, observedAt: '' })).not.toBeNull();
    expect(validateExtraction({ ...VALID, confidence: 1 })).not.toBeNull();
    expect(validateExtraction({ ...VALID, confidence: 0 })).not.toBeNull();
  });
});

describe('evaluateAgainstCell (veredicto determinista)', () => {
  it('sesgo dentro del umbral = plausible', () => {
    const check = evaluateAgainstCell(23.5, 22.8, 'T2M', 'nasa-power');
    expect(check.bias).toBeCloseTo(0.7);
    expect(check.verdict).toBe('plausible');
  });

  it('sesgo enorme = suspicious; sin celda = no_reference', () => {
    expect(evaluateAgainstCell(40, 22, 'T2M', 'nasa-power').verdict).toBe('suspicious');
    expect(evaluateAgainstCell(23.5, null, 'T2M', 'sin referencia').verdict).toBe('no_reference');
  });
});
