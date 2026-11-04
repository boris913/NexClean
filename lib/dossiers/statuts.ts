// Cycles de statuts, phases et règles de transition (ADR 0007 ; specs/MVP1-02 RG-12..18).
// Module pur : aucune dépendance serveur, testable unitairement.
import type { DossierType } from '@/lib/domain/referentiels';

export const STATUTS = {
  nouvelle_demande: 'Nouvelle demande',
  attribuee: 'Attribuée',
  en_qualification: 'En qualification',
  a_completer: 'À compléter',
  devis_pret: 'Devis prêt',
  devis_envoye: 'Devis envoyé',
  accepte: 'Accepté',
  acompte_recu: 'Acompte reçu',
  recherche_en_cours: 'Recherche en cours',
  candidats_proposes: 'Candidats proposés',
  placements_confirmes: 'Placements confirmés',
  en_cours: 'En cours',
  termine: 'Terminé',
  solde_recu: 'Solde reçu',
  cloture: 'Clôturé',
  refuse: 'Refusé',
  sans_suite: 'Sans suite',
} as const;

export type Statut = keyof typeof STATUTS;
export const STATUT_CODES = Object.keys(STATUTS) as [Statut, ...Statut[]];

export const PHASES = {
  nouveau: 'Nouveau',
  qualification: 'En qualification',
  devis: 'Devis',
  accepte: 'Accepté',
  execution: 'En exécution',
  termine: 'Terminé',
  cloture: 'Clôturé',
  issue: 'Refusé / Sans suite',
} as const;

export type Phase = keyof typeof PHASES;

const PHASE_DU_STATUT: Record<Statut, Phase> = {
  nouvelle_demande: 'nouveau',
  attribuee: 'nouveau',
  en_qualification: 'qualification',
  a_completer: 'qualification',
  devis_pret: 'devis',
  devis_envoye: 'devis',
  accepte: 'accepte',
  acompte_recu: 'execution',
  recherche_en_cours: 'execution',
  candidats_proposes: 'execution',
  en_cours: 'execution',
  placements_confirmes: 'termine',
  termine: 'termine',
  solde_recu: 'termine',
  cloture: 'cloture',
  refuse: 'issue',
  sans_suite: 'issue',
};

export const phaseDe = (s: Statut): Phase => PHASE_DU_STATUT[s];

/** Ordre de progression des phases (hors issues), pour « dossier ouvert ». */
const ORDRE_PHASES: Phase[] = ['nouveau', 'qualification', 'devis', 'accepte', 'execution', 'termine', 'cloture'];

/** Dossier ouvert = phase antérieure à « Terminé » (ADR 0019, calcul de charge). */
export const estOuvert = (s: Statut) => {
  const p = phaseDe(s);
  return p !== 'issue' && ORDRE_PHASES.indexOf(p) < ORDRE_PHASES.indexOf('termine');
};

export const STATUTS_FINAUX: readonly Statut[] = ['cloture', 'refuse', 'sans_suite'];
export const estFinal = (s: Statut) => STATUTS_FINAUX.includes(s);

/** Cycle principal (sans les issues) ; « À compléter » est une boucle sur « En qualification ». */
const CYCLE_RECRUTEMENT: Statut[] = ['nouvelle_demande', 'attribuee', 'en_qualification', 'devis_pret', 'devis_envoye', 'accepte', 'acompte_recu', 'recherche_en_cours', 'candidats_proposes', 'placements_confirmes', 'solde_recu', 'cloture'];
const CYCLE_GENERIQUE: Statut[] = ['nouvelle_demande', 'attribuee', 'en_qualification', 'devis_pret', 'devis_envoye', 'accepte', 'acompte_recu', 'en_cours', 'termine', 'solde_recu', 'cloture'];

export const cycleDe = (type: DossierType): Statut[] => (type === 'REC' ? CYCLE_RECRUTEMENT : CYCLE_GENERIQUE);

/** Libellés présentés au client sur la page de suivi (RG-26). */
export const LIBELLE_CLIENT: Record<Phase, string> = {
  nouveau: 'Demande reçue',
  qualification: 'En cours d’étude',
  devis: 'Devis en préparation / envoyé',
  accepte: 'Devis accepté',
  execution: 'En cours de réalisation',
  termine: 'Réalisé',
  cloture: 'Dossier clôturé',
  issue: 'Dossier fermé',
};

