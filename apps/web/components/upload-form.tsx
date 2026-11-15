'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { VARIABLE_IDS } from '@/lib/analysis/variables';
import { parseCoordinate } from '@/lib/parse-coord';
import type { VariableId } from '@orbitstreet/shared-types';

/**
 * "Sube tu serie": formulario de datos comunitarios.
 * Requiere cuenta (anti-bots) y respeta el cooldown del usuario.
 * El resultado se calcula con el mismo motor determinista que los
 * datos de la NASA, y siempre se etiqueta como "dato comunitario".
 */

interface UploadAnalysisSummary {
  n: number;
  senSlopePerDecade: number;
  ci95PerDecade: { lower: number; upper: number };
  pValue: number;
  trend: 'increasing' | 'decreasing' | 'no-trend';
  significant: boolean;
  yearsNeeded: number;
}

const ERROR_KEYS: Record<string, string> = {
  invalid_label: 'errors.invalid_label',
  invalid_variable: 'errors.invalid_variable',
  invalid_coords: 'errors.invalid_coords',
  invalid_format: 'errors.invalid_format',
  too_many_points: 'errors.too_many_points',
  too_few_points: 'errors.too_few_points',
  invalid_date: 'errors.invalid_date',
  invalid_value: 'errors.invalid_value',
  out_of_range: 'errors.out_of_range',
  unauthorized: 'errors.unauthorized',
  payload_too_large: 'errors.too_many_points'
};

export function UploadForm({ cooldownMinutes }: { cooldownMinutes: number }) {
  const t = useTranslations('upload');
  const tv = useTranslations('detective');
  const router = useRouter();

  const [label, setLabel] = useState('');
  const [variable, setVariable] = useState<VariableId>('T2M');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [data, setData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [result, setResult] = useState<UploadAnalysisSummary | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setRetryAfter(null);
    setResult(null);
    try {
      const response = await fetch('/api/community-series', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label,
          variable,
          latitude: latitude.trim() === '' ? null : parseCoordinate(latitude),
          longitude: longitude.trim() === '' ? null : parseCoordinate(longitude),
          data
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        errorCode?: string;
        retryAfterSeconds?: number;
        analysis?: UploadAnalysisSummary;
      };

      if (!response.ok) {
        setError(payload.errorCode ?? 'generic');
        setRetryAfter(payload.retryAfterSeconds ?? null);
        return;
      }

      setResult(payload.analysis ?? null);
      setData('');
      router.refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none';

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <label className="block text-sm text-slate-300">
          {t('labelField')}
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            required
            className={inputClass}
          />
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          {t('variable')}
          <select
            value={variable}
            onChange={(e) => setVariable(e.target.value as VariableId)}
            className={inputClass}
          >
            {VARIABLE_IDS.filter((id) => id !== 'DAYS_ABOVE_THRESHOLD').map(
              (id) => (
                <option key={id} value={id}>
                  {tv(`variables.${id}.label`)}
                </option>
              )
            )}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-300">
            {t('latitude')}
            <input
              type="number"
              step="0.01"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-slate-300">
            {t('longitude')}
            <input
              type="number"
              step="0.01"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="mt-4 block text-sm text-slate-300">
          {t('data')}
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={8}
            placeholder={t('dataPlaceholder')}
            required
            className={`${inputClass} font-mono text-xs`}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {t('dataHint')}
          </span>
        </label>
        {/* UPLOAD_FORM_ERRORS */}
        {error && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {error === 'cooldown' && retryAfter !== null
              ? t('errors.cooldown', {
                  minutes: String(Math.max(1, Math.ceil(retryAfter / 60)))
                })
              : t(ERROR_KEYS[error] ?? 'errors.generic')}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? t('busy') : t('submit')}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          {t('cooldownNote', { minutes: String(cooldownMinutes) })}
        </p>
      </form>

      {/* Resultado del análisis determinista */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
          {t('resultTitle')}
        </p>

        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-3xl font-bold text-slate-100">
              {result.senSlopePerDecade.toFixed(3)}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {t('perDecade')}
              </span>
            </p>
            <p className="text-sm text-slate-400">
              {t('confidenceInterval')}: {result.ci95PerDecade.lower.toFixed(3)} —{' '}
              {result.ci95PerDecade.upper.toFixed(3)}
            </p>
            <p className="text-sm text-slate-400">
              {t('pValue')}: {result.pValue < 0.001 ? '< 0.001' : result.pValue.toFixed(3)}{' '}
              · {t('yearsAnalyzed')}: {result.n}
            </p>
            {result.significant ? (
              <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
                ✔ {t('significantYes')}
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
                ○ {t('significantNo')}
              </span>
            )}
            <p className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm text-slate-300">
              {Number.isFinite(result.yearsNeeded)
                ? t('yearsNeededBody', { years: String(result.yearsNeeded) })
                : t('yearsNeededInfinite')}
            </p>
            <p className="text-xs text-slate-500">{t('communityLabel')}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">{t('resultEmpty')}</p>
        )}
      </div>
    </div>
  );
}
