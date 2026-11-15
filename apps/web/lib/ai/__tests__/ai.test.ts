import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildPrompt, isGeminiConfigured } from '../gemini';
import { buildTemplateReport } from '../template-report';
import { validateReportPayload } from '../validation';
import type { ReportAnalysis } from '../validation';

const VALID_PAYLOAD = {
  variableId: 'T2M_MAX',
  season: 'SON',
  periodStart: '1981',
  periodEnd: '2025',
  slopePerDecade: 0.412,
  ciLow: 0.31,
  ciHigh: 0.52,
  pValue: 0.0004,
  n: 45,
  significant: true,
  yearsNeeded: 785
};

describe('validateReportPayload (whitelist y límites)', () => {
  it('acepta un payload válido', () => {
    const result = validateReportPayload(VALID_PAYLOAD);
    expect(result).not.toBeNull();
    expect(result?.variableId).toBe('T2M_MAX');
    expect(result?.yearsNeeded).toBe(785);
  });

  it('rechaza variable fuera de la whitelist', () => {
    expect(
      validateReportPayload({ ...VALID_PAYLOAD, variableId: 'EVIL_PARAM' })
    ).toBeNull();
  });

  it('rechaza p > 1, n < 3 y años fuera de rango', () => {
    expect(validateReportPayload({ ...VALID_PAYLOAD, pValue: 1.5 })).toBeNull();
    expect(validateReportPayload({ ...VALID_PAYLOAD, n: 2 })).toBeNull();
    expect(
      validateReportPayload({ ...VALID_PAYLOAD, yearsNeeded: -5 })
    ).toBeNull();
  });

  it('yearsNeeded null es válido (infinito serializado), NaN no', () => {
    expect(
      validateReportPayload({ ...VALID_PAYLOAD, yearsNeeded: null })
        ?.yearsNeeded
    ).toBeNull();
    expect(validateReportPayload({ ...VALID_PAYLOAD, yearsNeeded: 'NaN' })).toBeNull();
  });

  it('rechaza períodos inválidos', () => {
    expect(
      validateReportPayload({ ...VALID_PAYLOAD, periodStart: '1900' })
    ).toBeNull();
    expect(
      validateReportPayload({ ...VALID_PAYLOAD, periodEnd: 'abc' })
    ).toBeNull();
  });
});

describe('isGeminiConfigured', () => {
  const original = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
  });

  it('sin clave → false (la función de IA debe ocultarse)', () => {
    expect(isGeminiConfigured()).toBe(false);
  });

  it('clave vacía o trivial → false', () => {
    process.env.GEMINI_API_KEY = '';
    expect(isGeminiConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = 'short';
    expect(isGeminiConfigured()).toBe(false);
  });

  it('clave válida → true', () => {
    process.env.GEMINI_API_KEY = 'AIzaSyTest-key-1234567890';
    expect(isGeminiConfigured()).toBe(true);
  });
});

describe('buildPrompt', () => {
  it('contiene las reglas duras y SOLO los números del análisis', () => {
    const analysis = validateReportPayload(VALID_PAYLOAD) as ReportAnalysis;
    analysis.variableLabel = 'Temperatura máxima';
    analysis.seasonLabel = 'Sep – Nov';

    const prompt = buildPrompt(analysis, 'Spanish (es)');

    expect(prompt).toContain('STRICT RULES');
    expect(prompt).toContain('Never calculate, round, or invent');
    expect(prompt).toContain('MERRA-2 reanalysis');
    expect(prompt).toContain('0.412'); // pendiente
    expect(prompt).toContain('785'); // años necesarios
    expect(prompt).toContain('Spanish (es)');
    // El prompt no debe contener campos libres del usuario:
    expect(prompt).not.toContain('undefined');
  });
});

describe('buildTemplateReport (alternativa determinista)', () => {
  const analysis = validateReportPayload(VALID_PAYLOAD) as ReportAnalysis;
  analysis.variableLabel = 'Temperatura máxima';
  analysis.seasonLabel = 'Sep – Nov';

  // t de prueba: devuelve "key:valores" para verificar composición e ICU.
  const fakeT = (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key;

  it('compone las oraciones en orden con los números formateados', () => {
    const text = buildTemplateReport(analysis, fakeT);
    expect(text).toContain('s1:Temperatura máxima|Sep – Nov|1981–2025');
    expect(text).toContain('s2:0.412|0.310|0.520');
    expect(text).toContain('s3:45|< 0.001');
    expect(text).toContain('verdictYes');
    expect(text).toContain('yearsNote:785');
  });

  it('sin yearsNeeded, no incluye la nota de años (no promete nada)', () => {
    const noYears = validateReportPayload({
      ...VALID_PAYLOAD,
      yearsNeeded: null
    }) as ReportAnalysis;
    noYears.variableLabel = 'X';
    noYears.seasonLabel = 'Y';
    const text = buildTemplateReport(noYears, fakeT);
    expect(text).not.toContain('yearsNote');
  });
});
