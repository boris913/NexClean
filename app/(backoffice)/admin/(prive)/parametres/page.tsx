// MVP1-03 RG-05 : commission par personne et liste de métiers suggérés (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireParametre } from '@/lib/parametres';
import { TitrePage } from '@/components/backoffice/ui';
import Formulaires from './Formulaires';
import ParametresAttribution from './ParametresAttribution';

export const metadata = { title: 'Paramètres' };

export default async function PageParametres() {
  await exigerCollaborateur({ permission: 'tarifs.modifier' });
  const [commission, metiers, heures, delai, jours] = await Promise.all([
    lireParametre('commission_par_personne'),
    lireParametre('metiers'),
    lireParametre('heures_ouvrees'),
    lireParametre('delai_escalade_heures'),
    lireParametre('jours_sans_action'),
  ]);
  return (
    <>
      <TitrePage titre="Paramètres" />
      <Formulaires commission={commission} metiers={metiers} />
      <div className="mt-4">
        <ParametresAttribution heures={heures} delai={delai} jours={jours} />
      </div>
    </>
  );
}
