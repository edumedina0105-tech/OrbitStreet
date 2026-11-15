import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Clock,
  Database,
  FlaskConical,
  MapPin,
  ShieldCheck,
  Sun,
  TrendingUp
} from 'lucide-react';
import { MapStage } from '@/components/map-stage';

type Props = {
  params: Promise<{ locale: string }>;
};

/** Tarjetas de las 4 preguntas del detective (número + icono + i18n). */
const QUESTION_CARDS = [
  { key: 'what', Icon: Sun },
  { key: 'where', Icon: MapPin },
  { key: 'howMuch', Icon: TrendingUp },
  { key: 'significant', Icon: FlaskConical }
] as const;

/** Pilares de honestidad científica. */
const HONESTY_CARDS = [
  { key: 'reanalysis', Icon: Database },
  { key: 'deterministic', Icon: ShieldCheck },
  { key: 'yearsNeeded', Icon: Clock },
  { key: 'simulated', Icon: FlaskConical }
] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div>
      {/* Hero a pantalla completa: globo 3D interactivo + paneles flotantes */}
      <MapStage />

      <div className="mx-auto max-w-[1360px] px-6">
        {/* Las 4 preguntas */}
      <section id="questions" className="scroll-mt-24 pb-16">
        <header className="mb-6 border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-white md:text-2xl">
            {t('questions.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {t('questions.subtitle')}
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUESTION_CARDS.map(({ key, Icon }, index) => (
            <div
              key={key}
              className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5 transition-colors hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  {String(index + 1).padStart(2, '0')}.{' '}
                  {t(`questions.${key}.title`)}
                </span>
                <Icon className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {t(`questions.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Honestidad */}
      <section id="honesty" className="scroll-mt-24 pb-20">
        <header className="mb-6 border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-white md:text-2xl">
            {t('honesty.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{t('honesty.subtitle')}</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {HONESTY_CARDS.map(({ key, Icon }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-5"
            >
              <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(`honesty.${key}.title`)}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {t(`honesty.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
