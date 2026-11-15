'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Crosshair,
  ImagePlus,
  Loader2,
  MapPin,
  PenLine,
  ShieldCheck,
  X
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { VARIABLE_CONFIG } from '@/lib/analysis/variables';
import { OBSERVABLE_VARIABLES } from '@/lib/observations/plausibility';
import { parseCoordinate } from '@/lib/parse-coord';
import { getBrowserLocation } from '@/lib/location';

/**
 * Modal flotante "Sube tu dato" (sobre el globo, sin salir del mapa).
 *
 * Flujo honesto por diseño:
 *  1. Requiere cuenta (anti-bots): si no hay sesión se ofrece crearla.
 *  2. Foto → la IA de visión SOLO extrae el valor (el usuario confirma/edita)
 *     o Manual → el usuario escribe el valor.
 *  3. Ubicación: EXIF de la foto > GPS del navegador > punto del mapa.
 *     La IP nunca es fuente de verdad (una VPN la derriba).
 *  4. Al guardar, el sesgo contra la celda MERRA-2 del día lo calcula
 *     CÓDIGO determinista; la IA jamás adjudica verdad.
 *  5. Insignia permanente: "dato comunitario · no validado".
 */

type Stage = 'checking' | 'requiresAccount' | 'form' | 'saving' | 'saved';

interface ExtractionMeta {
  confidence: number;
  description: string;
}

interface NasaCheck {
  cellValue: number | null;
  bias: number | null;
  verdict: 'plausible' | 'doubtful' | 'suspicious' | 'no_reference';
  source: string;
}

type LocationChoice = 'MAP' | 'EXIF' | 'GPS';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Reescala la imagen en el cliente (máx. 1024 px) antes de subirla. */
async function resizeImage(file: File, maxSide = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), file.type, 0.9);
  });
}

