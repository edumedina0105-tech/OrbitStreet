'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleCheckBig, Eye, FileText, Loader2, Search, ThumbsUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { VARIABLE_IDS } from '@/lib/analysis/variables';

/**
 * Tablón de Casos del Detective: muro público de expedientes.
 * - Insignias AUTOMÁTICAS según el veredicto determinista recalculado
 *   en el servidor al publicar (🟢 p<0.05 · 🟡 inconcluso).
 * - "Revisar evidencia": abre la calculadora con los parámetros exactos
 *   para que cualquiera audite el cálculo.
 * - "Yo lo observo": confirmación ciudadana, una por usuario.
 */

interface CaseCard {
  id: string;
  hypothesis: string;
  fieldNote: string;
  placeName: string;
  latitude: number;
  longitude: number;
  variable: string;
  season: string;
  periodStart: string;
  periodEnd: string;
  significant: boolean;
  slopePerDecade: number;
  unit: string;
  pValue: number | null;
  aiConclusion: string | null;
  username: string;
  confirmations: number;
}

type VerdictFilter = 'all' | 'confirmed' | 'inconclusive';

export function CaseBoard() {
  const t = useTranslations('caseboard');
  const td = useTranslations('detective');
  const locale = useLocale();

  const [cases, setCases] = useState<CaseCard[]>([]);
  const [verdict, setVerdict] = useState<VerdictFilter>('all');
  const [variable, setVariable] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (verdict === 'confirmed') params.set('significant', 'true');
      if (verdict === 'inconclusive') params.set('significant', 'false');
      if (variable) params.set('variable', variable);
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`/api/cases?${params}`);
      const data = (await response.json()) as { cases?: CaseCard[] };
      setCases(data.cases ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [verdict, variable, query]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  // Refrescar cuando se publica un caso desde el mapa.
  useEffect(() => {
    const handler = () => void fetchCases();
    window.addEventListener('case-published', handler);
    return () => window.removeEventListener('case-published', handler);
  }, [fetchCases]);

  const confirmCase = async (id: string) => {
    setConfirming(id);
    setNeedsLogin(false);
    try {
      const response = await fetch(`/api/cases/${id}/confirm`, {
        method: 'POST'
      });
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = (await response.json()) as { count?: number };
      if (typeof data.count === 'number') {
        setCases((current) =>
          current.map((c) =>
            c.id === id ? { ...c, confirmations: data.count! } : c
          )
        );
      }
    } catch {
      // silencioso: el conteo no cambia
    } finally {
      setConfirming(null);
    }
  };

  /** URL de auditoría: la calculadora con los parámetros exactos del caso. */
  const evidenceUrl = (c: CaseCard) =>
    `/detective?preset=custom&lat=${c.latitude}&lon=${c.longitude}&variable=${c.variable}&season=${c.season}&start=${c.periodStart}-01-01&end=${c.periodEnd}-12-31`;

  /** URL del expediente científico: documento imprimible recalculado
   *  en el servidor con los parámetros exactos del caso. */
  const dossierUrl = (c: CaseCard) =>
    `/${locale}/dossier?lat=${c.latitude}&lon=${c.longitude}&variable=${c.variable}&season=${c.season}&startYear=${c.periodStart}&endYear=${c.periodEnd}&place=${encodeURIComponent(c.placeName)}`;

  const formatP = (p: number | null) =>
    p === null ? '—' : p < 0.001 ? '< 0.001' : p.toFixed(3);

  return (
    <div>
      <header className="mb-6 border-b border-slate-800 pb-3">
        <h2 className="text-xl font-bold text-white md:text-2xl">
          {t('boardTitle')}
        </h2>
        <p className="mt-1 text-xs text-slate-400">{t('boardSubtitle')}</p>
      </header>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {(
            [
              ['all', 'filterAll'],
              ['confirmed', 'filterConfirmed'],
              ['inconclusive', 'filterInconclusive']
            ] as const
          ).map(([value, key]) => (
            <button
              key={value}
              type="button"
              onClick={() => setVerdict(value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                verdict === value
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <select
          value={variable}
          onChange={(event) => setVariable(event.target.value)}
          aria-label={td('form.variable')}
          className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
        >
          <option value="">{t('allVariables')}</option>
          {VARIABLE_IDS.map((id) => (
            <option key={id} value={id}>
              {td(`variables.${id}.label`)}
            </option>
          ))}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            maxLength={100}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 py-1.5 pl-8 pr-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {needsLogin && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t('errors.needsLogin')}
        </p>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loading')}
        </p>
      )}

      {error && !loading && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {t('errors.load')}
        </p>
      )}

      {!loading && !error && cases.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
          <p className="text-sm text-slate-400">{t('empty')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cases.map((c) => (
          <article
            key={c.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4"
          >
            {/* Insignia automática + lugar */}
            <div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  c.significant
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-500/50 bg-slate-700/40 text-slate-300'
                }`}
              >
                {c.significant ? '🟢' : '🟡'}{' '}
                {c.significant ? t('badgeConfirmed') : t('badgeInconclusive')}
              </span>
              <p className="mt-1.5 text-sm font-bold text-white">
                {c.placeName}
              </p>
              <p className="font-mono text-[10px] text-slate-400">
                {td(`variables.${c.variable}.label`)} ·{' '}
                {td(`seasons.${c.season}`)} · {c.periodStart}–{c.periodEnd}
              </p>
            </div>

            {/* La hipótesis es el titular */}
            <p className="text-sm font-medium leading-snug text-cyan-200">
              “{c.hypothesis}”
            </p>

            {/* Veredicto determinista */}
            <p className="font-mono text-xs tabular-nums text-slate-300">
              {c.slopePerDecade > 0 ? '+' : ''}
              {c.slopePerDecade.toFixed(2)} {c.unit}/
              {td('results.perDecade')} · p = {formatP(c.pValue)}
            </p>

            {/* Nota de campo: el contexto humano que el satélite no ve */}
            <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">
              {c.fieldNote}
            </p>

            {/* Conclusión IA (solo texto; cifras calculadas en código) */}
            {c.aiConclusion && (
              <p className="line-clamp-3 border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-500">
                {c.aiConclusion}
              </p>
            )}

            <p className="font-mono text-[10px] text-slate-500">
              @{c.username}
            </p>

            {/* Acciones comunitarias */}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
              <button
                type="button"
                onClick={() => void confirmCase(c.id)}
                disabled={confirming === c.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {confirming === c.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <ThumbsUp className="h-3 w-3" aria-hidden />
                )}
                {t('confirm')} · {c.confirmations}
              </button>
              <Link
                href={evidenceUrl(c)}
                title={t('reviewEvidence')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
              >
                <Eye className="h-3 w-3" aria-hidden />
                {t('reviewEvidence')}
              </Link>
              <Link
                href={dossierUrl(c)}
                title={t('dossierLink')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                <FileText className="h-3 w-3" aria-hidden />
                {t('dossierLink')}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-snug text-slate-500">
        <CircleCheckBig className="h-3 w-3 shrink-0" aria-hidden />
        {t('boardNote')}
      </p>
    </div>
  );
}