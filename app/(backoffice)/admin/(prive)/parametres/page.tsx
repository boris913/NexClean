// MVP1-03 RG-05 : commission par personne et liste de métiers suggérés (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireParametre } from '@/lib/parametres';
import { TitrePage } from '@/components/backoffice/ui';
import Formulaires from './Formulaires';

export const metadata = { title: 'Paramètres' };

export default async function PageParametres() {
  await exigerCollaborateur({ permission: 'tarifs.modifier' });
  const [commission, metiers] = await Promise.all([lireParametre('commission_par_personne'), lireParametre('metiers')]);
  return (
    <>
      <TitrePage titre="Paramètres" />
      <Formulaires commission={commission} metiers={metiers} />
    </>
  );
}