export function ObservationModal({
  open,
  onClose,
  selected
}: {
  open: boolean;
  onClose: () => void;
  selected: { lat: number; lon: number; name: string };
}) {
  const t = useTranslations('observation');
  const td = useTranslations('detective');
  const locale = useLocale();

  const [stage, setStage] = useState<Stage>('checking');
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [aiAvailable, setAiAvailable] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Formulario (compartido por foto y manual).
  const [variable, setVariable] = useState<string>('T2M');
  const [valueRaw, setValueRaw] = useState('');
  const [observedAt, setObservedAt] = useState(todayIso());
  const [extraction, setExtraction] = useState<ExtractionMeta | null>(null);
  const [exifGps, setExifGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice>('MAP');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    nasaCheck: NasaCheck;
    progress: { count: number; goal: number };
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Registro / inicio de sesión EN LÍNEA (sin salir del mapa):
  // solo usuario + contraseña, en el mismo cuadro flotante.
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authUser, setAuthUser] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const AUTH_ERROR_KEYS: Record<string, string> = {
    invalid_username: 'auth.errors.invalid_username',
    username_taken: 'auth.errors.username_taken',
    weak_password: 'auth.errors.weak_password',
    invalid_credentials: 'auth.errors.invalid_credentials'
  };

  const authErrorText = (code: string | null) =>
    code && AUTH_ERROR_KEYS[code]
      ? t(AUTH_ERROR_KEYS[code])
      : t('auth.errors.generic');

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const response = await fetch(
        authMode === 'register' ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            authMode === 'register'
              ? { username: authUser, password: authPassword, locale }
              : { identifier: authUser, password: authPassword }
          )
        }
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          errorCode?: string;
        };
        setAuthError(data.errorCode ?? 'generic');
        return;
      }
      // Sesión creada por la cookie: re-verificar y pasar al formulario.
      const me = await (await fetch('/api/auth/me')).json();
      if (me.user) {
        setAiAvailable(Boolean(me.aiAvailable));
        if (!me.aiAvailable) setMode('manual');
        setStage('form');
      } else {
        setAuthError('generic');
      }
    } catch {
      setAuthError('generic');
    } finally {
      setAuthBusy(false);
    }
  };

  const resetForm = () => {
    setVariable('T2M');
    setValueRaw('');
    setObservedAt(todayIso());
    setExtraction(null);
    setExifGps(null);
    setLocationChoice('MAP');
    setGpsCoords(null);
    setSaveError(null);
    setSaved(null);
    setPhotoError(null);
  };

  // Al abrir: comprobar sesión + disponibilidad de IA (una sola vez por apertura).
  useEffect(() => {
    if (!open) return;
    resetForm();
    setStage('checking');
    setMode('photo');
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = (await response.json()) as {
          user: { displayName: string } | null;
          aiAvailable: boolean;
        };
        if (cancelled) return;
        setAiAvailable(Boolean(data.aiAvailable));
        if (!data.aiAvailable) setMode('manual');
        setStage(data.user ? 'form' : 'requiresAccount');
      } catch {
        if (!cancelled) setStage('requiresAccount');
      }
    })();
    return () => {
      cancelled = true;
    };
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

  if (!open) return null;

  const handlePhoto = async (file: File) => {
    setPhotoError(null);
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError(t('errors.tooLarge'));
      return;
    }
    setExtracting(true);
    try {
      const resized = await resizeImage(file);
      const form = new FormData();
      form.append('image', resized, file.type === 'image/png' ? 'photo.png' : 'photo.jpg');
      const response = await fetch('/api/extract-observation', {
        method: 'POST',
        body: form
      });
      const data = (await response.json()) as {
        errorCode?: string;
        extraction?: {
          variable: string;
          value: number;
          observedAt: string;
          confidence: number;
          description: string;
        };
        exifGps?: { latitude: number; longitude: number } | null;
      };
      if (!response.ok || !data.extraction) {
        setPhotoError(
          data.errorCode === 'no_readout'
            ? t('photo.noReadout')
            : data.errorCode === 'ai_unavailable'
              ? t('photo.aiUnavailable')
              : data.errorCode === 'payload_too_large'
                ? t('errors.tooLarge')
                : t('errors.extract')
        );
        return;
      }
      // El usuario SIEMPRE confirma/edita: la extracción solo pre-llena.
      setVariable(data.extraction.variable);
      setValueRaw(String(data.extraction.value));
      if (data.extraction.observedAt) setObservedAt(data.extraction.observedAt);
      setExtraction({
        confidence: data.extraction.confidence,
        description: data.extraction.description
      });
      setExifGps(data.exifGps ?? null);
      if (data.exifGps) setLocationChoice('EXIF');
    } catch {
      setPhotoError(t('errors.extract'));
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const requestGps = async () => {
    setGpsBusy(true);
    const result = await getBrowserLocation();
    setGpsBusy(false);
    if (result.ok) {
      setGpsCoords(result.location);
      setLocationChoice('GPS');
    } else {
      setPhotoError(t('form.gpsDenied'));
    }
  };

  const saveObservation = async () => {
    setSaveError(null);
    const value = parseCoordinate(valueRaw);
    const location =
      locationChoice === 'MAP'
        ? { lat: selected.lat, lon: selected.lon }
        : locationChoice === 'EXIF' && exifGps
          ? { lat: exifGps.latitude, lon: exifGps.longitude }
          : gpsCoords
            ? { lat: gpsCoords.lat, lon: gpsCoords.lon }
            : { lat: selected.lat, lon: selected.lon };

    setStage('saving');
    try {
      const response = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variable,
          value,
          observedAt,
          latitude: location.lat,
          longitude: location.lon,
          locationSource: locationChoice,
          inputMode: mode === 'photo' && extraction ? 'PHOTO' : 'MANUAL',
          extraction:
            mode === 'photo' && extraction
              ? {
                  confidence: extraction.confidence,
                  description: extraction.description
                }
              : undefined
        })
      });
      const data = (await response.json()) as {
        errorCode?: string;
        retryAfterSeconds?: number;
        nasaCheck?: NasaCheck;
        progress?: { count: number; goal: number };
      };
      if (!response.ok || !data.nasaCheck || !data.progress) {
        setSaveError(
          data.errorCode === 'cooldown'
            ? t('errors.cooldown', { seconds: data.retryAfterSeconds ?? 0 })
            : data.errorCode === 'out_of_range'
              ? t('errors.outOfRange')
              : data.errorCode === 'invalid_date'
                ? t('errors.invalidDate')
                : t('errors.save')
        );
        setStage('form');
        return;
      }
      setSaved({ nasaCheck: data.nasaCheck, progress: data.progress });
      setStage('saved');
    } catch {
      setSaveError(t('errors.save'));
      setStage('form');
    }
  };

  const value = parseCoordinate(valueRaw);
  const canSave =
    stage === 'form' &&
    Number.isFinite(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(observedAt);

  const verdictText = (check: NasaCheck) => {
    const unit = VARIABLE_CONFIG[variable as keyof typeof VARIABLE_CONFIG]?.unit ?? '';
    const bias = check.bias === null ? '' : Math.abs(check.bias).toFixed(1);
    switch (check.verdict) {
      case 'plausible':
        return t('saved.verdictPlausible');
      case 'doubtful':
        return t('saved.verdictDoubtful', { bias, unit });
      case 'suspicious':
        return t('saved.verdictSuspicious', { bias, unit });
      default:
        return t('saved.verdictNoReference');
    }
  };

  const locationButtonClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
      active
        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
        : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
    }`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600/50 bg-slate-900/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{t('title')}</h2>
            <p className="mt-1 text-xs leading-snug text-slate-400">
              {t('subtitle')}
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

        {stage === 'checking' && (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('checking')}
          </p>
        )}

        {stage === 'requiresAccount' && (
          <div className="mt-5 space-y-4">
            {/* Pestañas crear cuenta / iniciar sesión */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  authMode === 'register'
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {t('auth.createTab')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  authMode === 'login'
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {t('auth.loginTab')}
              </button>
            </div>

            {/* Solo usuario + contraseña: registro/inicio de sesión simple */}
            <form onSubmit={submitAuth} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-400">
                  {t('auth.username')}
                </span>
                <input
                  type="text"
                  value={authUser}
                  onChange={(event) => setAuthUser(event.target.value)}
                  minLength={3}
                  maxLength={30}
                  autoComplete="username"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-400">
                  {t('auth.password')}
                </span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  minLength={8}
                  maxLength={200}
                  autoComplete={
                    authMode === 'register' ? 'new-password' : 'current-password'
                  }
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
                {authMode === 'register' && (
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {t('auth.passwordHint')}
                  </span>
                )}
              </label>

              {authError && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                  {authErrorText(authError)}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                {authBusy
                  ? t('auth.busy')
                  : authMode === 'register'
                    ? t('auth.createSubmit')
                    : t('auth.loginSubmit')}
              </button>
            </form>
          </div>
        )}

        {stage === 'form' && (
          <div className="mt-5 space-y-4">
            {/* Pestañas: foto (solo con IA) / manual */}
            <div className="flex gap-2">
              {aiAvailable && (
                <button
                  type="button"
                  onClick={() => setMode('photo')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === 'photo'
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden />
                  {t('tabs.photo')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === 'manual'
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                {t('tabs.manual')}
              </button>
            </div>

            {mode === 'photo' && !extraction && (
              <div className="space-y-2 rounded-xl border border-dashed border-slate-600 p-4">
                <p className="text-xs leading-relaxed text-slate-400">
                  {t('photo.hint')}
                </p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25">
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="h-4 w-4" aria-hidden />
                  )}
                  {extracting ? t('photo.extracting') : t('photo.choose')}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={extracting}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handlePhoto(file);
                    }}
                  />
                </label>
                {photoError && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                    {photoError}
                  </p>
                )}
              </div>
            )}

            {mode === 'photo' && extraction && (
              <div className="space-y-1.5 rounded-xl border border-cyan-400/30 bg-slate-950/60 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-cyan-300">
                  {t('photo.extracted')} · {t('photo.confidence')}{' '}
                  {Math.round(extraction.confidence * 100)}%
                </p>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {extraction.description}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setExtraction(null);
                    setExifGps(null);
                    setLocationChoice('MAP');
                  }}
                  className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  {t('photo.change')}
                </button>
              </div>
            )}

            {/* Formulario editable (la foto pre-llena; el manual arranca vacío) */}
            {(mode === 'manual' || extraction) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-400">
                      {t('form.variable')}
                    </span>
                    <select
                      value={variable}
                      onChange={(event) => setVariable(event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
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
                      {t('form.value')} (
                      {VARIABLE_CONFIG[variable as keyof typeof VARIABLE_CONFIG]?.unit})
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valueRaw}
                      onChange={(event) => setValueRaw(event.target.value)}
                      placeholder="23.5"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-slate-400">
                    {t('form.date')}
                  </span>
                  <input
                    type="date"
                    value={observedAt}
                    min="1981-01-01"
                    onChange={(event) => setObservedAt(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </label>

                {/* Ubicación: EXIF > GPS del navegador > punto del mapa */}
                <div>
                  <span className="mb-1.5 block text-[11px] font-medium text-slate-400">
                    {t('form.location')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocationChoice('MAP')}
                      className={locationButtonClass(locationChoice === 'MAP')}
                    >
                      <MapPin className="h-3 w-3" aria-hidden />
                      {t('form.locationMap')}
                    </button>
                    {exifGps && (
                      <button
                        type="button"
                        onClick={() => setLocationChoice('EXIF')}
                        className={locationButtonClass(locationChoice === 'EXIF')}
                      >
                        <ImagePlus className="h-3 w-3" aria-hidden />
                        {t('form.locationExif')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void requestGps()}
                      disabled={gpsBusy}
                      className={locationButtonClass(locationChoice === 'GPS')}
                    >
                      {gpsBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <Crosshair className="h-3 w-3" aria-hidden />
                      )}
                      {gpsCoords
                        ? t('form.accuracy', {
                            m: Math.round(gpsCoords.accuracy)
                          })
                        : t('form.locationGps')}
                    </button>
                  </div>
                </div>

                {saveError && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                    {saveError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void saveObservation()}
                  disabled={!canSave}
                  className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('save')}
                </button>
              </div>
            )}
          </div>
        )}

        {stage === 'saving' && (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('saving')}
          </p>
        )}

        {stage === 'saved' && saved && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
              <p className="text-sm font-bold text-emerald-400">
                {t('saved.title')}
              </p>
            </div>
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-[10px] font-semibold text-slate-300">
              {t('saved.badge')}
            </span>

            <div className="space-y-1.5 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <p className="text-xs leading-relaxed text-slate-200">
                {verdictText(saved.nasaCheck)}
              </p>
              {saved.nasaCheck.cellValue !== null && (
                <p className="font-mono text-[10px] text-slate-500">
                  {t('saved.cellValue', {
                    value: saved.nasaCheck.cellValue.toFixed(1),
                    unit:
                      VARIABLE_CONFIG[variable as keyof typeof VARIABLE_CONFIG]
                        ?.unit ?? '',
                    source: saved.nasaCheck.source
                  })}
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              {t('saved.progress', {
                count: saved.progress.count,
                goal: saved.progress.goal
              })}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              {t('close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
