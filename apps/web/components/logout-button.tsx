'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function LogoutButton() {
  const t = useTranslations('account');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 disabled:opacity-50"
    >
      {t('logout')}
    </button>
  );
}
