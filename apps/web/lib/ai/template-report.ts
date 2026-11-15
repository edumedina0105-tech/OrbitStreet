import type { ReportAnalysis } from './validation';

/**
 * Resumen determinista del caso: la alternativa cuando Gemini no está
 * configurado (o falla). Se construye con las traducciones i18n y los
 * números ya calculados — cero red inventada, cero alucinaciones.
 */

type Translate = (key: string, values?: Record<string, string>) => string;

export function buildTemplateReport(
  analysis: ReportAnalysis,
  t: Translate
): string {
  const slope = analysis.slopePerDecade.toFixed(3);
  const low = analysis.ciLow.toFixed(3);
  const high = analysis.ciHigh.toFixed(3);
  const p =
    analysis.pValue < 0.001
      ? '< 0.001'
      : analysis.pValue.toFixed(3);

  const sentences: string[] = [
    t('s1', {
      variable: analysis.variableLabel,
      season: analysis.seasonLabel,
      period: `${analysis.periodStart}–${analysis.periodEnd}`
    }),
    t('s2', { slope, low, high }),
    t('s3', { n: String(analysis.n), p })
  ];

  sentences.push(
    analysis.significant ? t('verdictYes') : t('verdictNo')
  );

  if (analysis.yearsNeeded !== null) {
    sentences.push(t('yearsNote', { years: String(analysis.yearsNeeded) }));
  }

  return sentences.filter(Boolean).join(' ');
}
