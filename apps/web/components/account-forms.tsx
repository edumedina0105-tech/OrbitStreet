'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Formularios de login/registro: usuario + contraseña (sin correo).
 * Todas las respuestas de error viajan como errorCode y se traducen
 * aquí: nunca texto crudo del servidor.
 */

const ERROR_KEYS: Record<string, string> = {
  invalid_username: 'errors.invalid_username',
  username_taken: 'errors.username_taken',
  invalid_email: 'errors.invalid_email',
  email_taken: 'errors.username_taken',
  weak_password: 'errors.weak_password',
  invalid_name: 'errors.invalid_name',
  invalid_credentials: 'errors.invalid_credentials'
};

export function AccountForms() {
  const t = useTranslations('account');
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        mode === 'login' ? '/api/auth/login' : '/api/auth/register',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            mode === 'login'
              ? { identifier, password }
              : { username: identifier, password, locale: 'es' }
          )
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          errorCode?: string;
        };
        setError(data.errorCode ?? 'generic');
        return;
      }

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
    <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
      {/* Pestañas */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={
            mode === 'login'
              ? 'flex-1 rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-400'
              : 'flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200'
          }
        >
          {t('loginTab')}
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={
            mode === 'register'
              ? 'flex-1 rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-400'
              : 'flex-1 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200'
          }
        >
          {t('registerTab')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm text-slate-300">
          {t('username')}
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            maxLength={30}
            minLength={3}
            autoComplete="username"
            required
            className={inputClass}
          />
        </label>

        <label className="block text-sm text-slate-300">
          {t('password')}
          <span className="relative mt-1 block">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={200}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={t('showPassword')}
              className="absolute inset-y-0 right-2 flex items-center rounded p-1 text-slate-400 transition-colors hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {t(ERROR_KEYS[error] ?? 'errors.generic')}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? t('busy') : mode === 'login' ? t('loginSubmit') : t('registerSubmit')}
        </button>
      </form>

      <p className="mt-4 text-xs text-slate-500">{t('privacyNote')}</p>
    </div>
  );
}
