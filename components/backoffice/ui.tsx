// Primitives d'interface du Back-Office : mobile-first, grandes cibles tactiles (≥ 44 px).
import Link from 'next/link';
import type { ReactNode } from 'react';

export const classeChamp =
  'w-full min-h-11 px-3 py-2.5 text-base text-ink-900 bg-white border border-ink-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-ink-50';

export const classeLibelle = 'block text-sm font-medium text-ink-700 mb-1.5';

const variantes = {
  principal: 'bg-primary text-white hover:bg-primary-dark',
  secondaire: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

export function classeBouton(variante: keyof typeof variantes = 'principal', pleineLargeur = false) {
  return `inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${variantes[variante]} ${pleineLargeur ? 'w-full' : ''}`;
}

export function Carte({ titre, children, actions }: { titre?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="bg-white border border-ink-100 rounded-xl p-4 sm:p-5 shadow-sm">
      {(titre || actions) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          {titre && <h2 className="text-base font-semibold text-ink-900">{titre}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alerte({ type = 'erreur', children }: { type?: 'erreur' | 'succes' | 'info'; children: ReactNode }) {
  const styles = {
    erreur: 'bg-red-50 text-red-800 border-red-200',
    succes: 'bg-brand-50 text-brand-900 border-brand-200',
    info: 'bg-ink-50 text-ink-800 border-ink-200',
  }[type];
  return (
    <div role={type === 'erreur' ? 'alert' : 'status'} className={`border rounded-lg px-3 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function TitrePage({ titre, retour, children }: { titre: string; retour?: { href: string; libelle: string }; children?: ReactNode }) {
  return (
    <header className="mb-5">
      {retour && (
        <Link href={retour.href} className="inline-block text-sm text-primary mb-2 py-1">
          ← {retour.libelle}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-display font-semibold text-ink-900">{titre}</h1>
        {children}
      </div>
    </header>
  );
}

export function Pastille({ children, ton = 'neutre' }: { children: ReactNode; ton?: 'neutre' | 'vert' | 'rouge' | 'orange' }) {
  const styles = { neutre: 'bg-ink-100 text-ink-700', vert: 'bg-brand-100 text-brand-900', rouge: 'bg-red-100 text-red-800', orange: 'bg-amber-100 text-amber-900' }[ton];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>{children}</span>;
}

/** Résultat standard des actions serveur. */
export type ResultatAction = { ok: true; message?: string } | { ok: false; erreur: string };
