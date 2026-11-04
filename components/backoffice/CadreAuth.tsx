// Cadre des écrans publics du Back-Office (connexion, activation, mot de passe) : marque, titre, carte centrée.
import type { ReactNode } from 'react';

export default function CadreAuth({ titre, sousTitre, children, pied }: { titre: string; sousTitre?: ReactNode; children: ReactNode; pied?: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100/70 to-transparent" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/brand/logo-symbole.svg" alt="" width={48} height={48} className="h-12 w-12 drop-shadow-md" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">NEXCLEAN · Back-Office</p>
          <h1 className="mt-2 text-2xl font-display font-semibold tracking-tight text-ink-900">{titre}</h1>
          {sousTitre && <p className="mt-1.5 text-sm text-ink-600">{sousTitre}</p>}
        </div>
        <div className="space-y-4 rounded-2xl border border-ink-200/70 bg-white p-6 shadow-card">{children}</div>
        {pied && <div className="mt-5 text-center text-sm">{pied}</div>}
      </div>
    </main>
  );
}
