// M1-AUT-02 : activation de la double authentification (obligatoire pour les rôles sensibles).
import { exigerCollaborateur } from '@/lib/authz/session';
import { exige2FA } from '@/lib/authz/permissions';
import { Alerte, TitrePage } from '@/components/backoffice/ui';
import DeuxFacteurs from './DeuxFacteurs';

export default async function PageSecurite({ searchParams }: { searchParams: Promise<{ obligatoire?: string }> }) {
  const c = await exigerCollaborateur({ sans2FA: true });
  const { obligatoire } = await searchParams;
  const requise = exige2FA(c.roles);
  return (
    <>
      <TitrePage titre="Ma sécurité" />
      {obligatoire && !c.deuxFacteurs && (
        <div className="mb-4">
          <Alerte>Votre rôle exige la double authentification. Activez-la pour accéder au Back-Office.</Alerte>
        </div>
      )}
      <DeuxFacteurs active={c.deuxFacteurs} obligatoire={requise} />
    </>
  );
}
