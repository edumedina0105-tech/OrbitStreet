import { setRequestLocale } from 'next-intl/server';
import { MapStage } from '@/components/map-stage';
import { CaseBoard } from '@/components/case-board';
import { ProjectQaBox } from '@/components/project-qa-box';

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
        {/* Tablón de Casos del Detective: expedientes publicados por la
            comunidad, con auditoría reproducible ("Revisar evidencia"). */}
        <section id="cases" className="scroll-mt-24 pb-16 pt-4">
          <CaseBoard />
        </section>

        {/* Tutor de preguntas: "Pregunta sobre los datos".
            La comparación de regiones vive ahora DENTRO del mapa. */}
        <section className="scroll-mt-24 pb-16">
          <ProjectQaBox />
        </section>
      </div>
    </div>
  );
}
