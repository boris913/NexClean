// Propositions et Placements (ADR 0010, 0011, 0015, 0017 ; specs/MVP2-03). Module pur :
// aucune dépendance serveur, testable unitairement.

/** RG-01 : états d'une Proposition. */
export const STATUTS_PROPOSITION = {
  en_attente_accord: 'En attente d’accord',
  proposee: 'Proposée',
  entretien: 'Entretien',
  retenue: 'Retenue',
  refusee: 'Refusée',
  placee: 'Placée',
  refusee_candidat: 'Refusée par le candidat',
  retiree: 'Retirée',
} as const;

export type StatutProposition = keyof typeof STATUTS_PROPOSITION;
export const STATUT_PROPOSITION_CODES = Object.keys(STATUTS_PROPOSITION) as [StatutProposition, ...StatutProposition[]];

/** Statuts qui ne comptent plus comme « active » (RG-05 : une seule Proposition active par ligne). */
export const STATUTS_PROPOSITION_INACTIFS: readonly StatutProposition[] = ['refusee', 'refusee_candidat', 'retiree'];
export const estActive = (s: StatutProposition) => !STATUTS_PROPOSITION_INACTIFS.includes(s);

/** Statuts où le profil est transmis au client (page de suivi, liens temporaires ; RG-07, RG-10). */
export const STATUTS_TRANSMIS: readonly StatutProposition[] = ['proposee', 'entretien', 'retenue', 'placee'];
export const estTransmise = (s: StatutProposition) => STATUTS_TRANSMIS.includes(s);

/** Statuts encore « en cours » : retirés à la clôture de la recherche (RG-22). */
export const STATUTS_EN_COURS: readonly StatutProposition[] = ['en_attente_accord', 'proposee', 'entretien', 'retenue'];

export const MODES_ACCORD = { espace: 'Espace candidat', whatsapp: 'WhatsApp (capture jointe)' } as const;
export type ModeAccord = keyof typeof MODES_ACCORD;

/**
 * Transitions manuelles du référent (RG-01, RG-04, RG-12, RG-13). Les passages automatiques
 * (accord → proposée, confirmation du placement → placée, clôture → retirée) passent par les
 * fonctions d'effet (lib/propositions/effets.ts) et ne figurent pas ici.
 * `refusee_candidat` n'est jamais une cible manuelle ni une origine (RG-04).
 */
const TRANSITIONS_REFERENT: Record<StatutProposition, readonly StatutProposition[]> = {
  en_attente_accord: ['retiree'],
  proposee: ['entretien', 'retenue', 'refusee', 'retiree'],
  entretien: ['retenue', 'refusee', 'retiree'],
  retenue: ['refusee', 'retiree'],
  refusee: [],
  placee: [],
  refusee_candidat: [],
  retiree: [],
};

export const transitionsReferent = (de: StatutProposition): readonly StatutProposition[] => TRANSITIONS_REFERENT[de];

export type VerdictProposition = { ok: true } | { ok: false; erreur: string };

export function verifierTransitionProposition(de: StatutProposition, vers: StatutProposition, motif?: string | null): VerdictProposition {
  if (de === vers) return { ok: false, erreur: 'La proposition est déjà dans ce statut.' };
  if (de === 'refusee_candidat') return { ok: false, erreur: 'Le candidat a refusé : une nouvelle proposition exige un nouvel accord.' };
  if (vers === 'proposee') return { ok: false, erreur: 'La proposition passe à « Proposée » uniquement avec l’accord du candidat.' };
  if (vers === 'placee') return { ok: false, erreur: 'La proposition passe à « Placée » à la confirmation du placement.' };
  if (!TRANSITIONS_REFERENT[de].includes(vers)) return { ok: false, erreur: `Passage de « ${STATUTS_PROPOSITION[de]} » à « ${STATUTS_PROPOSITION[vers]} » impossible.` };
  // RG-13 : motif obligatoire quand le référent saisit un refus ; idem pour un retrait.
  if ((vers === 'refusee' || vers === 'retiree') && !motif?.trim()) return { ok: false, erreur: 'Indiquez le motif.' };
  return { ok: true };
}

/** RG-02 : statuts du Dossier où l'on peut créer une Proposition. */
export const STATUTS_DOSSIER_PROPOSITION = ['recherche_en_cours', 'candidats_proposes'] as const;
export const MESSAGE_STATUT_DOSSIER_PROPOSITION = 'Le dossier doit être « Recherche en cours » ou « Candidats proposés » pour proposer des candidats.';

// ─── Placements (RG-14..19) ─────────────────────────────────

export const STATUTS_PLACEMENT = {
  annonce: 'Annoncé',
  confirme: 'Confirmé',
  rompu_garantie: 'Rompu pendant la garantie',
  termine: 'Terminé',
  abandonne: 'Abandonné',
} as const;

export type StatutPlacement = keyof typeof STATUTS_PLACEMENT;
export const STATUT_PLACEMENT_CODES = Object.keys(STATUTS_PLACEMENT) as [StatutPlacement, ...StatutPlacement[]];

