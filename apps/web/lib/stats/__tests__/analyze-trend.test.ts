import { describe, expect, it } from 'vitest';
import { analyzeTrend } from '../analyze-trend';
import { mulberry32 } from '../random';

/**
 * Test de integración: serie anual de 45 años con tendencia real de
 * +0.04 °C/año (0.4 °C/década) y ruido determinista.
 * El motor debe recuperar la pendiente y declarar significancia.
 */
describe('analyzeTrend', () => {
  const rand = mulberry32(11);
  const series = Array.from(
    { length: 45 },
    (_, i) => 22 + 0.04 * i + (rand() - 0.5) * 0.6
  );

  it('recupera la pendiente por década cerca del valor real (0.4)', () => {
    const result = analyzeTrend(series, {
      variable: 'T2M_MAX',
      periodStart: '1981-01-01',
      periodEnd: '2025-12-31'
    });
    expect(result.senSlopePerDecade).toBeGreaterThan(0.2);
    expect(result.senSlopePerDecade).toBeLessThan(0.6);
    expect(result.n).toBe(45);
  });

  it('declara la tendencia como significativa con ruido moderado', () => {
    const result = analyzeTrend(series, { variable: 'T2M_MAX' });
    expect(result.mannKendall.trend).toBe('increasing');
    expect(result.mannKendall.p).toBeLessThan(0.05);
    expect(result.significant).toBe(true);
  });

  it('el IC por década es coherente con la pendiente', () => {
    const result = analyzeTrend(series, { variable: 'T2M_MAX' });
    expect(result.ci95PerDecade.lower).toBeLessThan(result.senSlopePerDecade);
    expect(result.ci95PerDecade.upper).toBeGreaterThan(result.senSlopePerDecade);
  });

  it('respeta el p ajustado por FDR cuando se provee', () => {
    const significant = analyzeTrend(series, {
      variable: 'T2M_MAX',
      pFdr: 0.001
    });
    expect(significant.significant).toBe(true);

    // Un pFdr alto (muchas hipótesis) puede quitar la significancia
    // aunque el p crudo sea bajo: así funciona la honestidad estadística.
    const inflated = analyzeTrend(series, {
      variable: 'T2M_MAX',
      pFdr: 0.9
    });
    expect(inflated.significant).toBe(false);
  });

  it('es determinista: misma serie → mismo resultado completo', () => {
    const a = analyzeTrend(series, { variable: 'T2M' });
    const b = analyzeTrend(series, { variable: 'T2M' });
    expect(a).toEqual(b);
  });
});
