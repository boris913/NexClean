import { exigerCollaborateur } from '@/lib/authz/session';
import { TitrePage } from '@/components/backoffice/ui';
import FormulaireNouveau from './FormulaireNouveau';

export const metadata = { title: 'Nouveau collaborateur' };

export default async function PageNouveauCollaborateur() {
  await exigerCollaborateur({ permission: 'collaborateurs.gerer' });
  return (
    <>
      <TitrePage titre="Nouveau compte" retour={{ href: '/admin/collaborateurs', libelle: 'Collaborateurs' }} />
      <FormulaireNouveau />
    </>
  );
}
