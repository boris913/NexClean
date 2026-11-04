// Encaissements, solde, trop-perçu, remboursements, crédit client (specs/MVP2-05 ; ADR 0004,
// 0009, 0010, 0018, 0020). Module pur : aucune dépendance serveur, testable unitairement.
//
// Convention des montants (FCFA, entiers) : un Encaissement reçu est **positif** ; une écriture
// d'annulation (RG-02) porte l'opposé de l'Encaissement annulé ; un remboursement effectué
// (RG-11) est un Encaissement **négatif**. Crédit client (RG-12) : le trop-perçu versé au crédit
// est une écriture `credit` **négative** (nature `autre`) sur le Dossier d'origine ; son
// utilisation est une écriture `credit` **positive** (nature `acompte`) sur le Dossier qui en
// bénéficie. « Encaissements nets » = somme de toutes ces écritures.

export const NATURES_ENCAISSEMENT = { acompte: 'Acompte', solde: 'Solde', autre: 'Autre' } as const;
export type NatureEncaissement = keyof typeof NATURES_ENCAISSEMENT;
export const NATURE_CODES = Object.keys(NATURES_ENCAISSEMENT) as [NatureEncaissement, ...NatureEncaissement[]];

export const MOYENS_PAIEMENT = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  especes: 'Espèces',
  virement: 'Virement',
  cheque: 'Chèque',
  autre: 'Autre',
  /** Écritures `credit` uniquement (jamais proposé à la saisie). */
  credit_client: 'Crédit client',
} as const;
export type MoyenPaiement = keyof typeof MOYENS_PAIEMENT;
export const MOYEN_CODES = Object.keys(MOYENS_PAIEMENT) as [MoyenPaiement, ...MoyenPaiement[]];
/** Moyens proposés à la saisie d'un Encaissement ou d'un remboursement (RG-01). */
export const MOYENS_SAISIE = MOYEN_CODES.filter((m) => m !== 'credit_client');

/** Type d'écriture : encaissement reçu, annulation (écriture inverse, RG-02), remboursement effectué (RG-11), crédit client (RG-12). */
export const TYPES_ECRITURE = { encaissement: 'Encaissement', annulation: 'Annulation', remboursement: 'Remboursement', credit: 'Crédit client' } as const;
export type TypeEcriture = keyof typeof TYPES_ECRITURE;
export const TYPE_ECRITURE_CODES = Object.keys(TYPES_ECRITURE) as [TypeEcriture, ...TypeEcriture[]];

/** RG-11 : cycle d'un remboursement. */
export const STATUTS_REMBOURSEMENT = { a_valider: 'À valider', valide: 'Validé', refuse: 'Refusé', effectue: 'Effectué' } as const;
export type StatutRemboursement = keyof typeof STATUTS_REMBOURSEMENT;
export const STATUT_REMBOURSEMENT_CODES = Object.keys(STATUTS_REMBOURSEMENT) as [StatutRemboursement, ...StatutRemboursement[]];
export const REMBOURSEMENT_EN_ATTENTE: readonly StatutRemboursement[] = ['a_valider', 'valide'];

/** RG-10 : choix du client pour un trop-perçu. */
export const CHOIX_AJUSTEMENT = { remboursement: 'Remboursement', credit: 'Crédit sur un prochain dossier' } as const;
export type ChoixAjustement = keyof typeof CHOIX_AJUSTEMENT;
export const CHOIX_AJUSTEMENT_CODES = Object.keys(CHOIX_AJUSTEMENT) as [ChoixAjustement, ...ChoixAjustement[]];

/** RG-02 : demande d'annulation d'un Encaissement (référent) traitée par Finances / Direction. */
export const STATUTS_DEMANDE_ANNULATION = { en_attente: 'En attente', acceptee: 'Annulation effectuée', refusee: 'Refusée' } as const;
export type StatutDemandeAnnulation = keyof typeof STATUTS_DEMANDE_ANNULATION;
export const STATUT_DEMANDE_ANNULATION_CODES = Object.keys(STATUTS_DEMANDE_ANNULATION) as [StatutDemandeAnnulation, ...StatutDemandeAnnulation[]];

// ─── Saisie (RG-01, RG-03) ─────────────────────────────────────

