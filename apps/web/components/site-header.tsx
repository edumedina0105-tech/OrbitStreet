import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/language-switcher';

export async function SiteHeader() {
  const t = await getTranslations('header');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            🛰️
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-slate-100">
              {t('brand')}
            </p>
            <p className="text-xs text-cyan-400">{t('tagline')}</p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a className="transition-colors hover:text-cyan-400" href="#questions">
            {t('nav.questions')}
          </a>
          <a className="transition-colors hover:text-cyan-400" href="#honesty">
            {t('nav.honesty')}
          </a>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
