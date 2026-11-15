'use client';

import { useState } from 'react';
import { Copy, Check, Loader2, RadioTower } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Panel "Estación IoT" del menú de sesión: registra el nodo ESP32 en la
 * plataforma y muestra el token de ingesta UNA sola vez (el servidor
 * guarda solo su hash SHA-256; si se pierde, se vuelve a registrar).
 *
 * Flujo del usuario:
 *  1. Registrar estación (nombre + ubicación + sensor).
 *  2. Copiar el token.
 *  3. Pegarlo en el asistente del ESP32 (campo "Token de estación").
 */

interface StationPanelProps {
  /** Coordenadas iniciales sugeridas (NaN = campos vacíos). */
  defaultLatitude?: number;
  defaultLongitude?: number;
}

export function StationPanel({
  defaultLatitude = NaN,
  defaultLongitude = NaN
}: StationPanelProps) {
  const t = useTranslations('station');

  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(
    Number.isFinite(defaultLatitude) ? defaultLatitude.toFixed(2) : ''
  );
  const [longitude, setLongitude] = useState(
    Number.isFinite(defaultLongitude) ? defaultLongitude.toFixed(2) : ''
  );
  const [sensorType, setSensorType] = useState('bme280');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const registerStation = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setToken(null);
    try {
      const response = await fetch('/api/station/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          sensorType
        })
      });
      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        errorCode?: string;
      };
      if (!response.ok || !data.token) {
        setError(data.errorCode ?? 'generic');
        return;
      }
      setToken(data.token);
      setName('');
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Portapapeles no disponible: el token sigue visible para copiar a mano.
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none';

  return (
    <div className="mt-4 space-y-3">
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <RadioTower className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
        {t('intro')}
      </p>

      {token ? (
        <div className="space-y-2.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3">
          <p className="text-xs font-semibold text-emerald-300">{t('tokenTitle')}</p>
          <p className="text-[11px] text-emerald-200/80">{t('tokenWarning')}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-emerald-400/30 bg-slate-950/80 px-2.5 py-2 font-mono text-[11px] text-emerald-200">
              {token}
            </code>
            <button
              type="button"
              onClick={() => void copyToken()}
              className="shrink-0 rounded-lg bg-emerald-500 p-2 text-slate-950 transition-colors hover:bg-emerald-400"
              aria-label={t('copy')}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            {t('tokenNextSteps')}
          </p>
          <button
            type="button"
            onClick={() => setToken(null)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            {t('registerAnother')}
          </button>
        </div>
      ) : (
        <form onSubmit={registerStation} className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {t('name')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={60}
              required
              placeholder={t('namePlaceholder')}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                {t('latitude')}
              </span>
              <input
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-400">
                {t('longitude')}
              </span>
              <input
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">
              {t('sensor')}
            </span>
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value)}
              className={inputClass}
            >
              <option value="bme280">BME280 (I²C)</option>
              <option value="dht11">DHT11</option>
              <option value="dht22">DHT22 / AM2302</option>
              <option value="b3950">B3950 termistor</option>
              <option value="none">{t('noSensor')}</option>
            </select>
          </label>

          {error && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {t(`errors.${error}`)}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? t('registering') : t('register')}
          </button>
        </form>
      )}
    </div>
  );
}
