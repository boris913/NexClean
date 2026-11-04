// M1-AUT-03 : activation du compte et choix du mot de passe initial (lien 48 h, usage unique).
import { lireActivation } from '@/lib/collaborateurs/service';
import { Alerte } from '@/components/backoffice/ui';
import FormulaireActivation from './FormulaireActivation';
import CadreAuth from '@/components/backoffice/CadreAuth';

export default async function PageActivation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const activation = await lireActivation(token);
  return (
    <CadreAuth titre="Activer mon compte">
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
    </CadreAuth>
  );
}