/** Position d'un statut dans le cycle (« À compléter » compte comme « En qualification »). */
function rang(type: DossierType, s: Statut): number {
  return cycleDe(type).indexOf(s === 'a_completer' ? 'en_qualification' : s);
}

export interface ContexteTransition {
  type: DossierType;
  de: Statut;
  vers: Statut;
  commentaire?: string | null;
  /** Le demandeur a le rôle Direction (réouverture, RG-18). */
  direction: boolean;
  /** Transition automatique (attribution) : seule « Nouvelle demande → Attribuée » est permise. */
  automatique?: boolean;
  /** Pièces du dossier, pour les gardes transitoires MVP-1 (RG-16). */
  aUnDevisExterne: boolean;
  aUnJustificatif: boolean;
  /**
   * MVP2-04 RG-08 : le Dossier suit le circuit du devis intégré (« Devis prêt », « Devis envoyé »,
   * « Accepté » fixés par le devis). Par défaut : dossiers REC. Voir `estCircuitDevis`.
   */
  circuitDevis?: boolean;
  /** MVP2-04 RG-08 : le dernier devis du Dossier est refusé (réouverture par le référent). */
  dernierDevisRefuse?: boolean;
}

/** MVP2-04 RG-08 : statuts fixés par le devis intégré (dossiers REC). */
export const STATUTS_DU_DEVIS: readonly Statut[] = ['devis_pret', 'devis_envoye', 'accepte'];
export const MESSAGE_CIRCUIT_DEVIS = 'Pour un dossier de recrutement, « Devis prêt », « Devis envoyé » et « Accepté » suivent le devis : passez par l’onglet Devis (valider, « Valider et envoyer », acceptation).';

/**
 * MVP2-04 RG-03, RG-08 : un dossier REC suit le circuit du devis intégré, sauf un dossier ouvert
 * avant MVP-2 en mode transitoire (devis externe joint, aucun devis intégré, déjà « Devis prêt » ou
 * « Devis envoyé ») : il termine son cycle à la main. Les autres types restent en mode transitoire.
 */
export function estCircuitDevis(c: { type: DossierType; statut: Statut; aDesDevis: boolean; aUnDevisExterne: boolean }): boolean {
  if (c.type !== 'REC') return false;
  return !(!c.aDesDevis && c.aUnDevisExterne && (c.statut === 'devis_pret' || c.statut === 'devis_envoye'));
}

export type Verdict = { ok: true; retourArriere: boolean } | { ok: false; erreur: string };

/** MVP2-03 RG-22 : l'avancée vers « Placements confirmés » passe par la clôture de la recherche. */
export const MESSAGE_CLOTURE_RECHERCHE = 'Pour passer à « Placements confirmés », utilisez « Clôturer la recherche » (onglet Propositions).';

/**
 * Valide une transition manuelle selon RG-12..18 et les gardes transitoires RG-16.
 * Les droits (référent du dossier ou Direction) sont vérifiés par l'appelant.
 */
