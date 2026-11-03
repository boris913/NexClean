// M1-GEO-03 : administration du référentiel géographique (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import Link from 'next/link';
import { lireReferentiel, saisiesAutreQuartier } from '@/lib/geo/service';
import { Alerte, TitrePage } from '@/components/backoffice/ui';
import Arbre from './Arbre';

export const metadata = { title: 'Référentiel géographique' };

export default async function PageReferentiel() {
  await exigerCollaborateur({ permission: 'referentiel.gerer' });
  const [villes, saisies] = await Promise.all([lireReferentiel(), saisiesAutreQuartier()]);
  return (
    <>
      <TitrePage titre="Référentiel géographique" />
      <p className="text-sm text-ink-600 mb-4">
        Les entrées ne sont jamais supprimées : désactivez-les pour les retirer des listes. Les coordonnées d’un quartier servent au filtre par rayon.
        Les villes « couvertes » et les quartiers cochés « Sur le site » sont ceux qu’annonce le site public ; il est mis à jour aussitôt.
      </p>
      {saisies.length > 0 && (
        <div className="mb-4">
          <Alerte type="info">
            {saisies.length} saisie(s) « Autre quartier » à revoir.{' '}
            <Link href="/admin/referentiel/saisies" className="underline font-medium">Les rattacher au référentiel</Link>
          </Alerte>
        </div>
      )}
      <Arbre villes={villes} />
    </>
  );
}
