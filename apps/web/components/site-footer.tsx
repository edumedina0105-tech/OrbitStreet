import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Cpu } from 'lucide-react';

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
          {/* Nodo en tierra: flasheo Web Serial + documentación. */}
          <span className="flex items-center gap-3">
            <span className="text-slate-500">{t('nodeTitle')}:</span>
            <Link
              href="/flash"
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              {t('flashLink')}
            </Link>
            <Link
              href="/guide"
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              {t('guideLink')}
            </Link>
          </span>
          <span aria-hidden className="text-slate-700">
            ·
          </span>
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

