import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Clock,
  Database,
  FlaskConical,
  ShieldCheck
} from 'lucide-react';
import { MapStage } from '@/components/map-stage';
import { ProjectQaBox } from '@/components/project-qa-box';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Las 4 preguntas del detective viven ahora dentro de MapStage (id
 * "questions"): se responden con los datos reales de la consulta, bajo el
 * mapa, en la misma ruta. Aquí quedan los pilares de honestidad y el
 * tutor de preguntas de la IA.
 */
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
        {/* Tutor de preguntas: "Pregunta sobre los datos" */}
        <section className="scroll-mt-24 pb-16 pt-4">
          <ProjectQaBox />
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
