import { describe, expect, it } from 'vitest';
import { buildComparePrompt } from '../compare-report';

const DATA = {
  regionA: 'Chaco',
  regionB: 'Asunción',
  slopeA: -14.242708333333332,
  pA: 0.02,
  slopeB: 8.1096153846154,
  pB: 0.2563515841843842,
  ciA: [-25.037037037037038, -3.2062937062937086] as [number, number],
  ciB: [2.1052631578947295, 7.014880952380962] as [number, number],
  variableLabel: 'Precipitación',
  seasonLabel: 'Todo el año',
  unit: 'mm'
};

describe('buildComparePrompt (narración accesible de la divergencia)', () => {
  it('pre-redondea las cifras para que la IA no repita 16 decimales', () => {
    const prompt = buildComparePrompt(DATA, 'Spanish (es)');
    // La IA recibe solo 2-3 decimales, nunca la precisión completa.
    expect(prompt).not.toContain('14.242708333333332');
    expect(prompt).toContain('-14.24');
    expect(prompt).toContain('8.11');
    expect(prompt).toContain('22.35'); // divergencia redondeada
  });

  it('obliga a hablar claro y prohíbe afirmar causalidad', () => {
    const prompt = buildComparePrompt(DATA, 'Spanish (es)');
    expect(prompt).toContain('Speak PLAINLY');
    expect(prompt).toContain('curious neighbor');
    expect(prompt).toContain('at most 2 decimal places');
    expect(prompt).toContain('NEVER claim causation');
    expect(prompt).toContain('already rounded');
    expect(prompt).toContain('Spanish (es)');
  });
});
