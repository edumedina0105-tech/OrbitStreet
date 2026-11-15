import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { WebSerialFlasher } from '@/components/web-serial-flasher';
import { BookOpen, Cpu, RadioTower } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /flash — Graba el firmware del nodo en tierra (ESP32) directo desde
 * el navegador con Web Serial. Sin instalar toolchains: un clic y el
 * nodo queda listo para el asistente de primera configuración.
 */
export default async function FlashPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('flash');

  const steps = [
    { icon: Cpu, title: t('flow.flash.title'), body: t('flow.flash.body') },
    { icon: RadioTower, title: t('flow.setup.title'), body: t('flow.setup.body') },
    { icon: BookOpen, title: t('flow.guide.title'), body: t('flow.guide.body') }
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

      {/* Advertencia de datos simulados N/A aquí: el firmware es real y
          los binarios son los generados por PlatformIO del monorepo. */}
      <div className="mt-8">
        <WebSerialFlasher />
      </div>

      {/* Flujo completo tras el flasheo */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-100">{t('flowTitle')}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <step.icon className="h-5 w-5 text-cyan-400" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-100">
                {step.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {step.body}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/guide"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {t('guideCta')}
        </Link>
      </section>
    </div>
  );
}