export interface SaisieEncaissement {
  nature: NatureEncaissement;
  montant: number;
  moyen: MoyenPaiement;
  reference?: string | null;
  /** Date de réception (AAAA-MM-JJ, fuseau Africa/Douala). */
  recuLe: string;
  /** Un justificatif est joint (photo du reçu opérateur, avis de virement). */
  aUnJustificatif: boolean;
  commentaire?: string | null;
}

/** Montant FCFA strictement positif, entier. */
export const montantValide = (n: number) => Number.isInteger(n) && n > 0 && n <= 1_000_000_000;

/**
 * RG-01 : contrôle de saisie. Référence et justificatif obligatoires sauf espèces ; date ≤ aujourd'hui ;
 * moyen « autre » (paiement sur un numéro personnel, cas limite) : commentaire obligatoire.
 * `aujourdhui` au format AAAA-MM-JJ (fuseau Africa/Douala, cf. `dateDuJour`).
 */
export function erreursSaisie(e: SaisieEncaissement, aujourdhui: string): string[] {
  const erreurs: string[] = [];
  if (!montantValide(e.montant)) erreurs.push('Le montant doit être un nombre entier de FCFA supérieur à 0.');
  if (e.moyen === 'credit_client') erreurs.push('Moyen de paiement invalide.');
  const especes = e.moyen === 'especes';
  if (!especes && !e.reference?.trim()) erreurs.push('Indiquez la référence de la transaction.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.recuLe)) erreurs.push('Indiquez la date de réception.');
  else if (e.recuLe > aujourdhui) erreurs.push('La date de réception ne peut pas être dans le futur.');
  if (!especes && !e.aUnJustificatif) erreurs.push('Joignez le justificatif (photo du reçu opérateur ou avis de virement).');
  if (e.moyen === 'autre' && !e.commentaire?.trim()) erreurs.push('Moyen « Autre » : précisez dans le commentaire (ex. numéro personnel d’un collaborateur).');
  return erreurs;
}

/** RG-03 : référence normalisée pour l'anti-doublon (casse, espaces). */
export const normaliserReference = (r: string) => r.trim().toUpperCase().replace(/\s+/g, '');

/** Date du jour AAAA-MM-JJ dans le fuseau de l'agence. */
export const dateDuJour = (maintenant = new Date(), fuseau = 'Africa/Douala') => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);

// ─── Écritures et soldes ──────────────────────────────────────

export interface Ecriture {
  id: number;
  type: TypeEcriture;
  nature: NatureEncaissement;
  /** Signé (voir la convention en tête de fichier). */
  montant: number;
  /** Annulation : Encaissement annulé. */
  annuleEncaissementId?: number | null;
}

/** Ids des Encaissements annulés (une écriture d'annulation pointe vers eux). */
export const idsAnnules = (ecritures: readonly Ecriture[]) => new Set(ecritures.filter((e) => e.type === 'annulation' && e.annuleEncaissementId).map((e) => e.annuleEncaissementId!));

/** Somme nette de toutes les écritures (encaissements − annulations − remboursements). */
export const encaissementsNets = (ecritures: readonly Ecriture[]) => ecritures.reduce((s, e) => s + e.montant, 0);

/** Somme nette des écritures de nature `acompte` (annulations comprises). */
export const acompteEncaisse = (ecritures: readonly Ecriture[]) => ecritures.filter((e) => e.nature === 'acompte' && e.type !== 'remboursement').reduce((s, e) => s + e.montant, 0);

// ─── Acompte (RG-05, RG-06, cas limite « tout payé au départ ») ─

export type EtatAcompte = { etat: 'aucun_devis' } | { etat: 'non_paye'; du: number } | { etat: 'partiel'; encaisse: number; du: number; libelle: string } | { etat: 'complet'; encaisse: number; du: number };

