import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { AccountForms } from '@/components/account-forms';
import { LogoutButton } from '@/components/logout-button';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /account — sesión del detective.
 * Crear cuenta SOLO es necesario para subir datos comunitarios y guardar
 * progreso; investigar con datos de la NASA sigue abierto para todos.
 */
export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations('account')
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-50 md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>

      {user ? (
        <div className="mt-8 max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            {t('loggedInAs')}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {user.displayName}
          </p>
          {user.username && (
            <p className="font-mono text-sm text-slate-400">@{user.username}</p>
          )}
          <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
            {t('cooldownNote', {
              minutes: String(user.uploadCooldownMinutes)
            })}
          </p>
          <div className="mt-6">
            <LogoutButton />
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <AccountForms />
        </div>
      )}
    </div>
  );
}
