import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, BookOpen, Cpu } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { WebSerialFlasher } from '@/components/web-serial-flasher';
import { StationGate } from '@/components/station-gate';
import { WiringDiagram } from '@/components/wiring-diagram';
import { ConnectSteps } from '@/components/connect-steps';
import type { Locale } from '@orbitstreet/shared-types';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /station — "Mi estación": TODO el flujo del nodo en una sola pantalla,
 * paso a paso e intuitivo:
 *
 *   1. Flashea el ESP32 (Web Serial, sin instalar nada)
 *   2. Registra la estación y copia el token (sesión consultada en el
 *      client vía StationGate → la página es 100 % ESTÁTICA y Next la
 *      precarga con el prefetch del botón del header: navegación
 *      instantánea, sin espera de SSR)
 *   3. Conecta el sensor y configura el nodo con el asistente cautivo
 *
 * La guía completa (/guide) y el flasheo avanzado (/flash) quedan a un
 * clic de distancia.
 */
export default async function StationPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale === 'en' ? 'en' : 'es') as Locale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'stationPage' });

  const stepTitle = 'flex items-center gap-3 text-lg font-bold text-slate-100';
  const stepBadge =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300';

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
          {/* Sesión consultada en el client (StationGate) para que la
              página sea estática y se precargue: navegación instantánea. */}
          <StationGate />
        </div>
      </section>

      {/* PASO 3 — Cableado + asistente del nodo */}
      <section className="mt-12">
        <h2 className={stepTitle}>
          <span className={stepBadge}>3</span>
          {t('step3.title')}
        </h2>

        {/* Diagrama interactivo de conexiones ESP32 ↔ sensor: elige sensor
            y pin y el cable de señal se redibuja animado. Guía con pasos
            y precauciones específicas de cada sensor. */}
        <div className="mt-4">
          <WiringDiagram />
        </div>
      </section>

      {/* PASO 4 — Encender y conectarse al nodo (stepper interactivo) */}
      <section className="mt-12">
        <h2 className={stepTitle}>
          <span className={stepBadge}>4</span>
          {t('connect.title')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          {t('connect.subtitle')}
        </p>
        <div className="mt-4">
          <ConnectSteps />
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

      {/* Botón flotante: volver al mapa (siempre visible al hacer scroll) */}
      <Link
        href="/"
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-cyan-300 shadow-2xl shadow-black/50 backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-cyan-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('backToMap')}
      </Link>
    </div>
  );
}