/** RG-05 : état de l'acompte d'après le devis accepté (ou envoyé, RG-06). */
export function etatAcompte(acompteDu: number | null, encaisse: number): EtatAcompte {
  if (acompteDu === null) return { etat: 'aucun_devis' };
  if (encaisse >= acompteDu) return { etat: 'complet', encaisse, du: acompteDu };
  if (encaisse <= 0) return { etat: 'non_paye', du: acompteDu };
  return { etat: 'partiel', encaisse, du: acompteDu, libelle: libelleAcomptePartiel(encaisse, acompteDu) };
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ');
export const libelleAcomptePartiel = (encaisse: number, du: number) => `acompte partiel : ${fcfa(encaisse)} / ${fcfa(du)}`;

/**
 * Cas limite : un Encaissement `acompte` est plafonné au reste d'acompte dû ; l'excédent est
 * enregistré en nature `autre` (imputé au solde à la clôture). Retourne la répartition.
 */
export function repartirAcompte(montant: number, acompteDu: number, dejaEncaisse: number): { acompte: number; excedent: number } {
  const reste = Math.max(0, acompteDu - dejaEncaisse);
  const acompte = Math.min(montant, reste);
  return { acompte, excedent: montant - acompte };
}

// ─── Solde et clôture (RG-07, RG-08, RG-13) ────────────────────

/** RG-08 : solde = montant final − encaissements nets (> 0 reste à payer ; < 0 trop-perçu). */
export const solde = (montantFinalTtc: number, nets: number) => montantFinalTtc - nets;

export type IssueCloture = { issue: 'solde_a_payer'; montant: number } | { issue: 'solde_nul' } | { issue: 'trop_percu'; montant: number };

/**
 * RG-08 : issue financière de la clôture de la recherche.
 * - solde > 0 : Dossier « Placements confirmés », « Solde reçu » quand le solde est encaissé ;
 * - solde = 0 : Dossier directement « Solde reçu » ;
 * - solde < 0 : trop-perçu → ajustement à préparer (RG-10).
 */
export function issueCloture(montantFinalTtc: number, nets: number): IssueCloture {
  const s = solde(montantFinalTtc, nets);
  if (s > 0) return { issue: 'solde_a_payer', montant: s };
  if (s < 0) return { issue: 'trop_percu', montant: -s };
  return { issue: 'solde_nul' };
}

export interface ContexteClotureDossier {
  /** Montant final connu (recherche clôturée) ; null sinon. */
  montantFinalTtc: number | null;
  nets: number;
  /** Remboursement `à valider` ou `validé` non encore effectué. */
  remboursementEnAttente: boolean;
  /** Trop-perçu sans ajustement préparé (choix du client non enregistré). */
  ajustementAPreparer: boolean;
  /** Documents attendus non émis (ex. PDF de facture ou de reçu manquant). */
  documentsManquants: readonly string[];
}

/** RG-13 : le Dossier peut être « Clôturé » quand le solde est nul, sans remboursement en attente, documents émis. */
export function verifierClotureDossier(c: ContexteClotureDossier): { ok: true } | { ok: false; erreur: string } {
  if (c.montantFinalTtc === null) return { ok: false, erreur: 'Le montant final n’est pas encore connu : clôturez d’abord la recherche.' };
  const s = solde(c.montantFinalTtc, c.nets);
  if (c.ajustementAPreparer) return { ok: false, erreur: 'Un trop-perçu est à régulariser : préparez l’ajustement (remboursement ou crédit).' };
  if (c.remboursementEnAttente) return { ok: false, erreur: 'Un remboursement est en attente : il doit être effectué avant la clôture.' };
  if (s > 0) return { ok: false, erreur: `Il reste ${fcfa(s)} FCFA à encaisser.` };
  if (s < 0) return { ok: false, erreur: `Trop-perçu de ${fcfa(-s)} FCFA non régularisé.` };
  if (c.documentsManquants.length) return { ok: false, erreur: `Documents non émis : ${c.documentsManquants.join(', ')}.` };
  return { ok: true };
}

// ─── Impayés (RG-09) ───────────────────────────────────────────

const JOUR = 24 * 60 * 60 * 1000;

/**
 * RG-09 : une facture de solde non réglée `delaiJours` après émission déclenche une alerte, puis
 * tous les `periodeJours`. Vrai si une relance est due maintenant.
 */
export function relanceSoldeDue(o: { emiseLe: Date; derniereRelanceLe: Date | null; maintenant: Date; delaiJours: number; periodeJours: number }): boolean {
  const premiere = o.emiseLe.getTime() + o.delaiJours * JOUR;
  if (o.maintenant.getTime() < premiere) return false;
  if (!o.derniereRelanceLe) return true;
  return o.maintenant.getTime() >= o.derniereRelanceLe.getTime() + o.periodeJours * JOUR;
}

// ─── Crédit client (RG-12) ─────────────────────────────────────

/** Déduction proposée sur un nouveau devis : le crédit disponible, plafonné au montant TTC du devis. */
export const deductionProposee = (creditDisponible: number, totalTtc: number) => Math.max(0, Math.min(creditDisponible, totalTtc));
