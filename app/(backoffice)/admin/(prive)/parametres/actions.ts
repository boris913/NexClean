'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { definirParametre } from '@/lib/parametres';
import { revaliderCommissionPublique } from '@/lib/commission-publique';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { contientPrix } from '@/lib/whatsapp/automate';
import { commissionsDepuisPaires, verifierAcompte, type PaireCategorie } from './grille';

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'tarifs.modifier' });
  return { id: c.id, ip: c.ip };
}

export async function enregistrerCommission(montant: number) {
  return executer(async () => {
    await definirParametre('commission_par_personne', montant, await auteur());
    revalidatePath('/admin/parametres');
    revalidatePath('/recrutement/demander-du-personnel');
    revaliderCommissionPublique();
    return 'Commission enregistrée. Elle s’applique aux nouveaux devis ; les devis existants et les demandes déjà reçues conservent leurs montants.';
  });
}

export async function enregistrerMetiers(texte: string) {
  return executer(async () => {
    const liste = texte.split('\n').map((l) => l.trim()).filter(Boolean);
    await definirParametre('metiers', liste, await auteur());
    revalidatePath('/admin/parametres');
    return `${liste.length} métiers enregistrés.`;
  });
}

/** MVP1-05 RG-06, RG-07, RG-11 : heures ouvrées, délai d'escalade, seuil « sans action ». */
export async function enregistrerAttribution(heures: unknown, delai: number, jours: number) {
  return executer(async () => {
    const a = await auteur();
    await definirParametre('heures_ouvrees', heures, a);
    await definirParametre('delai_escalade_heures', delai, a);
    await definirParametre('jours_sans_action', jours, a);
    revalidatePath('/admin/parametres');
    return 'Paramètres d’attribution enregistrés.';
  });
}

// ─── Grille tarifaire et documents (MVP2-04 RG-01, RG-02) ───

const RAPPEL = 'Applicable aux nouveaux devis uniquement.';

/** Commissions par catégorie de poste (paires intitulé / montant ; liste vide = aucune). */
export async function enregistrerCommissionsCategorie(paires: PaireCategorie[]) {
  return executer(async () => {
    const valeur = commissionsDepuisPaires(paires);
    await definirParametre('commissions_par_categorie', valeur, await auteur());
    revalidatePath('/admin/parametres');
    const n = Object.keys(valeur).length;
    return n ? `${n} commission${n > 1 ? 's' : ''} par catégorie enregistrée${n > 1 ? 's' : ''}. ${RAPPEL}` : `Aucune commission par catégorie : la commission générale s’applique à tous les postes. ${RAPPEL}`;
  });
}

export async function enregistrerTva(taux: number) {
  return executer(async () => {
    await definirParametre('tva_taux', taux, await auteur());
    revalidatePath('/admin/parametres');
    return `Taux de TVA enregistré. Il s’applique aux nouveaux devis uniquement ; les devis et factures déjà émis restent inchangés.`;
  });
}

/** Taux d'acompte par défaut et bornes (le défaut doit être compris dans les bornes). */
export async function enregistrerAcompte(defaut: number, min: number, max: number) {
  return executer(async () => {
    const v = verifierAcompte(Number(defaut), Number(min), Number(max));
    const a = await auteur();
    await definirParametre('acompte_bornes', v.bornes, a);
    await definirParametre('acompte_taux_defaut', v.defaut, a);
    revalidatePath('/admin/parametres');
    return `Acompte enregistré. ${RAPPEL}`;
  });
}

/** Délai de recherche, garantie de remplacement, validité d'un devis (jours). */
export async function enregistrerDelais(delaiRecherche: number, garantie: number, validite: number) {
  return executer(async () => {
    const a = await auteur();
    await definirParametre('delai_recherche_jours', delaiRecherche, a);
    await definirParametre('garantie_jours', garantie, a);
    await definirParametre('validite_devis_jours', validite, a);
    revalidatePath('/admin/parametres');
    return 'Délais enregistrés. Ils s’appliquent aux nouveaux devis uniquement.';
  });
}

export async function enregistrerTexte(cle: 'mentions_legales' | 'conditions_devis', texte: string) {
  return executer(async () => {
    if (cle !== 'mentions_legales' && cle !== 'conditions_devis') throw new ErreurMetier('Paramètre inconnu.');
    await definirParametre(cle, String(texte ?? ''), await auteur());
    revalidatePath('/admin/parametres');
    return cle === 'mentions_legales'
      ? 'Mentions légales enregistrées. Elles figurent sur les nouveaux documents ; les documents déjà émis restent inchangés.'
      : `Conditions générales enregistrées. ${RAPPEL}`;
  });
}

/** COM2-02 : réponses automatiques WhatsApp (règles « mots => réponse », une par ligne). */
export async function enregistrerWhatsApp(v: { accuseOuvert: string; accuseFerme: string; reponses: string; suspensionHeures: number; plafondMarketing: number }) {
  return executer(async () => {
    const regles = String(v.reponses ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l, i) => {
        const [mots, ...reste] = l.split('=>');
        const reponse = reste.join('=>').trim();
        if (!mots?.trim() || !reponse) throw new ErreurMetier(`Ligne ${i + 1} : écrivez « mots-clés => réponse ».`);
        return { mots: mots.split(',').map((m) => m.trim()).filter(Boolean), reponse };
      });
    const prix = [v.accuseOuvert, v.accuseFerme, ...regles.map((r) => r.reponse)].find((t) => contientPrix(t));
    if (prix) throw new ErreurMetier(`Une réponse automatique ne doit pas annoncer de prix : « ${prix.slice(0, 60)}… »`);
    const a = await auteur();
    await definirParametre('wa_accuse_ouvert', v.accuseOuvert, a);
    await definirParametre('wa_accuse_ferme', v.accuseFerme, a);
    await definirParametre('wa_reponses_rapides', regles, a);
    await definirParametre('wa_suspension_heures', Number(v.suspensionHeures), a);
    await definirParametre('wa_plafond_marketing_semaine', Number(v.plafondMarketing), a);
    revalidatePath('/admin/parametres');
    return `Réponses automatiques enregistrées (${regles.length} règle(s) par mots-clés).`;
  });
}
