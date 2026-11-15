'use client';

import { useState } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * "Preguntar a la IA": tutor de metodología del proyecto, ubicado bajo las
 * 4 tarjetas de preguntas del detective en la home.
 * - Con GEMINI_API_KEY: Gemini responde (solo metodología, jamás cifras).
 * - Sin clave (o si falla): glosario determinista local por palabras clave.
 * El motor usado se muestra siempre como insignia: nunca se disimula.
 */
export function ProjectQaBox() {
  const t = useTranslations('home.map');
  const td = useTranslations('detective');
  const locale = useLocale();

  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [answer, setAnswer] = useState<{
    text: string;
    engine: 'gemini' | 'template';
    fallback: boolean;
  } | null>(null);

  const ask = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError(false);
    setAnswer(null);
    try {
      const response = await fetch('/api/project-ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed, locale })
      });
      const data = (await response.json()) as {
        text?: string;
        engine?: 'gemini' | 'template';
        fallback?: boolean;
      };
      if (!response.ok || !data.text || !data.engine) {
        setError(true);
        return;
      }
      setAnswer({
        text: data.text,
        engine: data.engine,
        fallback: data.fallback === true
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-300">
        <Bot className="h-4 w-4 shrink-0" aria-hidden />
        {t('qaTitle')}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        {t('qaHint')}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((n) => {
          const suggestion = t(`qaSuggestion${n}`);
          return (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {suggestion}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={question}
          maxLength={300}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t('qaPlaceholder')}
          aria-label={t('qaPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            t('askAi')
          )}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {t('qaError')}
        </p>
      )}

      {answer && (
        <div className="mt-4 space-y-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              answer.engine === 'gemini'
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                : 'border-slate-600 bg-slate-800 text-slate-300'
            }`}
          >
            {answer.engine === 'gemini'
              ? td('report.badgeGemini')
              : answer.fallback
                ? td('report.badgeFallback')
                : td('report.badgeTemplate')}
          </span>
          <p className="text-sm leading-relaxed text-slate-300">
            {answer.text}
          </p>
        </div>
      )}
    </div>
  );
}
