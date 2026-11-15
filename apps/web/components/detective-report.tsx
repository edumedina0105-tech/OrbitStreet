'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Informe del detective.
 * - Con Gemini configurado: redacción por IA (solo texto; cifras deterministas).
 * - Sin Gemini configurado: resumen determinista local (alternativa honesta).
 * El motor usado se muestra siempre como insignia: nunca se disimula.
 */

export interface ReportResponse {
  engine: 'gemini' | 'template';
  aiAvailable: boolean;
  fallback?: boolean;
  text?: string;
  errorCode?: string;
}

export function DetectiveReport({
  analysisPayload,
  geminiAvailable
}: {
  analysisPayload: Record<string, unknown>;
  geminiAvailable: boolean;
}) {
  const t = useTranslations('detective.report');
  const locale = useLocale();

  const [text, setText] = useState<string | null>(null);
  const [engine, setEngine] = useState<'gemini' | 'template' | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/detective-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analysis: analysisPayload, locale })
      });
      const data = (await response.json()) as ReportResponse;
      if (!response.ok || !data.text) {
        setError(true);
        return;
      }
      setText(data.text);
      setEngine(data.engine);
      setFallback(data.fallback === true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold text-slate-200">{t('title')}</p>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy}
        className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {busy
          ? t('loading')
          : geminiAvailable
            ? t('generate')
            : t('generateLocal')}
      </button>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t('error')}
        </p>
      )}

      {text && (
        <div className="mt-4 space-y-3">
          {engine === 'gemini' ? (
            <span className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
              {t('badgeGemini')}
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              {fallback ? t('badgeFallback') : t('badgeTemplate')}
            </span>
          )}

          <p className="text-sm leading-relaxed text-slate-300">{text}</p>

          <p className="text-xs text-slate-500">
            {engine === 'gemini' ? t('aiDisclaimer') : t('templateDisclaimer')}
          </p>
        </div>
      )}
    </div>
  );
}
