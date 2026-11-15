import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const questionKeys = ['what', 'where', 'howMuch', 'significant'] as const;
  const questionIcons: Record<(typeof questionKeys)[number], string> = {
    what: '🌡️',
    where: '📍',
    howMuch: '📈',
    significant: '🔬'
  };
  const honestyKeys = [
    'reanalysis',
    'deterministic',
    'yearsNeeded',
    'simulated'
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-24 text-center md:py-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-400">
          <span aria-hidden>●</span>
          {t('hero.badge')}
        </span>
        <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-bold tracking-tight text-slate-50 md:text-6xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-400 md:text-lg">
          {t('hero.subtitle')}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {/* Caso insignia: calor de primavera en Asunción, datos reales. */}
          <Link
            href="/detective?preset=asuncion&variable=T2M_MAX&season=SON"
            className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            {t('hero.ctaQuestions')}
          </Link>
          <a
            href="#honesty"
            className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500"
          >
            {t('hero.ctaHonesty')}
          </a>
        </div>
      </section>

      {/* Las 4 preguntas */}
      <section id="questions" className="scroll-mt-24 pb-20">
        <h2 className="text-center text-3xl font-bold text-slate-50">
          {t('questions.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          {t('questions.subtitle')}
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {questionKeys.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-slate-700"
            >
              <span aria-hidden className="text-3xl">
                {questionIcons[key]}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-100">
                {t(`questions.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {t(`questions.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Honestidad */}
      <section id="honesty" className="scroll-mt-24 pb-24">
        <h2 className="text-center text-3xl font-bold text-slate-50">
          {t('honesty.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          {t('honesty.subtitle')}
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {honestyKeys.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6"
            >
              <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-400">
                <span aria-hidden>✔</span>
                {t(`honesty.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {t(`honesty.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
