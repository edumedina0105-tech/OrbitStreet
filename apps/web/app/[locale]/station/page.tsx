import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookOpen, Cable, Cpu, KeyRound, Wifi } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { Link } from '@/i18n/navigation';
import { WebSerialFlasher } from '@/components/web-serial-flasher';
import { StationPanel } from '@/components/station-panel';
import type { Locale } from '@orbitstreet/shared-types';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /station — "Mi estación": TODO el flujo del nodo en una sola pantalla,
 * paso a paso e intuitivo:
 *
 *   1. Flashea el ESP32 (Web Serial, sin instalar nada)
 *   2. Registra la estación y copia el token (requiere sesión)
 *   3. Conecta el sensor y configura el nodo con el asistente cautivo
 *
 * La guía completa (/guide) y el flasheo avanzado (/flash) quedan a un
 * clic de distancia.
 */
export default async function StationPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === 'en' ? 'en' : 'es') as Locale;
  setRequestLocale(locale);
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations({ locale, namespace: 'stationPage' })
  ]);

  const stepTitle = 'flex items-center gap-3 text-lg font-bold text-slate-100';
  const stepBadge =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300';
  const card = 'rounded-xl border border-slate-800 bg-slate-900/90 p-6';

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">
        {t('kicker')}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50 md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>

      {/* PASO 1 — Flashear */}
      <section className="mt-10">
        <h2 className={stepTitle}>
          <span className={stepBadge}>1</span>
          {t('step1.title')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {t('step1.subtitle')}
        </p>
        <div className="mt-4">
          <WebSerialFlasher />
        </div>
      </section>
      {/* PASO 2 — Registrar y token */}
      <section className="mt-12">
        <h2 className={stepTitle}>
          <span className={stepBadge}>2</span>
          {t('step2.title')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {t('step2.subtitle')}
        </p>

        <div className="mt-4">
          {user ? (
            <StationPanel />
          ) : (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <KeyRound className="h-4 w-4" aria-hidden />
                {t('step2.loginNeeded')}
              </p>
              <p className="mt-2 text-xs text-amber-200/80">
                {t('step2.loginHint')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* PASO 3 — Cableado + asistente del nodo */}
      <section className="mt-12">
        <h2 className={stepTitle}>
          <span className={stepBadge}>3</span>
          {t('step3.title')}
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {/* Cableado */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <Cable className="h-4 w-4" aria-hidden />
              {t('wiring.title')}
            </p>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2 font-mono text-slate-300">VCC</td>
                  <td className="py-2 text-right text-slate-400">3.3V</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono text-slate-300">DATA</td>
                  <td className="py-2 text-right font-mono text-amber-300">
                    GPIO 4
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-mono text-slate-300">GND</td>
                  <td className="py-2 text-right text-slate-400">GND</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {t('wiring.note')}
            </p>
          </div>

          {/* Asistente cautivo */}
          <div className={card}>
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <Wifi className="h-4 w-4" aria-hidden />
              {t('wizard.title')}
            </p>
            <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
              <li className="flex gap-2">
                <span className="text-cyan-400">1.</span>
                {t('wizard.network')}
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400">2.</span>
                {t('wizard.browser')}
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400">3.</span>
                {t('wizard.fields')}
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400">4.</span>
                {t('wizard.done')}
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Guía completa */}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6">
        <Link
          href="/guide"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {t('moreGuide')}
        </Link>
        <Link
          href="/flash"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        >
          <Cpu className="h-4 w-4" aria-hidden />
          {t('moreFlash')}
        </Link>
        <p className="text-xs text-slate-500">{t('footerNote')}</p>
      </div>
    </div>
  );
}
