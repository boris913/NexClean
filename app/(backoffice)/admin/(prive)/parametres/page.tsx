// MVP1-03 RG-05, MVP2-04 RG-01, RG-02 : grille tarifaire et textes des documents (historisés),
// métiers suggérés, attribution (Direction, Administrateur).
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireParametre } from '@/lib/parametres';
import { TitrePage } from '@/components/backoffice/ui';
import Formulaires from './Formulaires';
import GrilleTarifaire from './GrilleTarifaire';
import ParametresAttribution from './ParametresAttribution';
import { CLES_GRILLE, historiqueParametres } from './grille';

export const metadata = { title: 'Paramètres' };

export default async function PageParametres() {
  await exigerCollaborateur({ permission: 'tarifs.modifier' });
  const [
    commission,
    commissionsParCategorie,
    tvaTaux,
    acompteTauxDefaut,
    acompteBornes,
    delaiRechercheJours,
    garantieJours,
    validiteDevisJours,
    mentionsLegales,
    conditionsDevis,
    minimumFacturation,
    metiers,
    heures,
    delai,
    jours,
    historique,
  ] = await Promise.all([
    lireParametre('commission_par_personne'),
    lireParametre('commissions_par_categorie'),
    lireParametre('tva_taux'),
    lireParametre('acompte_taux_defaut'),
    lireParametre('acompte_bornes'),
    lireParametre('delai_recherche_jours'),
    lireParametre('garantie_jours'),
    lireParametre('validite_devis_jours'),
    lireParametre('mentions_legales'),
    lireParametre('conditions_devis'),
    lireParametre('minimum_facturation'),
    lireParametre('metiers'),
    lireParametre('heures_ouvrees'),
    lireParametre('delai_escalade_heures'),
    lireParametre('jours_sans_action'),
    historiqueParametres(CLES_GRILLE),
  ]);
  return (
    <>
      <TitrePage titre="Paramètres" description="Grille tarifaire, documents, métiers suggérés et attribution." />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-3">Grille tarifaire et documents</h2>
      <GrilleTarifaire
        valeurs={{ commission, commissionsParCategorie, tvaTaux, acompteTauxDefaut, acompteBornes, delaiRechercheJours, garantieJours, validiteDevisJours, mentionsLegales, conditionsDevis, minimumFacturation }}
        historique={historique}
        metiers={metiers}
      />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 mt-8 mb-3">Demandes et attribution</h2>
      <Formulaires metiers={metiers} />
      <div className="mt-4">
        <ParametresAttribution heures={heures} delai={delai} jours={jours} />
      </div>
    </>
  );
}
