import { getTranslations } from 'next-intl/server';
import { Satellite } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SessionMenu } from '@/components/session-menu';
import { getCurrentUser } from '@/lib/auth/session';

export async function SiteHeader() {
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations('header')
  ]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#07090E]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-6 px-6">
        {/* Zona 1: marca (toda la acción vive en la home del mapa) */}
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

        {/* Zona 2: sesión (cuadro flotante) + idioma */}
        <div className="flex shrink-0 items-center gap-3">
          <SessionMenu
            initialUser={
              user
                ? {
                    username: user.username,
                    displayName: user.displayName,
                    uploadCooldownMinutes: user.uploadCooldownMinutes
                  }
                : null
            }
          />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

