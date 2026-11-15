import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="relative z-30 border-t border-slate-800 bg-[#05070B]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-slate-400">
        <div>
          <span className="font-semibold text-slate-200">OrbitStreet</span>{' '}
          <span aria-hidden className="text-slate-700">
            ·
          </span>{' '}
          {t('challenge')}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>{t('source')}</span>
          <span aria-hidden className="text-slate-700">
            ·
          </span>
          <span className="text-amber-300/90">{t('notForecast')}</span>
          <span aria-hidden className="text-slate-700">
            ·
          </span>
          <span>{t('license')}</span>
        </div>
      </div>
    </footer>
  );
}

