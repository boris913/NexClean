// M1-GEO-03 : administration du référentiel géographique (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireReferentiel } from '@/lib/geo/service';
import { TitrePage } from '@/components/backoffice/ui';
import Arbre from './Arbre';

export const metadata = { title: 'Référentiel géographique' };

export default async function PageReferentiel() {
  await exigerCollaborateur({ permission: 'referentiel.gerer' });
  const villes = await lireReferentiel();
  return (
    <>
      <TitrePage titre="Référentiel géographique" />
      <p className="text-sm text-ink-600 mb-4">
        Les entrées ne sont jamais supprimées : désactivez-les pour les retirer des listes. Les coordonnées d’un quartier servent au filtre par rayon.
      </p>
      <Arbre villes={villes} />
    </>
  );
}
