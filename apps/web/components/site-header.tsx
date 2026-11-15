import { getTranslations } from 'next-intl/server';
import { Satellite } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';

export async function SiteHeader() {
  const t = await getTranslations('header');

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#07090E]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-6 px-6">
        {/* Zona 1: marca */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10">
            <Satellite className="h-4 w-4 text-cyan-300" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-white">
              {t('brand')}
            </span>
            <span className="block text-[11px] text-cyan-300/90">
              {t('tagline')}
            </span>
          </span>
        </Link>

        {/* Zona 2: navegación */}
        <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 lg:flex">
          <Link
            className="whitespace-nowrap transition-colors hover:text-white"
            href="/detective"
          >
            {t('nav.detective')}
          </Link>
          <Link
            className="whitespace-nowrap transition-colors hover:text-white"
            href="/upload"
          >
            {t('nav.upload')}
          </Link>
          <Link
            className="whitespace-nowrap transition-colors hover:text-white"
            href="/account"
          >
            {t('nav.account')}
          </Link>
          <Link
            className="whitespace-nowrap transition-colors hover:text-white"
            href="/#questions"
          >
            {t('nav.questions')}
          </Link>
          <Link
            className="whitespace-nowrap transition-colors hover:text-white"
            href="/#honesty"
          >
            {t('nav.honesty')}
          </Link>
        </nav>

        {/* Zona 3: acción principal + idioma */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/detective?preset=asuncion&variable=T2M_MAX&season=SON"
            className="hidden whitespace-nowrap rounded-lg bg-cyan-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300 sm:inline-flex"
          >
            {t('cta')}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

