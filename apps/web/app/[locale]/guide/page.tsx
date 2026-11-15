import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Cable,
  Cpu,
  Droplets,
  Gauge,
  KeyRound,
  ListChecks,
  Thermometer,
  Wifi
} from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /guide — Guía del nodo en tierra (ESP32): montaje, sensores,
 * asistente de primera configuración, token de estación y telemetría.
 * El firmware vive en apps/firmware (PlatformIO, código abierto).
 */
export default async function GuidePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('guide');

  const sensors = [
    { icon: Gauge, name: 'BME280', detail: t('sensors.bme280') },
    { icon: Droplets, name: 'DHT11', detail: t('sensors.dht11') },
    { icon: Droplets, name: 'DHT22', detail: t('sensors.dht22') },
    { icon: Thermometer, name: 'B3950', detail: t('sensors.b3950') }
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">
        {t('kicker')}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50 md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>

      {/* Qué es el nodo */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-100">{t('whatTitle')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {t('whatBody')}
        </p>
      </section>

      {/* Montaje */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          <Cable className="h-5 w-5 text-cyan-400" aria-hidden />
          {t('assemblyTitle')}
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan-400">1.</span>{t('assembly.step1')}</li>
          <li className="flex gap-2"><span className="text-cyan-400">2.</span>{t('assembly.step2')}</li>
          <li className="flex gap-2"><span className="text-cyan-400">3.</span>{t('assembly.step3')}</li>
        </ul>
      </section>

      {/* Sensores */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          <Thermometer className="h-5 w-5 text-cyan-400" aria-hidden />
          {t('sensorsTitle')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {sensors.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <s.icon className="h-4 w-4" aria-hidden />
                {s.name}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flasheo + asistente */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          <Cpu className="h-5 w-5 text-cyan-400" aria-hidden />
          {t('setupTitle')}
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-cyan-400">1.</span>{t('setup.step1')}</li>
          <li className="flex gap-2"><span className="text-cyan-400">2.</span>{t('setup.step2')}</li>
          <li className="flex gap-2"><span className="text-cyan-400">3.</span>{t('setup.step3')}</li>
        </ol>
        <Link
          href="/flash"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
        >
          <Cpu className="h-4 w-4" aria-hidden />
          {t('flashCta')}
        </Link>
      </section>

      {/* Token + telemetría */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          <KeyRound className="h-5 w-5 text-cyan-400" aria-hidden />
          {t('tokenTitle')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">{t('tokenBody')}</p>

        <h3 className="mt-6 flex items-center gap-2 text-base font-semibold text-slate-200">
          <Wifi className="h-4 w-4 text-cyan-400" aria-hidden />
          {t('telemetryTitle')}
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
          <li className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />{t('telemetry.ntp')}</li>
          <li className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />{t('telemetry.buffer')}</li>
          <li className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />{t('telemetry.baseline')}</li>
          <li className="flex gap-2"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />{t('telemetry.anomaly')}</li>
        </ul>
      </section>
    </div>
  );
}
