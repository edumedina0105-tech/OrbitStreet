'use client';

import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Botón "Imprimir / Guardar PDF" del expediente. La página lleva una
 * hoja blanca tipo documento que sale limpida por la impresora.
 */
export function DossierPrintButton() {
  const t = useTranslations('dossier');
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400"
    >
      <Printer className="h-4 w-4" aria-hidden />
      {t('print')}
    </button>
  );
}
