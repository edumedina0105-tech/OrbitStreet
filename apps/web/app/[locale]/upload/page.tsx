import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { Link } from '@/i18n/navigation';
import { UploadForm } from '@/components/upload-form';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /upload — "Sube tu serie" (datos comunitarios).
 * Requiere cuenta con contraseña: el análisis con datos NASA sigue público,
 * pero subir información exige autenticación (anti-bots + cooldown).
 */
export default async function UploadPage({ params }: Props) {
  const { locale } = await params;
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations('upload')
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-50 md:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 max-w-3xl text-slate-400">{t('subtitle')}</p>

      {user ? (
        <UploadForm cooldownMinutes={user.uploadCooldownMinutes} />
      ) : (
        <div className="mt-8 max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-6">
          <p className="text-sm text-amber-300">{t('loginRequired')}</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            {t('loginCta')}
          </Link>
        </div>
      )}
    </div>
  );
}
