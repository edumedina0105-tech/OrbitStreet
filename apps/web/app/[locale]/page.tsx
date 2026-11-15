import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  ArrowRight,
  Clock,
  Database,
  FlaskConical,
  MapPin,
  ShieldCheck,
  Sun,
  TrendingUp
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

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

/** Franja de datos clave del hero. */
const HERO_STATS = ['statYears', 'statTests', 'statCI'] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-cyan-300">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          {t('hero.badge')}
        </span>
        <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
          {t('hero.subtitle')}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {/* Caso insignia: calor de primavera en Asunción, datos reales. */}
          <Link
            href="/detective?preset=asuncion&variable=T2M_MAX&season=SON"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300"
          >
            {t('hero.ctaQuestions')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#honesty"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
          >
            {t('hero.ctaHonesty')}
          </a>
        </div>

        {/* Franja de datos clave del proyecto */}
        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {HERO_STATS.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <dd className="font-mono text-xs leading-relaxed text-cyan-300">
                {t(`hero.${key}`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

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
  );
}
