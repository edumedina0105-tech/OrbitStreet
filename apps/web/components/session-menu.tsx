'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StationPanel } from './station-panel';

/**
 * Menú de sesión del header: cuadro flotante sobre la página (sin ruta
 * /account). Con sesión: perfil + gestión de TODO lo subido (observaciones,
 * casos, series) con botón de eliminar.
 */

interface SessionUser {
  username: string | null;
  displayName: string;
  uploadCooldownMinutes: number;
}

interface MyObservation {
  id: string;
  variable: string;
  value: number;
  unit: string;
  observedAt: string;
  verdict: string;
  bias: number | null;
  inputMode: string;
}

interface MyCase {
  id: string;
  hypothesis: string;
  placeName: string;
  variable: string;
  significant: boolean;
  slopePerDecade: number;
  unit: string;
  confirmations: number;
}

interface MySeries {
  id: string;
  label: string;
  variable: string;
  unit: string;
}

export function SessionMenu({ initialUser }: { initialUser: SessionUser | null }) {
  const t = useTranslations('account');
  const tobs = useTranslations('observation');
  const tmy = useTranslations('myData');
  const tst = useTranslations('station');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ count: number; goal: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Gestión de datos: lo subido por el usuario.
  const [dataTab, setDataTab] = useState<'profile' | 'data' | 'station'>('profile');
  const [myData, setMyData] = useState<{
    observations: MyObservation[];
    cases: MyCase[];
    series: MySeries[];
  } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const fetchMyData = async () => {
    setDataLoading(true);
    try {
      const response = await fetch('/api/me/data');
      if (response.ok) setMyData(await response.json());
      else setMyData(null);
    } catch {
      setMyData(null);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !user || dataTab !== 'data') return;
    void fetchMyData();
  }, [open, user, dataTab]);

  // Progreso de observaciones al abrir con sesión.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/observations');
        const data = (await response.json()) as { count?: number; goal?: number };
        if (!cancelled && typeof data.count === 'number') {
          setProgress({ count: data.count, goal: data.goal ?? 10 });
        }
      } catch {
        if (!cancelled) setProgress(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const submitAuth = async (event: React.FormEvent) => {
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
              : { username: identifier, password }
          )
        }
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { errorCode?: string };
        setError(data.errorCode ?? 'generic');
        return;
      }
      const me = await (await fetch('/api/auth/me')).json();
      setUser(
        me.user
          ? {
              username: me.user.username,
              displayName: me.user.displayName,
              uploadCooldownMinutes: me.user.uploadCooldownMinutes
            }
          : null
      );
      setIdentifier('');
      setPassword('');
      router.refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setProgress(null);
    setMyData(null);
    setOpen(false);
    router.refresh();
  };

  const deleteItem = async (endpoint: string) => {
    setDeleteBusy(endpoint);
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (response.ok) {
        void fetchMyData(); // refrescar la lista
      }
    } catch {
      // silencioso
    } finally {
      setDeleteBusy(null);
    }
  };

  // DELETE de series usa query param (no ruta dinámica).
  const deleteSeries = (id: string) => deleteItem(`/api/community-series?id=${id}`);

  const ERROR_KEYS: Record<string, string> = {
    invalid_username: 'errors.invalid_username',
    username_taken: 'errors.username_taken',
    invalid_email: 'errors.invalid_email',
    weak_password: 'errors.weak_password',
    invalid_name: 'errors.invalid_name',
    invalid_credentials: 'errors.invalid_credentials'
  };
  const errorText = (code: string | null) =>
    code && ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : t('errors.generic');

  const deleteBtnClass =
    'shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-amber-500/20 hover:text-amber-400';

  return (
    <div ref={boxRef} className="relative">
      {user ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title={t('title')}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          <UserRound className="h-3.5 w-3.5" aria-hidden />@
          {user.username ?? user.displayName}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden />
          {t('loginTab')}
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-11 z-50 max-h-[80vh] w-96 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-slate-600/50 bg-slate-900/85 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-white">{t('title')}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('logout')}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {user ? (
            <div className="mt-3">
              {/* Tabs: Perfil | Mis datos */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDataTab('profile')}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    dataTab === 'profile'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {tmy('profile')}
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('data')}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    dataTab === 'data'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {tmy('myData')}
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab('station')}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    dataTab === 'station'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {tst('tab')}
                </button>
              </div>

              {dataTab === 'profile' ? (
                <div className="mt-4 space-y-3">
                  <p className="font-mono text-lg font-bold text-cyan-300">
                    @{user.username ?? user.displayName}
                  </p>
                  {progress && (
                    <p className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                      {tobs('saved.progress', { count: progress.count, goal: progress.goal })}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    {t('cooldownNote', { minutes: user.uploadCooldownMinutes })}
                  </p>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    {t('logout')}
                  </button>
                </div>
              ) : dataTab === 'station' ? (
                <StationPanel />
              ) : (
                <div className="mt-4 space-y-4">
                  {dataLoading && (
                    <p className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {tmy('loading')}
                    </p>
                  )}
                  {!dataLoading && myData && (
                    <>
                      {/* Observaciones */}
                      <div>
                        <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-cyan-300">
                          {tmy('observations')} ({myData.observations.length})
                        </p>
                        {myData.observations.length === 0 ? (
                          <p className="text-xs text-slate-500">{tmy('empty')}</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {myData.observations.slice(0, 10).map((obs) => (
                              <li
                                key={obs.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-950/60 px-2.5 py-1.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-mono text-[11px] tabular-nums text-slate-200">
                                    {obs.value} {obs.unit} · {obs.observedAt}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {obs.verdict === 'plausible' ? '🟢' : obs.verdict === 'suspicious' ? '🟠' : '⚪'}{' '}
                                    {tmy('vsNASA')}: {obs.bias !== null ? `${obs.bias > 0 ? '+' : ''}${obs.bias.toFixed(1)}` : '—'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void deleteItem(`/api/observations/${obs.id}`)}
                                  disabled={deleteBusy === `/api/observations/${obs.id}`}
                                  aria-label={tmy('delete')}
                                  className={deleteBtnClass}
                                >
                                  {deleteBusy === `/api/observations/${obs.id}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {/* Casos */}
                      <div>
                        <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-cyan-300">
                          {tmy('cases')} ({myData.cases.length})
                        </p>
                        {myData.cases.length === 0 ? (
                          <p className="text-xs text-slate-500">{tmy('empty')}</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {myData.cases.slice(0, 10).map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-950/60 px-2.5 py-1.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] text-cyan-200">
                                    {c.significant ? '🟢' : '🟡'} {c.hypothesis}
                                  </p>
                                  <p className="font-mono text-[10px] tabular-nums text-slate-500">
                                    {c.placeName} · {c.slopePerDecade > 0 ? '+' : ''}
                                    {c.slopePerDecade.toFixed(2)} {c.unit}/dec · 👍 {c.confirmations}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void deleteItem(`/api/cases/${c.id}`)}
                                  disabled={deleteBusy === `/api/cases/${c.id}`}
                                  aria-label={tmy('delete')}
                                  className={deleteBtnClass}
                                >
                                  {deleteBusy === `/api/cases/${c.id}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {/* Series */}
                      {myData.series.length > 0 && (
                        <div>
                          <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-cyan-300">
                            {tmy('series')} ({myData.series.length})
                          </p>
                          <ul className="space-y-1.5">
                            {myData.series.map((s) => (
                              <li
                                key={s.id}
                                className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-950/60 px-2.5 py-1.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] text-slate-200">{s.label}</p>
                                  <p className="font-mono text-[10px] text-slate-500">
                                    {s.variable} · {s.unit}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void deleteSeries(s.id)}
                                  disabled={deleteBusy === `/api/community-series?id=${s.id}`}
                                  aria-label={tmy('delete')}
                                  className={deleteBtnClass}
                                >
                                  {deleteBusy === `/api/community-series?id=${s.id}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'login'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {t('loginTab')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'register'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {t('registerTab')}
                </button>
              </div>

              <form onSubmit={submitAuth} className="space-y-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">{t('username')}</span>
                  <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                    minLength={3} maxLength={30} autoComplete="username" required
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">{t('password')}</span>
                  <span className="relative block">
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8} maxLength={200}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 pr-10 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={t('showPassword')}
                      className="absolute inset-y-0 right-2 flex items-center rounded p-1 text-slate-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </span>
                </label>
                {error && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                    {errorText(error)}
                  </p>
                )}
                <button type="submit" disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {busy ? t('busy') : mode === 'login' ? t('loginSubmit') : t('registerSubmit')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}