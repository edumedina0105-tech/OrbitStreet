'use client';

import { useState } from 'react';
import { GitCompareArrows, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  analyzeDailySeries,
  type SeriesAnalysis
} from '@/lib/analysis/analyze-series';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';
import { OBSERVABLE_VARIABLES } from '@/lib/observations/plausibility';
import type { SeasonOrAnnual, TimePoint } from '@orbitstreet/shared-types';

/**
 * Comparador de regiones: la NASA menciona en su guía que un mismo
 * fenómeno global puede causar efectos INVERSOS en dos regiones
 * distintas. Aquí se eligen dos regiones lado a lado y se comparan las
 * pendientes de Sen de ambas series en el mismo periodo, calculando la
 * tasa de divergencia — todo con el MISMO motor determinista, jamás
 * estimaciones de la IA.
 */

const REGIONS = [
  { id: 'asuncion', lat: -25.2639, lon: -57.5333 },
  { id: 'chaco', lat: -22.0, lon: -60.5 },
  { id: 'buenos_aires', lat: -34.6037, lon: -58.3816 },
  { id: 'lima', lat: -12.0464, lon: -77.0428 },
  { id: 'ciudad_de_mexico', lat: 19.4326, lon: -99.1332 },
  { id: 'madrid', lat: 40.4168, lon: -3.7038 },
  { id: 'nueva_york', lat: 40.7128, lon: -74.006 }
] as const;

const SEASONS: SeasonOrAnnual[] = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'];
const START_YEAR = 1981;
const END_YEAR = 2025;

interface RegionResult {
  analysis: SeriesAnalysis;
  name: string;
}

