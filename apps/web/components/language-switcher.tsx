'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1"
      aria-label="Language / Idioma"
    >
      {routing.locales.map((item) =>
        item === locale ? (
          <span
            key={item}
            aria-current="true"
            className="rounded-md bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-400"
          >
            {item.toUpperCase()}
          </span>
        ) : (
          <Link
            key={item}
            href={pathname}
            locale={item}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            {item.toUpperCase()}
          </Link>
        )
      )}
    </div>
  );
}
