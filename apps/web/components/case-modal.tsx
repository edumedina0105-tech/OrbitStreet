'use client';

import { useEffect, useState } from 'react';
import { FolderArchive, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Modal "Archivar como caso": el detective publica su expediente al
 * Tablón de Casos. El usuario aporta la HIPÓTESIS local y la NOTA DE
 * CAMPO (el contexto humano que el satélite no ve); los números del
 * análisis se recalculan en el servidor al publicar — nunca se envían
 * desde el navegador.
 */

export interface CaseInvestigation {
  lat: number;
  lon: number;
  placeName: string;
  variable: string;
  season: string;
  startYear: number;
  endYear: number;
}

export function CaseModal({
  open,
  onClose,
  investigation
}: {
  open: boolean;
  onClose: () => void;
  investigation: CaseInvestigation | null;
}) {
  const t = useTranslations('caseboard');
  const td = useTranslations('detective');
  const locale = useLocale();

  const [hypothesis, setHypothesis] = useState('');
  const [fieldNote, setFieldNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [published, setPublished] = useState(false);

  // Reset al abrir.
  useEffect(() => {
    if (!open) return;
    setHypothesis('');
    setFieldNote('');
    setBusy(false);
    setError(null);
    setNeedsLogin(false);
    setPublished(false);
  }, [open]);

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !investigation) return null;

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hypothesis,
          fieldNote,
          placeName: investigation.placeName,
          latitude: investigation.lat,
          longitude: investigation.lon,
          variable: investigation.variable,
          season: investigation.season,
          startYear: investigation.startYear,
          endYear: investigation.endYear,
          locale
        })
      });
      if (response.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          errorCode?: string;
          retryAfterSeconds?: number;
        };
        setError(
          data.errorCode === 'cooldown'
            ? t('errors.cooldown', {
                seconds: data.retryAfterSeconds ?? 0
              })
            : data.errorCode === 'invalid_hypothesis'
              ? t('errors.hypothesis')
              : data.errorCode === 'invalid_field_note'
                ? t('errors.fieldNote')
                : t('errors.generic')
        );
        return;
      }
      setPublished(true);
      // Avisar al tablón para que se refresque.
      window.dispatchEvent(new Event('case-published'));
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('modalTitle')}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600/50 bg-slate-900/80 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{t('modalTitle')}</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {investigation.placeName} · {investigation.lat.toFixed(2)}°,{' '}
              {investigation.lon.toFixed(2)}° ·{' '}
              {td(`variables.${investigation.variable}.label`)} ·{' '}
              {investigation.startYear}–{investigation.endYear}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {published ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
              {t('published')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              {t('close')}
            </button>
          </div>
        ) : (
          <form onSubmit={publish} className="mt-5 space-y-4">
            {needsLogin && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {t('errors.needsLogin')}
              </p>
            )}
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                {t('hypothesisLabel')}
              </span>
              <input
                type="text"
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                maxLength={200}
                minLength={10}
                required
                placeholder={t('hypothesisPlaceholder')}
                className={inputClass}
              />
              <span className="mt-1 block text-[10px] text-slate-500">
                {t('hypothesisHint')}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                {t('fieldNoteLabel')}
              </span>
              <textarea
                value={fieldNote}
                onChange={(event) => setFieldNote(event.target.value)}
                maxLength={1000}
                minLength={20}
                rows={4}
                required
                placeholder={t('fieldNotePlaceholder')}
                className={`${inputClass} resize-y`}
              />
              <span className="mt-1 block text-[10px] text-slate-500">
                {t('fieldNoteHint')}
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FolderArchive className="h-4 w-4" aria-hidden />
              )}
              {t('publish')}
            </button>
            <p className="text-[10px] leading-snug text-slate-500">
              {t('publishNote')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}