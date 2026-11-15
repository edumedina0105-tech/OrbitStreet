'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cable, MonitorSmartphone, ShieldAlert } from 'lucide-react';

/**
 * Flasheo del firmware ESP32 directo desde el navegador con Web Serial
 * (ESP Web Tools). Sin instalar nada: Chrome/Edge conectan por USB y
 * graban bootloader + tabla de particiones + firmware en un clic.
 *
 * El manifest /firmware/manifest.json (generado por
 * apps/firmware/scripts/export_web.py) define offsets y binarios.
 */

/* Elemento personalizado <esp-web-install-button> (web component). */
const EspInstallButton = 'esp-web-install-button' as unknown as React.FC<{
  manifest?: string;
  children?: React.ReactNode;
}>;

const ESP_WEB_TOOLS_URL =
  'https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module';

export function WebSerialFlasher() {
  const t = useTranslations('flash');
  const [serialSupported, setSerialSupported] = useState<boolean | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Soporte de Web Serial (solo Chromium: Chrome, Edge, Opera).
  useEffect(() => {
    setSerialSupported(
      typeof navigator !== 'undefined' && 'serial' in navigator
    );
  }, []);

  // Cargar el web component de ESP Web Tools (script ES module).
  useEffect(() => {
    if (!serialSupported) return;
    if (document.querySelector(`script[src="${ESP_WEB_TOOLS_URL}"]`)) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = ESP_WEB_TOOLS_URL;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [serialSupported]);

  if (serialSupported === null) {
    return null; // aún detectando (evita parpadeo en SSR)
  }

  if (!serialSupported) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          {t('unsupportedTitle')}
        </p>
        <p className="mt-2 text-sm text-amber-200/80">{t('unsupportedBody')}</p>
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          <li>• {t('unsupportedChrome')}</li>
          <li>• {t('unsupportedDesktop')}</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-6">
        <p className="flex items-center gap-2 text-sm text-cyan-200">
          <Cable className="h-4 w-4" aria-hidden />
          {t('connectHint')}
        </p>

        {scriptLoaded ? (
          <div className="mt-4">
            <EspInstallButton manifest="/firmware/manifest.json">
              <button
                type="button"
                className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400"
              >
                {t('installButton')}
              </button>
            </EspInstallButton>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">{t('loading')}</p>
        )}

        <ol className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
          <li>1. {t('step1')}</li>
          <li>2. {t('step2')}</li>
          <li>3. {t('step3')}</li>
          <li>4. {t('step4')}</li>
        </ol>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('securityNote')}
      </p>
    </div>
  );
}
