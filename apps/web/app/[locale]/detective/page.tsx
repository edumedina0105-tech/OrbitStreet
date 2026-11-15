import { getTranslations } from 'next-intl/server';
import type { SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';
import {
  analyzePowerLocation,
  type LocationAnalysis
} from '@/lib/analysis/analyze-power';
import { senFit } from '@/lib/analysis/analyze-series';
import {
  POWER_EARLIEST,
  VARIABLE_CONFIG,
  VARIABLE_IDS
} from '@/lib/analysis/variables';
import { isGeminiConfigured } from '@/lib/ai/gemini';
import { TrendChart, type TrendChartDatum } from '@/components/trend-chart';
import { DetectiveReport } from '@/components/detective-report';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Lugares predefinidos (las etiquetas visibles se resuelven por i18n;
 * las coordenadas son datos, no texto de interfaz).
 */
const PLACE_PRESETS: Record<string, { lat: number; lon: number }> = {
  asuncion: { lat: -25.2639, lon: -57.5333 },
  chaco: { lat: -22.0, lon: -60.5 },
  buenos_aires: { lat: -34.6037, lon: -58.3816 },
  lima: { lat: -12.0464, lon: -77.0428 },
  ciudad_de_mexico: { lat: 19.4326, lon: -99.1332 },
  madrid: { lat: 40.4168, lon: -3.7038 },
  nueva_york: { lat: 40.7128, lon: -74.006 }
};

const SEASONS: SeasonOrAnnual[] = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 'YYYY-MM-DD' (input date) → 'YYYYMMDD'; fallback si es inválido. */
function toYyyymmdd(isoDate: string | undefined, fallback: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return fallback;
  return isoDate.replace(/-/g, '');
}

function fmt(value: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits
  }).format(value);
}

function fmtP(p: number, locale: string): string {
  if (!Number.isFinite(p)) return '–';
  if (p < 0.001) return '< 0.001';
  return fmt(p, locale, 3);
}

function trendLabelKey(trend: 'increasing' | 'decreasing' | 'no-trend') {
  if (trend === 'increasing') return 'results.trendIncreasing' as const;
  if (trend === 'decreasing') return 'results.trendDecreasing' as const;
  return 'results.trendNone' as const;
}

