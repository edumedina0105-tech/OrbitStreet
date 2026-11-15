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
import { parseCoordinate } from '@/lib/parse-coord';
import {
  ArrowLeft,
  CloudRain,
  Droplets,
  Flame,
  FlaskConical,
  Gauge,
  MapPin,
  Snowflake,
  Sun,
  Thermometer,
  TrendingUp
} from 'lucide-react';
import { isGeminiConfigured } from '@/lib/ai/gemini';
import { Link } from '@/i18n/navigation';
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

/** Icono por variable: refuerza la lectura visual de cada tarjeta de respuesta. */
const VARIABLE_ICONS = {
  T2M: Thermometer,
  T2M_MAX: Sun,
  T2M_MIN: Snowflake,
  RH2M: Droplets,
  PRECTOTCORR: CloudRain,
  PS: Gauge,
  DAYS_ABOVE_THRESHOLD: Flame
} as const;

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
  // Acepta coma decimal (formato español): "-23,6879" es válido aquí.
  const latRaw = parseCoordinate(firstParam(sp.lat));
  const lonRaw = parseCoordinate(firstParam(sp.lon));

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

  /** Icono de la variable analizada (fallback seguro si no hay resultado). */
  const VariableIcon = result ? VARIABLE_ICONS[result.trend.variable] : Sun;

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none';
  const cardClass = 'rounded-xl border border-slate-800 bg-slate-900/90 p-5';
  const answerCardClass =
    'flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5';
  const answerFootClass =
    'flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400';

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Encabezado */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('backToMap')}
      </Link>
      <h1 className="mt-3 text-3xl font-bold text-slate-50 md:text-4xl">
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
          <header className="mb-4 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-white md:text-2xl">
                {t('results.title')}
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-cyan-300">
                {VARIABLE_CONFIG[result.trend.variable].unit}
              </span>
            </div>
            {/* Franja de procedencia: fuente · rejilla · tamaño de muestra */}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span className="font-semibold text-cyan-300">
                {result.source}
              </span>
              <span aria-hidden className="text-slate-700">
                ·
              </span>
              <span>{t('results.gridCell')}</span>
              <span aria-hidden className="text-slate-700">
                ·
              </span>
              <span className="font-mono tabular-nums text-slate-300">
                n = {result.trend.n} ({result.trend.periodStart.slice(0, 4)}–
                {result.trend.periodEnd.slice(0, 4)})
              </span>
              {result.cached && (
                <>
                  <span aria-hidden className="text-slate-700">
                    ·
                  </span>
                  <span>{t('results.cached')}</span>
                </>
              )}
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* 01 · Qué está cambiando */}
            <div className={answerCardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  01. {t('results.what')}
                </span>
                <VariableIcon className="h-4 w-4 text-cyan-400" aria-hidden />
              </div>
              <div>
                <p className="text-lg font-bold leading-snug text-white">
                  {t(`variables.${result.trend.variable}.label`)}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {t(`variables.${result.trend.variable}.description`)}
                </p>
              </div>
              <div className={answerFootClass}>
                <span>{t(`seasons.${result.trend.season}`)}</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {result.trend.periodStart.slice(0, 4)}–
                  {result.trend.periodEnd.slice(0, 4)}
                </span>
              </div>
            </div>

            {/* 02 · Dónde ocurre */}
            <div className={answerCardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  02. {t('results.where')}
                </span>
                <MapPin className="h-4 w-4 text-cyan-400" aria-hidden />
              </div>
              <div>
                <p className="font-mono text-lg font-bold tabular-nums leading-snug text-white">
                  {fmt(latitude, locale, 4)}°, {fmt(longitude, locale, 4)}°
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {t('results.whereNote')}
                </p>
              </div>
              <div className={answerFootClass}>
                <span className="font-mono tabular-nums">
                  {t('results.gridCell')}
                </span>
              </div>
            </div>

            {/* 03 · Cuánto cambia (pendiente de Sen) */}
            <div className={answerCardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  03. {t('results.howMuch')}
                </span>
                <TrendingUp className="h-4 w-4 text-cyan-400" aria-hidden />
              </div>
              <div>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-bold tabular-nums text-white">
                    {result.trend.senSlopePerDecade > 0 ? '+' : ''}
                    {fmt(result.trend.senSlopePerDecade, locale, 2)}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {VARIABLE_CONFIG[result.trend.variable].unit} /{' '}
                    {t('results.perDecade')}
                  </span>
                </p>
                <p className="mt-2 font-mono text-xs tabular-nums text-cyan-300">
                  {t('results.confidenceInterval')}: [
                  {fmt(result.trend.ci95PerDecade.lower, locale, 2)},{' '}
                  {fmt(result.trend.ci95PerDecade.upper, locale, 2)}]
                </p>
              </div>
              <div className={answerFootClass}>
                <span>
                  {result.trend.ci95PerDecade.lower <= 0 &&
                  result.trend.ci95PerDecade.upper >= 0
                    ? t('results.ciCrossesZero')
                    : t('results.ciSameSign')}
                </span>
              </div>
            </div>

            {/* 04 · Significancia estadística */}
            <div className={answerCardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  04. {t('results.significant')}
                </span>
                <FlaskConical className="h-4 w-4 text-cyan-400" aria-hidden />
              </div>
              <div>
                <p
                  className={`text-lg font-bold leading-snug ${
                    result.trend.significant
                      ? 'text-amber-400'
                      : 'text-slate-200'
                  }`}
                >
                  {result.trend.significant ? '▲ ' : '○ '}
                  {result.trend.significant
                    ? t('results.significantYes')
                    : t('results.significantNo')}
                </p>
                <p className="mt-2 font-mono text-xs tabular-nums text-slate-300">
                  {t('results.pValue')}:{' '}
                  {fmtP(result.trend.mannKendall.p, locale)} ·{' '}
                  {t(trendLabelKey(result.trend.mannKendall.trend))} ·{' '}
                  {t('results.yearsAnalyzed')}: {result.trend.n}
                </p>
              </div>
              <div className={answerFootClass}>
                <span>
                  {result.trend.significant
                    ? t('results.alphaNote')
                    : t('results.validResultNote')}
                </span>
              </div>
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
            <p className="mt-2 border-t border-blue-500/20 pt-2 text-xs leading-relaxed text-slate-400">
              {t('results.yearsNeededWhy')}
            </p>
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
