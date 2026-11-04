'use client';
// Erreur inattendue dans une page du Back-Office : message clair et nouvel essai, l'habillage reste en place.
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { classeBouton } from '@/components/backoffice/ui';

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle aria-hidden className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-display font-semibold text-ink-900">Cette page n’a pas pu s’afficher</h1>
      <p className="mt-2 text-sm text-ink-600">Un problème temporaire est survenu. Réessayez ; si cela persiste, signalez-le à l’administrateur avec l’heure de l’erreur.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={classeBouton()}>
          <RefreshCw aria-hidden className="h-4 w-4" /> Réessayer
        </button>
        <Link href="/admin" className={classeBouton('secondaire')}>
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
