import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
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

        <nav className="hidden items-center gap-5 text-sm text-slate-300 lg:flex">
          <Link
            className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
            href="/detective"
          >
            {t('nav.detective')}
          </Link>
          <Link
            className="transition-colors hover:text-cyan-400"
            href="/upload"
          >
            {t('nav.upload')}
          </Link>
          <Link
            className="transition-colors hover:text-cyan-400"
            href="/account"
          >
            {t('nav.account')}
          </Link>
          <Link
            className="transition-colors hover:text-cyan-400"
            href="/#questions"
          >
            {t('nav.questions')}
          </Link>
          <Link
            className="transition-colors hover:text-cyan-400"
            href="/#honesty"
          >
            {t('nav.honesty')}
          </Link>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
