// ADR 0013 §3 : nouvelle offre en brouillon, vierge (recrutement interne) ou pré-remplie depuis
// une Ligne de poste (?ligne=ID, lien depuis le Dossier), anonymisée et à relire avant publication.
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { lireLigneLiee, preremplirDepuisLigne } from '@/lib/offres/service';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { EntreeOffre } from '@/lib/offres/domaine';
import { Alerte, TitrePage } from '@/components/backoffice/ui';
import { FormulaireOffre } from '../Formulaire';

export const metadata = { title: 'Nouvelle offre' };
export const dynamic = 'force-dynamic';

const VIERGE: EntreeOffre = {
  slug: '',
  titre: '',
  categorie: 'Agent de nettoyage',
  origine: 'interne',
  lignePosteId: null,
  lieu: 'Douala',
  contrat: 'À préciser',
  secteur: null,
  postes: 1,
  description: '',
  exigences: [],
  intro: null,
  missions: [],
  profil: [],
  horaires: [],
  salaire: null,
  valableJusquau: null,
  accordSalaireClient: false,
};

export default async function NouvelleOffre({ searchParams }: { searchParams: Promise<{ ligne?: string }> }) {
  const c = await exigerAccesVivier('offre.gerer');
  const ligneId = Number((await searchParams).ligne) || null;
  let offre = VIERGE;
  let erreur: string | null = null;
  let ligne: { libelle: string } | null = null;
  if (ligneId) {
    try {
      offre = await preremplirDepuisLigne(ligneId, { id: c.id, roles: c.roles, ip: c.ip });
      const l = await lireLigneLiee(ligneId);
      if (l) ligne = { libelle: `la ligne « ${l.intitule} » du dossier ${l.numero}` };
    } catch (e) {
      if (!(e instanceof ErreurMetier)) throw e;
      erreur = e.message;
    }
  }
  return (
    <>
      <TitrePage titre="Nouvelle offre" retour={{ href: '/admin/offres', libelle: 'Offres d’emploi' }} />
      {erreur && <Alerte>{erreur}</Alerte>}
      {ligne && (
        <div className="mb-4">
          <Alerte type="info">Brouillon pré-rempli depuis {ligne.libelle}. Relisez-le : aucun nom de client ne doit apparaître, et le salaire n’est publié qu’avec l’accord du client.</Alerte>
        </div>
      )}
      <FormulaireOffre offre={offre} ligne={ligne} />
    </>
  );
}
