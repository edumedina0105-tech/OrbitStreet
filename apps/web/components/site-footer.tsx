import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="border-t border-slate-800/70 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-slate-500">
        <p>{t('challenge')}</p>
        <p>{t('license')}</p>
        <p className="text-amber-400/80">{t('notForecast')}</p>
      </div>
    </footer>
  );
}