export function RegionComparator() {
  const t = useTranslations('comparator');
  const td = useTranslations('detective');

  const [regionA, setRegionA] = useState<string>('chaco');
  const [regionB, setRegionB] = useState<string>('asuncion');
  const [variable, setVariable] = useState<string>('PRECTOTCORR');
  const [season, setSeason] = useState<SeasonOrAnnual>('ALL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [resultA, setResultA] = useState<RegionResult | null>(null);
  const [resultB, setResultB] = useState<RegionResult | null>(null);

  const fetchRegion = async (
    regionId: string
  ): Promise<RegionResult | null> => {
    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) return null;
    const parameter = VARIABLE_CONFIG[variable as keyof typeof VARIABLE_CONFIG]
      ?.powerParameters[0];
    if (!parameter) return null;
    const params = new URLSearchParams({
      lat: String(region.lat),
      lon: String(region.lon),
      parameter,
      start: `${START_YEAR}0101`,
      end: `${END_YEAR}1231`
    });
    const response = await fetch(`/api/power/daily?${params}`);
    const data = (await response.json()) as { points?: TimePoint[] };
    if (!response.ok || !data.points || data.points.length < 10) return null;
    const analysis = analyzeDailySeries(data.points, {
      variable: variable as keyof typeof VARIABLE_CONFIG,
      season,
      periodStart: `${START_YEAR}0101`,
      periodEnd: `${END_YEAR}1231`
    });
    return { analysis, name: td(`form.presets.${region.id}`) };
  };

  const compare = async () => {
    setBusy(true);
    setError(false);
    setResultA(null);
    setResultB(null);
    try {
      const [a, b] = await Promise.all([
        fetchRegion(regionA),
        fetchRegion(regionB)
      ]);
      if (!a || !b) {
        setError(true);
        return;
      }
      setResultA(a);
      setResultB(b);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const unit =
    VARIABLE_CONFIG[variable as keyof typeof VARIABLE_CONFIG]?.unit ?? '';
  const formatP = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3));
  const trendWord = (slope: number) =>
    slope > 0
      ? td('results.trendIncreasing')
      : slope < 0
        ? td('results.trendDecreasing')
        : td('results.trendNone');

  /** Barras visuales: ancho proporcional a la pendiente (misma escala). */
  const maxSlope = Math.max(
    0.0001,
    Math.abs(resultA?.analysis.trend.senSlopePerDecade ?? 0),
    Math.abs(resultB?.analysis.trend.senSlopePerDecade ?? 0)
  );
  const barWidth = (slope: number) =>
    `${Math.max(2, (Math.abs(slope) / maxSlope) * 100)}%`;

  const resultCardClass = 'rounded-xl border border-slate-800 bg-slate-900/90 p-4';
  const selectClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none';

  return (
    <div>
      <header className="mb-6 border-b border-slate-800 pb-3">
        <h2 className="text-xl font-bold text-white md:text-2xl">
          {t('title')}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{t('subtitle')}</p>
      </header>

      {/* Controles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {t('regionA')}
            </span>
            <select
              value={regionA}
              onChange={(event) => setRegionA(event.target.value)}
              className={selectClass}
            >
              {REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {td(`form.presets.${region.id}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {t('regionB')}
            </span>
            <select
              value={regionB}
              onChange={(event) => setRegionB(event.target.value)}
              className={selectClass}
            >
              {REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {td(`form.presets.${region.id}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {td('form.variable')}
            </span>
            <select
              value={variable}
              onChange={(event) => setVariable(event.target.value)}
              className={selectClass}
            >
              {OBSERVABLE_VARIABLES.map((id) => (
                <option key={id} value={id}>
                  {td(`variables.${id}.label`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {td('form.season')}
            </span>
            <select
              value={season}
              onChange={(event) =>
                setSeason(event.target.value as SeasonOrAnnual)
              }
              className={selectClass}
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? td('seasons.ALL') : s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void compare()}
          disabled={busy || regionA === regionB}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <GitCompareArrows className="h-4 w-4" aria-hidden />
          )}
          {busy ? t('comparing') : t('compare')}
        </button>
        {regionA === regionB && (
          <p className="mt-2 text-[11px] text-amber-400">{t('sameRegion')}</p>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {t('error')}
        </p>
      )}

      {resultA && resultB && (
        <div className="mt-4 space-y-4">
          {/* Tarjetas lado a lado con barras visuales (misma escala) */}
          <div className="grid gap-4 md:grid-cols-2">
            {[resultA, resultB].map((result) => {
              const slope = result.analysis.trend.senSlopePerDecade;
              return (
                <div key={result.name} className={resultCardClass}>
                  <p className="text-sm font-bold text-white">{result.name}</p>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-cyan-300">
                    {slope > 0 ? '+' : ''}
                    {slope.toFixed(2)}{' '}
                    <span className="text-xs text-slate-400">
                      {unit}/{td('results.perDecade')}
                    </span>
                  </p>
                  {/* Barra visual proporcional con transición animada */}
                  <div className="mt-2 h-2.5 w-full rounded-full bg-slate-800">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-700 ${
                        slope > 0
                          ? 'bg-amber-400'
                          : slope < 0
                            ? 'bg-cyan-400'
                            : 'bg-slate-600'
                      }`}
                      style={{ width: barWidth(slope) }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-slate-400">
                    {td('results.confidenceInterval')}:{' '}
                    [{result.analysis.trend.ci95PerDecade.lower.toFixed(2)},{' '}
                    {result.analysis.trend.ci95PerDecade.upper.toFixed(2)}] ·{' '}
                    {td('results.pValue')} ={' '}
                    {formatP(result.analysis.trend.mannKendall.p)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-lg border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      result.analysis.trend.significant
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                        : 'border-white/20 bg-white/5 text-slate-300'
                    }`}
                  >
                    {result.analysis.trend.significant
                      ? td('results.significantYes')
                      : td('results.significantNo')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Veredicto de divergencia: TODO calculado en código determinista */}
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-5">
            <p className="text-sm leading-relaxed text-slate-200">
              {t('sentence', {
                regionA: resultA.name,
                trendA: trendWord(resultA.analysis.trend.senSlopePerDecade),
                slopeA: `${resultA.analysis.trend.senSlopePerDecade > 0 ? '+' : ''}${resultA.analysis.trend.senSlopePerDecade.toFixed(2)}`,
                pA: formatP(resultA.analysis.trend.mannKendall.p),
                regionB: resultB.name,
                trendB: trendWord(resultB.analysis.trend.senSlopePerDecade),
                slopeB: `${resultB.analysis.trend.senSlopePerDecade > 0 ? '+' : ''}${resultB.analysis.trend.senSlopePerDecade.toFixed(2)}`,
                pB: formatP(resultB.analysis.trend.mannKendall.p),
                unit
              })}
            </p>
            <p className="mt-2 border-t border-cyan-400/20 pt-2 font-mono text-sm tabular-nums text-cyan-300">
              {t('divergence', {
                diff: Math.abs(
                  resultA.analysis.trend.senSlopePerDecade -
                    resultB.analysis.trend.senSlopePerDecade
                ).toFixed(2),
                unit
              })}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-slate-500">
              {t('note', {
                start: START_YEAR,
                end: END_YEAR,
                season: td(`seasons.${season}`)
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