export function verifierTransition(c: ContexteTransition): Verdict {
  const { type, de, vers } = c;
  const commentaire = c.commentaire?.trim() ?? '';
  if (de === vers) return { ok: false, erreur: 'Le dossier est déjà dans ce statut.' };
  if (!STATUT_CODES.includes(vers) || (vers !== 'a_completer' && vers !== 'refuse' && vers !== 'sans_suite' && rang(type, vers) < 0)) {
    return { ok: false, erreur: 'Statut non applicable à ce type de dossier.' };
  }
  if (c.automatique) {
    return de === 'nouvelle_demande' && vers === 'attribuee' ? { ok: true, retourArriere: false } : { ok: false, erreur: 'Transition automatique non autorisée.' };
  }

  const circuit = c.circuitDevis ?? type === 'REC';
  // MVP2-04 RG-08 : statuts fixés par le devis intégré, jamais posés à la main.
  if (circuit && STATUTS_DU_DEVIS.includes(vers)) return { ok: false, erreur: MESSAGE_CIRCUIT_DEVIS };

  // MVP2-04 RG-08 : le référent rouvre un dossier REC refusé, pour une nouvelle version du devis refusé.
  if (circuit && de === 'refuse' && vers === 'en_qualification' && c.dernierDevisRefuse) return { ok: true, retourArriere: true };

  // RG-18 : statuts finaux réouvrables par la Direction uniquement, avec commentaire.
  if (estFinal(de)) {
    if (!c.direction) return { ok: false, erreur: 'Seule la Direction peut rouvrir un dossier fermé.' };
    if (!commentaire) return { ok: false, erreur: 'Indiquez le motif de la réouverture.' };
    if (estFinal(vers)) return { ok: false, erreur: 'Choisissez un statut ouvert pour rouvrir le dossier.' };
    return { ok: true, retourArriere: true };
  }

  // Issues possibles depuis tout statut non final (RG-12), commentaire obligatoire (RG-15).
  if (vers === 'refuse' || vers === 'sans_suite') {
    if (!commentaire) return { ok: false, erreur: 'Indiquez le motif.' };
    return { ok: true, retourArriere: false };
  }

  // « À compléter » ⇄ « En qualification ».
  if (vers === 'a_completer') {
    if (de !== 'en_qualification') return { ok: false, erreur: '« À compléter » n’est possible que depuis « En qualification ».' };
    if (!commentaire) return { ok: false, erreur: 'Indiquez les informations manquantes.' };
    return { ok: true, retourArriere: false };
  }
  if (de === 'a_completer' && vers !== 'en_qualification' && rang(type, vers) > rang(type, de)) {
    return { ok: false, erreur: 'Repassez d’abord le dossier « En qualification ».' };
  }

  const rDe = rang(type, de);
  const rVers = rang(type, vers);
  if (vers === 'attribuee') return { ok: false, erreur: '« Attribuée » est fixé par l’attribution du dossier.' };

  // Retour en arrière : autorisé avec commentaire (RG-15).
  if (rVers < rDe) {
    if (!commentaire) return { ok: false, erreur: 'Indiquez le motif du retour en arrière.' };
    return { ok: true, retourArriere: true };
  }

  // Avancée : une étape à la fois (sauf sortie de « À compléter » vers « En qualification »).
  if (rVers !== rDe + 1 && !(de === 'a_completer' && vers === 'en_qualification')) {
    return { ok: false, erreur: `Étape suivante attendue : ${STATUTS[cycleDe(type)[rDe + 1]!]}.` };
  }

  // Gardes transitoires MVP-1 (RG-16), remplacées en MVP-2.
  if ((vers === 'devis_pret' || vers === 'devis_envoye') && !c.aUnDevisExterne) {
    return { ok: false, erreur: 'Joignez d’abord le devis (document de catégorie « Devis externe »).' };
  }
  if (vers === 'acompte_recu' || vers === 'solde_recu') {
    if (!commentaire) return { ok: false, erreur: 'Indiquez le montant, le moyen de paiement et la référence.' };
    if (!c.aUnJustificatif) return { ok: false, erreur: 'Joignez le justificatif de paiement (document de catégorie « Justificatif »).' };
  }
  // MVP2-03 RG-21, RG-22 : « Placements confirmés » est fixé par la clôture de la recherche.
  if (vers === 'placements_confirmes') {
    return { ok: false, erreur: MESSAGE_CLOTURE_RECHERCHE };
  }
  return { ok: true, retourArriere: false };
}

/** Statuts proposés dans l'interface depuis un statut donné (avancée, À compléter, issues). */
export function transitionsProposees(type: DossierType, de: Statut, direction: boolean, o: { circuitDevis?: boolean; dernierDevisRefuse?: boolean } = {}): Statut[] {
  const circuit = o.circuitDevis ?? type === 'REC';
  const manuel = (s: Statut) => !(circuit && STATUTS_DU_DEVIS.includes(s));
  if (estFinal(de)) {
    if (direction) return cycleDe(type).filter((s) => !estFinal(s) && s !== 'nouvelle_demande' && s !== 'attribuee' && manuel(s));
    return circuit && de === 'refuse' && o.dernierDevisRefuse ? ['en_qualification'] : [];
  }
  const cycle = cycleDe(type);
  const suivant = de === 'a_completer' ? 'en_qualification' : cycle[rang(type, de) + 1];
  const liste: Statut[] = [];
  // « Placements confirmés » : bouton « Clôturer la recherche » (MVP2-03 RG-22), pas une transition manuelle.
  // MVP2-04 RG-08 : statuts du devis intégré fixés par l'onglet Devis.
  if (suivant && suivant !== 'attribuee' && suivant !== 'placements_confirmes' && manuel(suivant)) liste.push(suivant);
  if (de === 'en_qualification') liste.push('a_completer');
  liste.push('refuse', 'sans_suite');
  return liste;
}
