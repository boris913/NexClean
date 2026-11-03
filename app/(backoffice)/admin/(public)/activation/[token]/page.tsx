// M1-AUT-03 : activation du compte et choix du mot de passe initial (lien 48 h, usage unique).
import { lireActivation } from '@/lib/collaborateurs/service';
import { Alerte } from '@/components/backoffice/ui';
import FormulaireActivation from './FormulaireActivation';

export default async function PageActivation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const activation = await lireActivation(token);
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-ink-100 rounded-xl p-5 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold">Activer mon compte</h1>
        {activation ? (
          <>
            <p className="text-sm text-ink-600">
              Bonjour {activation.nom}. Choisissez le mot de passe de votre compte <strong>{activation.email}</strong>.
            </p>
            <FormulaireActivation jeton={token} />
          </>
        ) : (
          <Alerte>Lien invalide ou expiré. Demandez un nouveau lien à l’administrateur.</Alerte>
        )}
      </div>
    </main>
  );
}