export const MODES_CONFIRMATION = { client: 'Confirmé par le client (page de suivi)', preuve: 'Preuve jointe par le référent' } as const;
export type ModeConfirmation = keyof typeof MODES_CONFIRMATION;

/** Durées par défaut (paramètres `garantie_jours`, `delai_recherche_jours`). */
export const GARANTIE_JOURS_PAR_DEFAUT = 15;
export const DELAI_RECHERCHE_JOURS_PAR_DEFAUT = 30;
/** RG-20 : alerte au référent N jours avant l'échéance. */
export const ALERTE_ECHEANCE_JOURS = 5;
/** RG-10 : validité d'un lien d'accès temporaire à un profil. */
export const VALIDITE_LIEN_PROFIL_JOURS = 7;
/** MVP2-01 RG-14 : Proposition sans réponse du candidat signalée au référent. */
export const DELAI_REPONSE_CANDIDAT_HEURES = 72;
/** RG-07 : vérification des 4 chiffres. */
export const MAX_ESSAIS_VERIFICATION = 5;
export const BLOCAGE_VERIFICATION_MS = 30 * 60 * 1000;

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface PlacementPourDecompte {
  statut: StatutPlacement;
  remplacement: boolean;
}

/**
 * RG-18, RG-22 : nombre de placements retenus pour le montant final = placements confirmés
 * (encore en poste, terminés ou rompus pendant la garantie), hors remplacements.
 */
export function compterPlacementsRetenus(placements: readonly PlacementPourDecompte[]): number {
  return placements.filter((p) => !p.remplacement && (p.statut === 'confirme' || p.statut === 'rompu_garantie' || p.statut === 'termine')).length;
}

/** RG-17 : décompte « X placés / Y demandés » d'une ligne (placements confirmés, remplacements inclus en poste). */
export function compterPlacesLigne(placements: readonly PlacementPourDecompte[]): number {
  return placements.filter((p) => p.statut === 'confirme' || p.statut === 'termine').length;
}

/** RG-18 / RG-19 : la rupture est-elle dans la garantie ? (jour de prise de poste + N jours, inclus). */
export function dansLaGarantie(datePriseDePoste: Date, dateRupture: Date, garantieJours: number): boolean {
  return dateRupture.getTime() - datePriseDePoste.getTime() <= garantieJours * JOUR_MS;
}

/** RG-20 : échéance = encaissement de l'acompte + délai figé (jours). */
export function echeanceRecherche(acompteLe: Date, delaiJours: number): Date {
  return new Date(acompteLe.getTime() + delaiJours * JOUR_MS);
}

export const alerteEcheanceDue = (echeance: Date, maintenant: Date) => maintenant.getTime() >= echeance.getTime() - ALERTE_ECHEANCE_JOURS * JOUR_MS;

export interface EtatCloture {
  /** Tous les postes pourvus (placements confirmés ≥ demandés sur chaque ligne). */
  tousPourvus: boolean;
  echeance: Date | null;
  maintenant: Date;
  motif?: string | null;
  /** Placements encore `annonce` (RG-21 : bloquent la clôture). */
  annonces: readonly { id: number; libelle: string }[];
}

export type VerdictCloture = { ok: true } | { ok: false; erreur: string; annonces?: readonly { id: number; libelle: string }[] };

/** RG-21 : clôture possible si tout est pourvu, à l'échéance, ou avant avec motif ; jamais avec des placements annoncés. */
export function verifierCloture(e: EtatCloture): VerdictCloture {
  if (e.annonces.length) return { ok: false, erreur: 'Confirmez ou abandonnez d’abord les placements encore annoncés.', annonces: e.annonces };
  const echue = e.echeance !== null && e.maintenant.getTime() >= e.echeance.getTime();
  if (!e.tousPourvus && !echue && !e.motif?.trim()) return { ok: false, erreur: 'Avant l’échéance, indiquez le motif de la clôture.' };
  return { ok: true };
}

// ─── Présentation au client (RG-07, RG-08) ──────────────────

/** « Awa N. » : prénom + initiale du nom. Candidat pseudonymisé (prénom vide) : « Candidat #8F3A ». */
export function nomAffichable(prenom: string, nom: string): string {
  if (!prenom.trim()) return nom.trim();
  const initiale = nom.trim().charAt(0).toUpperCase();
  return initiale ? `${prenom.trim()} ${initiale}.` : prenom.trim();
}

/** RG-07 : les 4 derniers chiffres du numéro WhatsApp (E.164). */
export function quatreDerniersChiffres(e164: string): string {
  return e164.replace(/\D/g, '').slice(-4);
}

/** RG-09 : texte du filigrane apposé sur les CV PDF. */
export function texteFiligrane(client: string, date: Date, fuseau = 'Africa/Douala'): string {
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, dateStyle: 'long' }).format(date);
  return `Transmis par NEXCLEAN à ${client} le ${jour}`;
}