export default async function DetectivePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations('detective');

  // ---- Parseo y validación de parámetros de consulta ----
  const preset = firstParam(sp.preset);
  const latRaw = Number(firstParam(sp.lat));
  const lonRaw = Number(firstParam(sp.lon));

  const presetCoords =
    preset && preset !== 'custom' ? PLACE_PRESETS[preset] : undefined;
  const latitude = presetCoords ? presetCoords.lat : latRaw;
  const longitude = presetCoords ? presetCoords.lon : lonRaw;

  const variableRaw = firstParam(sp.variable);
  const variable = VARIABLE_IDS.includes(variableRaw as VariableId)
    ? (variableRaw as VariableId)
    : undefined;

  const seasonRaw = firstParam(sp.season) as SeasonOrAnnual | undefined;
  const season: SeasonOrAnnual = SEASONS.includes(seasonRaw ?? 'ALL')
    ? (seasonRaw as SeasonOrAnnual)
    : 'ALL';

  const todayIso = new Date().toISOString().slice(0, 10);
  const start = toYyyymmdd(firstParam(sp.start), POWER_EARLIEST);
  const end = toYyyymmdd(firstParam(sp.end), todayIso.replace(/-/g, ''));

  const inputValid =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Boolean(variable) &&
    start >= POWER_EARLIEST &&
    start <= end &&
    end <= todayIso.replace(/-/g, '');

  // ---- Análisis (solo si la consulta es válida) ----
  let result: LocationAnalysis | null = null;
  let apiError = false;
  let noData = false;

  if (inputValid) {
    try {
      result = await analyzePowerLocation({
        latitude,
        longitude,
        variable: variable!,
        start,
        end,
        season,
        locale: locale === 'en' ? 'en' : 'es'
      });
      if (result.annual.length < 3) {
        noData = true;
        result = null;
      }
    } catch {
      apiError = true;
      result = null;
    }
  }

  // ---- Datos para el gráfico ----
  let chartData: TrendChartDatum[] = [];
  if (result) {
    const values = result.annual.map((p) => p.value);
    const fit = senFit(values, result.trend.senSlopePerDecade / 10);
    const lowerSlope = result.trend.ci95PerDecade.lower / 10;
    const upperSlope = result.trend.ci95PerDecade.upper / 10;
    chartData = result.annual.map((p, i) => ({
      year: Number(p.date.slice(0, 4)),
      value: p.value,
      fit: fit.fitAt(i),
      band: [
        fit.intercept + lowerSlope * i,
        fit.intercept + upperSlope * i
      ] as [number, number]
    }));
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none';
  const cardClass = 'rounded-xl border border-slate-800 bg-slate-900 p-5';

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Encabezado */}
      <h1 className="text-3xl font-bold text-slate-50 md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>

      {/* Formulario (GET: la URL de la investigación es compartible) */}
      <form
        method="get"
        action={`/${locale}/detective`}
        className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm text-slate-300">
            {t('form.place')}
            <select
              name="preset"
              defaultValue={preset ?? 'asuncion'}
              className={inputClass}
            >
              {Object.keys(PLACE_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {t(`form.presets.${key}`)}
                </option>
              ))}
              <option value="custom">{t('form.presets.custom')}</option>
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            {t('form.latitude')}
            <input
              type="number"
              name="lat"
              step="0.01"
              min="-90"
              max="90"
              defaultValue={Number.isFinite(latRaw) ? latRaw : ''}
              className={inputClass}
            />
          </label>

          <label className="block text-sm text-slate-300">
            {t('form.longitude')}
            <input
              type="number"
              name="lon"
              step="0.01"
              min="-180"
              max="180"
              defaultValue={Number.isFinite(lonRaw) ? lonRaw : ''}
              className={inputClass}
            />
          </label>

          <label className="block text-sm text-slate-300">
            {t('form.variable')}
            <select
              name="variable"
              defaultValue={variable ?? 'T2M_MAX'}
              className={inputClass}
            >
              {VARIABLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`variables.${id}.label`)}
                </option>
              ))}
            </select>
          </label>
          {/* FORM_PART_2 */}
          <label className="block text-sm text-slate-300">
            {t('form.season')}
            <select name="season" defaultValue={season} className={inputClass}>
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {t(`seasons.${s}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            {t('form.start')}
            <input
              type="date"
              name="start"
              min="1981-01-01"
              max={todayIso}
              defaultValue="1981-01-01"
              className={inputClass}
            />
          </label>

          <label className="block text-sm text-slate-300">
            {t('form.end')}
            <input
              type="date"
              name="end"
              min="1981-01-01"
              max={todayIso}
              defaultValue={todayIso}
              className={inputClass}
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              {t('form.submit')}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('form.customHint')}</p>
      </form>
      {/* RESULTS_SECTION */}
      {/* Errores honestos: nunca se inventan datos */}
      {sp.lat !== undefined && !inputValid && (
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-300">
          {t('errors.invalidParams')}
        </div>
      )}
      {apiError && (
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-300">
          {t('errors.apiFailed')}
        </div>
      )}
      {noData && (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300">
          {t('errors.noData')}
        </div>
      )}

      {/* Resultados: las 4 preguntas del desafío, en pantalla */}
      {result && (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-bold text-slate-50">
              {t('results.title')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('results.source')}: {result.source}
              {result.cached ? ` · ${t('results.cached')}` : ''}
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                {t('results.what')}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {t(`variables.${result.trend.variable}.label`)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {t(`variables.${result.trend.variable}.description`)}
              </p>
            </div>

            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                {t('results.where')}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {fmt(latitude, locale, 4)}°, {fmt(longitude, locale, 4)}°
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {t('results.whereNote')}
              </p>
            </div>

            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                {t('results.howMuch')}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {fmt(result.trend.senSlopePerDecade, locale, 3)}{' '}
                {VARIABLE_CONFIG[result.trend.variable].unit} /{' '}
                {t('results.perDecade')}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {t('results.confidenceInterval')}:{' '}
                {fmt(result.trend.ci95PerDecade.lower, locale, 3)} —{' '}
                {fmt(result.trend.ci95PerDecade.upper, locale, 3)}
              </p>
            </div>

            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                {t('results.significant')}
              </p>
              {result.trend.significant ? (
                <span className="mt-2 inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
                  ✔ {t('results.significantYes')}
                </span>
              ) : (
                <span className="mt-2 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
                  ○ {t('results.significantNo')}
                </span>
              )}
              <p className="mt-2 text-sm text-slate-400">
                {t('results.pValue')}:{' '}
                {fmtP(result.trend.mannKendall.p, locale)} ·{' '}
                {t(trendLabelKey(result.trend.mannKendall.trend))} ·{' '}
                {t('results.yearsAnalyzed')}: {result.trend.n}
              </p>
            </div>
          </div>
          {/* RESULTS_PART_2 */}
          {/* Gráfico: serie anual + recta de Sen + banda de IC 95% */}
          <div className={`${cardClass} mt-6`}>
            <TrendChart
              data={chartData}
              unit={VARIABLE_CONFIG[result.trend.variable].unit}
              labels={{
                value: t('chart.value'),
                fit: t('chart.fit'),
                band: t('chart.band'),
                year: t('chart.year')
              }}
            />
          </div>

          {/* ¿Cuántos años necesitaría un sensor local? */}
          <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
            <p className="text-sm font-semibold text-blue-400">
              {t('results.yearsNeededTitle')}
            </p>
            {Number.isFinite(result.years.years) ? (
              <p className="mt-2 text-sm text-slate-300">
                {t('results.yearsNeededBody', {
                  years: fmt(result.years.years, locale, 0)
                })}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                {t('results.yearsNeededInfinite')}
              </p>
            )}
          </div>

          {/* Informe del detective: IA si hay clave; resumen local como alternativa */}
          <DetectiveReport
            geminiAvailable={isGeminiConfigured()}
            analysisPayload={{
              variableId: result.trend.variable,
              season: result.trend.season,
              periodStart: result.trend.periodStart.slice(0, 4),
              periodEnd: result.trend.periodEnd.slice(0, 4),
              slopePerDecade: result.trend.senSlopePerDecade,
              ciLow: result.trend.ci95PerDecade.lower,
              ciHigh: result.trend.ci95PerDecade.upper,
              pValue: result.trend.mannKendall.p,
              n: result.trend.n,
              significant: result.trend.significant,
              yearsNeeded: Number.isFinite(result.years.years)
                ? result.years.years
                : null
            }}
          />

          {/* Glosario */}
          <details className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              {t('glossary.title')}
            </summary>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <p>{t('glossary.pValue')}</p>
              <p>{t('glossary.senSlope')}</p>
              <p>{t('glossary.confidenceInterval')}</p>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
