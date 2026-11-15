'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StationPanel } from './station-panel';

/**
 * Puerta del paso 2 ("Registra tu estación"): consulta la sesión EN EL
 * CLIENTE (fetch /api/auth/me) para que la página /station sea 100 %
 * ESTÁTICA — sin cookies en el servidor, Next puede precargarla con el
 * prefetch del <Link> del header y la navegación es instantánea.
 *
 * Con sesión → formulario de registro (StationPanel). Sin sesión →
 * aviso con la indicación de entrar desde el menú de cuenta.
 */
export function StationGate() {
  const t = useTranslations('stationPage.step2');
  const [state, setState] = useState<'loading' | 'logged' | 'anon'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = (await response.json()) as { user?: unknown };
        if (!cancelled) setState(data.user ? 'logged' : 'anon');
      } catch {
        if (!cancelled) setState('anon');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'logged') {
    return <StationPanel />;
  }

  if (state === 'anon') {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <KeyRound className="h-4 w-4" aria-hidden />
          {t('loginNeeded')}
        </p>
        <p className="mt-2 text-xs text-amber-200/80">{t('loginHint')}</p>
      </div>
    );
  }

  return null; // carga silenciosa: evita el parpadeo del aviso
}
