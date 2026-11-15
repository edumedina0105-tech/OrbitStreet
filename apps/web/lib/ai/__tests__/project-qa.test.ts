import { describe, expect, it } from 'vitest';
import {
  buildProjectQaPrompt,
  glossaryMatch,
  sanitizeQuestion
} from '../project-qa';

describe('buildProjectQaPrompt', () => {
  it('acota el dominio, prohíbe cifras y fija el idioma', () => {
    const prompt = buildProjectQaPrompt('¿Qué es MERRA-2?', 'Spanish (es)');
    expect(prompt).toContain('STRICT RULES');
    expect(prompt).toContain('Answer ONLY questions about this project');
    expect(prompt).toContain('Never invent numbers');
    expect(prompt).toContain('Spanish (es)');
    expect(prompt).toContain('USER QUESTION: ¿Qué es MERRA-2?');
  });
});

describe('sanitizeQuestion', () => {
  it('colapsa saltos de línea y espacios, y recorta a 300', () => {
    const dirty = 'hola\n\n  mundo\t!! ' + 'x'.repeat(400);
    const clean = sanitizeQuestion(dirty);
    expect(clean).not.toContain('\n');
    expect(clean.length).toBeLessThanOrEqual(300);
  });

  it('rechaza tipos que no son string', () => {
    expect(sanitizeQuestion(42)).toBe('');
    expect(sanitizeQuestion(null)).toBe('');
  });
});

describe('glossaryMatch (respaldo determinista)', () => {
  it('mapea conceptos a sus entradas del glosario', () => {
    expect(glossaryMatch('¿Qué es la prueba de Mann-Kendall?')).toBe(
      'answerMannKendall'
    );
    expect(glossaryMatch("what is Sen's slope?")).toBe('answerSen');
    expect(glossaryMatch('¿qué es la celda MERRA-2?')).toBe('answerMerra');
    expect(glossaryMatch('que significa el valor p')).toBe('answerPValue');
    expect(glossaryMatch('explicame el intervalo de confianza')).toBe(
      'answerCI'
    );
    expect(glossaryMatch('cuantos años tardaría un sensor')).toBe(
      'answerYears'
    );
  });

  it('"sensor" no colisiona con la pendiente de Sen (límite de palabra)', () => {
    expect(glossaryMatch('para qué sirve un sensor local')).toBe(
      'answerYears'
    );
  });

  it('cae al mensaje por defecto con preguntas fuera del glosario', () => {
    expect(glossaryMatch('hola, cómo estás?')).toBe('answerDefault');
  });
});
