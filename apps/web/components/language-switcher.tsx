'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] p-1"
      aria-label="Language / Idioma"
    >
      {routing.locales.map((item) =>
        item === locale ? (
          <span
            key={item}
            aria-current="true"
            className="rounded-md bg-cyan-400/20 px-2.5 py-1 text-xs font-bold text-cyan-200"
          >
            {item.toUpperCase()}
          </span>
        ) : (
          <Link
            key={item}
            href={pathname}
            locale={item}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {item.toUpperCase()}
          </Link>
        )
      )}
    </div>
  );
}
