import { exigerCollaborateur } from '@/lib/authz/session';
import { listesLieux } from '@/lib/geo/service';
import { TitrePage } from '@/components/backoffice/ui';
import FormulaireSaisie from './FormulaireSaisie';

export const metadata = { title: 'Saisir une demande' };

export default async function PageSaisie() {
  await exigerCollaborateur({ permission: 'dossier.traiter' });
  return (
    <>
      <TitrePage titre="Saisir une demande" retour={{ href: '/admin/dossiers', libelle: 'Dossiers' }} />
      <FormulaireSaisie listes={await listesLieux()} />
    </>
  );
}
