import Link from 'next/link';

export default function AccesRefuse() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-ink-50">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-primary mb-2">403</p>
        <h1 className="text-xl font-semibold text-ink-900 mb-2">Accès refusé</h1>
        <p className="text-ink-600 mb-6">Vous n’avez pas les droits nécessaires pour cette page. La tentative a été enregistrée.</p>
        <Link href="/admin" className="text-primary font-medium">
          Retour à l’accueil du Back-Office
        </Link>
      </div>
    </main>
  );
}
