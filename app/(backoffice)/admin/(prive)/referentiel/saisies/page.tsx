// M1-GEO-04 : revue des saisies « Autre quartier » et rattachement au référentiel.
import { exigerCollaborateur } from '@/lib/authz/session';
import { listesLieux, saisiesAutreQuartier } from '@/lib/geo/service';
import { TitrePage } from '@/components/backoffice/ui';
import ListeSaisies from './ListeSaisies';

export const metadata = { title: 'Saisies « Autre quartier »' };

export default async function PageSaisies() {
  await exigerCollaborateur({ permission: 'referentiel.gerer' });
  const [saisies, lieux] = await Promise.all([saisiesAutreQuartier(), listesLieux()]);

  return (
    <>
      <TitrePage titre="Saisies « Autre quartier »" retour={{ href: '/admin/referentiel', libelle: 'Référentiel' }} />
      <p className="text-sm text-ink-600 mb-4">
        Quartiers saisis librement dans les formulaires, faute de les trouver dans la liste. Rattachez chaque saisie à un quartier existant
        (faute de frappe, autre orthographe) ou créez le quartier : tous les dossiers de la ville portant cette saisie sont mis à jour.
      </p>
      <ListeSaisies saisies={saisies} lieux={lieux} />
    </>
  );
}
