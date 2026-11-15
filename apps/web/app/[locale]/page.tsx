import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapStage } from '@/components/map-stage';
import { ProjectQaBox } from '@/components/project-qa-box';
import { RegionComparator } from '@/components/region-comparator';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      {/* Hero a pantalla completa con el globo; dentro vive todo:
          resultados de la consulta, 4 preguntas con datos reales,
          datos comunitarios y modal de observaciones. */}
      <MapStage />

      <div className="mx-auto max-w-[1360px] px-6">
        {/* Comparar regiones: el mismo fenómeno global puede causar
            efectos inversos en dos regiones distintas. */}
        <section className="scroll-mt-24 pb-16 pt-4">
          <RegionComparator />
        </section>

        {/* Tutor de preguntas: "Pregunta sobre los datos" */}
        <section className="scroll-mt-24 pb-16">
          <ProjectQaBox />
        </section>
      </div>
    </div>
  );
}
