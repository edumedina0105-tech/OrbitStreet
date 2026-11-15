import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Satellite, BadgeCheck, ShieldAlert } from 'lucide-react';
import { analyzePowerLocation } from '@/lib/analysis/analyze-power';
import { senFit } from '@/lib/analysis/analyze-series';
import { VARIABLE_CONFIG, VARIABLE_IDS } from '@/lib/analysis/variables';
import { TrendChart, type TrendChartDatum } from '@/components/trend-chart';
import { DossierPrintButton } from '@/components/dossier-print-button';
import type { Locale, SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SEASONS = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'] as const;

function parseNumberParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): number | null {
  const raw = sp[key];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * /dossier — Expediente científico imprimible y compartible.
 *
 * Recalcula el análisis EN EL SERVIDOR a partir de los parámetros de la
 * URL (determinista + reproducible): abrir el mismo enlace produce el
 * mismo documento. Responde la pregunta del jurado: «¿cómo sabemos que
 * este resultado es correcto?» — con fuente exacta, método, IC,
 * limitaciones y validación independiente contra pymannkendall/SciPy.
 */
export default async function DossierPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === 'en' ? 'en' : 'es') as Locale;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'dossier' });
  const tv = await getTranslations({ locale, namespace: 'detective.variables' });

  const latitude = parseNumberParam(sp, 'lat');
  const longitude = parseNumberParam(sp, 'lon');
  const startYear = parseNumberParam(sp, 'startYear') ?? 1981;
  const endYear = parseNumberParam(sp, 'endYear') ?? new Date().getUTCFullYear();
  const placeParam = sp.place;
  const place = (Array.isArray(placeParam) ? placeParam[0] : placeParam) ?? '';

  const variableRaw = sp.variable;
  const variable = (Array.isArray(variableRaw) ? variableRaw[0] : variableRaw) as
    | VariableId
    | undefined;
  const seasonRaw = sp.season;
  const season = ((Array.isArray(seasonRaw) ? seasonRaw[0] : seasonRaw) ??
    'ALL') as SeasonOrAnnual;

  const valid =
    latitude !== null &&
    longitude !== null &&
    variable !== undefined &&
    (VARIABLE_IDS as string[]).includes(variable) &&
    (SEASONS as readonly string[]).includes(season) &&
    startYear >= 1981 &&
    endYear >= startYear &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (!valid) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold text-slate-50">{t('invalidTitle')}</h1>
        <p className="mt-3 text-sm text-slate-400">{t('invalidBody')}</p>
      </div>
    );
  }

  const config = VARIABLE_CONFIG[variable as VariableId];
  const analysis = await analyzePowerLocation({
    latitude,
    longitude,
    variable: variable as VariableId,
    season,
    start: `${startYear}0101`,
    end: `${endYear}1231`,
    locale
  });

  const fmt = (value: number, digits = 2) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  const fmtP = (p: number) => (p < 0.001 ? '< 0.001' : fmt(p, 3));

  // Serie anual + recta de Sen + banda de IC (idéntico al detective).
  const values = analysis.annual.map((p) => p.value);
  const fit = senFit(values, analysis.trend.senSlopePerDecade / 10);
  const lowerSlope = analysis.trend.ci95PerDecade.lower / 10;
  const upperSlope = analysis.trend.ci95PerDecade.upper / 10;
  const chartData: TrendChartDatum[] = analysis.annual.map((p, i) => ({
    year: Number(p.date.slice(0, 4)),
    value: p.value,
    fit: fit.fitAt(i),
    band: [
      fit.intercept + lowerSlope * i,
      fit.intercept + upperSlope * i
    ] as [number, number]
  }));

  const effectiveStart = analysis.annual[0]
    ? analysis.annual[0].date.slice(0, 4)
    : String(startYear);
  const effectiveEnd = analysis.trend.periodEnd.slice(0, 4);

  const row = 'flex items-start justify-between gap-4 border-b border-slate-200 py-2';
  const rowKey = 'text-[11px] uppercase tracking-wide text-slate-500';
  const rowVal = 'text-right text-sm font-semibold text-slate-900';

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Botón de impresión: no sale en el papel. */}
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <a
          href={`/${locale}`}
          className="text-sm font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
        >
          ← OrbitStreet
        </a>
        <DossierPrintButton />
      </div>

      {/* Hoja tipo documento: limpia en pantalla y en la impresora. */}
      <article className="rounded-xl bg-white p-8 text-slate-900 shadow-2xl md:p-12">
        <header className="border-b-2 border-slate-900 pb-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Satellite className="h-4 w-4" aria-hidden />
            OrbitStreet · {t('title')}
          </p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">
            {place || t('defaultPlace')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {tv(`${variable as VariableId}.label`)} · {t(`seasons.${season}`)} ·{' '}
            {t('generated')}{' '}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: 'UTC'
            }).format(new Date())}{' '}
            (UTC)
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div
            className={`rounded-lg border-2 p-5 ${
              analysis.trend.significant
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-amber-600 bg-amber-50'
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              {t('verdict')}
            </p>
            <p className="mt-2 text-lg font-bold leading-snug">
              {analysis.trend.significant ? '🟢 ' : '🟡 '}
              {analysis.trend.significant
                ? t('significant', {
                    slope: fmt(analysis.trend.senSlopePerDecade),
                    unit: config.unit
                  })
                : t('notSignificant')}
            </p>
          </div>
          <div className="rounded-lg border-2 border-slate-300 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              {t('slopeTitle')}
            </p>
            <p className="mt-2 font-mono text-lg font-bold">
              {analysis.trend.senSlopePerDecade > 0 ? '+' : ''}
              {fmt(analysis.trend.senSlopePerDecade)} {config.unit}/{t('perDecade')}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-600">
              IC 95%: [{fmt(analysis.trend.ci95PerDecade.lower)},{' '}
              {fmt(analysis.trend.ci95PerDecade.upper)}]
            </p>
          </div>
        </section>

        <section className="mt-6">
          <TrendChart
            data={chartData}
            unit={config.unit}
            labels={{
              value: t('chart.value'),
              fit: t('chart.fit'),
              band: t('chart.band'),
              year: t('chart.year')
            }}
          />
        </section>
        {/* Metadatos exactos del análisis */}
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            {t('metaTitle')}
          </h2>
          <div className="mt-3 md:grid md:grid-cols-2 md:gap-x-12">
            <div>
              <div className={row}>
                <span className={rowKey}>{t('meta.source')}</span>
                <span className={rowVal}>{analysis.source}</span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.parameter')}</span>
                <span className={rowVal}>{analysis.parameter}</span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.variable')}</span>
                <span className={rowVal}>
                  {tv(`${variable as VariableId}.label`)}
                </span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.season')}</span>
                <span className={rowVal}>{t(`seasons.${season}`)}</span>
              </div>
            </div>
            <div>
              <div className={row}>
                <span className={rowKey}>{t('meta.coordinates')}</span>
                <span className={rowVal}>
                  {fmt(latitude!, 2)}°, {fmt(longitude!, 2)}°
                </span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.grid')}</span>
                <span className={rowVal}>0.5° × 0.5° (~50 km)</span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.period')}</span>
                <span className={rowVal}>
                  {effectiveStart}–{effectiveEnd} · {analysis.trend.n} {t('years')}
                </span>
              </div>
              <div className={row}>
                <span className={rowKey}>{t('meta.p')}</span>
                <span className={rowVal}>
                  {fmtP(analysis.trend.mannKendall.p)}
                  {analysis.trend.mannKendall.varianceCorrection === 'hamed-rao'
                    ? ' · Hamed-Rao'
                    : ''}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {t('coverageNote')}
          </p>
        </section>

        {/* Validación independiente */}
        <section className="mt-6 rounded-lg border-2 border-cyan-700 bg-cyan-50 p-5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-900">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            {t('validation.title')}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {t('validation.body', {
              p: fmtP(analysis.trend.mannKendall.p),
              slope: fmt(analysis.trend.senSlopePerDecade)
            })}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>{t('validation.item1')}</li>
            <li>{t('validation.item2')}</li>
            <li>{t('validation.item3')}</li>
          </ul>
        </section>
        {/* Limitaciones */}
        <section className="mt-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            {t('limits.title')}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{t('limits.reanalysis')}</li>
            <li>{t('limits.grid')}</li>
            <li>{t('limits.coverage')}</li>
            <li>{t('limits.sensor')}</li>
          </ul>
        </section>

        {/* Reproducibilidad */}
        <footer className="mt-8 border-t-2 border-slate-900 pt-4 text-[11px] leading-relaxed text-slate-500">
          <p>
            {t('reproducibility')}{' '}
            <code className="rounded bg-slate-100 px-1 font-mono">
              /{locale}/dossier?lat={fmt(latitude!, 2)}&lon={fmt(longitude!, 2)}
              &variable={variable}&season={season}&startYear={startYear}
              &endYear={endYear}
            </code>
          </p>
          <p className="mt-1">
            OrbitStreet · NASA Space Apps Challenge 2026 · Apache-2.0 ·{' '}
            github.com/edumedina0105-tech/OrbitStreet
          </p>
        </footer>
      </article>
    </div>
  );
}
