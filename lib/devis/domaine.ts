// Devis, avenants, factures (ADR 0008, 0009, 0010, 0020 ; specs/MVP2-04). Module pur : aucune
// dépendance serveur, testable unitairement. Montants en FCFA entiers.

// ─── États du devis (RG-07) ─────────────────────────────────

export const STATUTS_DEVIS = {
  brouillon: 'Brouillon',
  attente_direction: 'En attente de validation direction',
  valide: 'Validé',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  remplace: 'Remplacé',
} as const;
export type StatutDevis = keyof typeof STATUTS_DEVIS;
export const STATUT_DEVIS_CODES = Object.keys(STATUTS_DEVIS) as [StatutDevis, ...StatutDevis[]];

export const TYPES_DEVIS = { devis: 'Devis', avenant: 'Avenant' } as const;
export type TypeDevis = keyof typeof TYPES_DEVIS;

/** Statuts modifiables (RG-07 : un devis validé n'est plus modifiable). */
export const estModifiable = (s: StatutDevis) => s === 'brouillon' || s === 'attente_direction';
/** RG-07 : statuts terminaux. */
export const estTermine = (s: StatutDevis) => s === 'accepte' || s === 'refuse' || s === 'expire' || s === 'remplace';

export const MODES_ACCEPTATION = { suivi: 'Page de suivi', whatsapp: 'WhatsApp (capture jointe)' } as const;
export type ModeAcceptation = keyof typeof MODES_ACCEPTATION;

// ─── Factures (RG-16..18, ADR 0020) ─────────────────────────

export const TYPES_FACTURE = { acompte: 'Facture d’acompte', solde: 'Facture de solde', avoir: 'Avoir' } as const;
export type TypeFacture = keyof typeof TYPES_FACTURE;

/** Préfixes des séquences de numérotation (table sequence_document). */
export const PREFIXES = { devis: 'DEV', facture: 'FAC', recu: 'REÇ' } as const;
export type Sequence = keyof typeof PREFIXES;
export const formaterNumeroDocument = (sequence: Sequence, annee: number, n: number) => `${PREFIXES[sequence]}-${annee}-${String(n).padStart(5, '0')}`;

// ─── Calcul (RG-04) ─────────────────────────────────────────

/** Arrondi à la centaine supérieure (RG-04 : 29 812,5 → 29 900). */
export const arrondiCentaineSuperieure = (montant: number) => Math.ceil(montant / 100) * 100;

export interface LigneSaisie {
  /** Ligne de poste du Dossier (null pour une ligne d'avenant sans ligne de poste). */
  lignePosteId: number | null;
  intitule: string;
  nombre: number;
}

export interface LigneDevis extends LigneSaisie {
  /** Commission unitaire HT figée (RG-02). */
  commission: number;
  montantHt: number;
}

export interface Tarifs {
  commission: number;
  /** Commission par catégorie de poste (intitulé normalisé → montant), optionnelle (RG-01). */
  commissionsParCategorie: Record<string, number>;
  /** Taux de TVA en pourcentage (0 = « TVA non applicable »). */
  tauxTva: number;
}

export const cleCategorie = (intitule: string) =>
  intitule
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Commission applicable à un intitulé : catégorie si définie, sinon commission générale. */
export function commissionPour(intitule: string, t: Pick<Tarifs, 'commission' | 'commissionsParCategorie'>): number {
  const parCle = Object.fromEntries(Object.entries(t.commissionsParCategorie).map(([k, v]) => [cleCategorie(k), v]));
  return parCle[cleCategorie(intitule)] ?? t.commission;
}

export interface Totaux {
  lignes: LigneDevis[];
  totalHt: number;
  montantTva: number;
  totalTtc: number;
  tauxAcompte: number;
  acompte: number;
}

export function calculerDevis(lignes: readonly LigneSaisie[], tarifs: Tarifs, tauxAcompte: number): Totaux {
  const calculees = lignes.map((l) => {
    const commission = commissionPour(l.intitule, tarifs);
    return { ...l, commission, montantHt: commission * l.nombre };
  });
  const totalHt = calculees.reduce((s, l) => s + l.montantHt, 0);
  const montantTva = Math.round((totalHt * tarifs.tauxTva) / 100);
  const totalTtc = totalHt + montantTva;
  return { lignes: calculees, totalHt, montantTva, totalTtc, tauxAcompte, acompte: arrondiCentaineSuperieure((totalTtc * tauxAcompte) / 100) };
}

/** Recalcule les totaux à partir de lignes déjà figées (commissions conservées, RG-02). */
export function totauxFiges(lignes: readonly LigneDevis[], tauxTva: number, tauxAcompte: number): Omit<Totaux, 'lignes'> {
  const totalHt = lignes.reduce((s, l) => s + l.commission * l.nombre, 0);
  const montantTva = Math.round((totalHt * tauxTva) / 100);
  const totalTtc = totalHt + montantTva;
  return { totalHt, montantTva, totalTtc, tauxAcompte, acompte: arrondiCentaineSuperieure((totalTtc * tauxAcompte) / 100) };
}

/** RG-19 : mention TVA. */
export const mentionTva = (tauxTva: number) => (tauxTva > 0 ? `TVA ${tauxTva} %` : 'TVA non applicable');

export const formaterMontant = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ')} FCFA`;

// ─── Taux d'acompte (RG-06) ─────────────────────────────────

export interface BornesAcompte {
  min: number;
  max: number;
}

export type VerdictTaux = { ok: true; validationDirection: boolean } | { ok: false; erreur: string };

/**
 * RG-06 : un taux différent du défaut exige une justification ; hors bornes, le devis part
 * en validation Direction.
 */
export function verifierTauxAcompte(taux: number, defaut: number, bornes: BornesAcompte, justification?: string | null): VerdictTaux {
  if (!Number.isInteger(taux) || taux < 0 || taux > 100) return { ok: false, erreur: 'Le taux d’acompte doit être un pourcentage entier entre 0 et 100.' };
  if (taux !== defaut && !justification?.trim()) return { ok: false, erreur: `Justifiez le taux d’acompte (${taux} % au lieu de ${defaut} %).` };
  return { ok: true, validationDirection: taux < bornes.min || taux > bornes.max };
}

// ─── Contrôle « À compléter » (RG-05) ───────────────────────

export interface DonneesDossierDevis {
  statut: string;
  clientNom: string | null;
  whatsapp: string | null;
  villeId: number | null;
  villeAutre: string | null;
  lignes: readonly { intitule: string; nombre: number | null }[];
}

/** Données manquantes (vide = devis possible). « À compléter » bloque aussi. */
export function donneesManquantes(d: DonneesDossierDevis): string[] {
  const manque: string[] = [];
  if (!d.clientNom?.trim()) manque.push('raison sociale ou nom du client');
  if (!d.whatsapp?.trim()) manque.push('numéro WhatsApp du client');
  if (!d.lignes.some((l) => (l.nombre ?? 0) > 0)) manque.push('au moins un poste avec un nombre de personnes');
  if (!d.villeId && !d.villeAutre?.trim()) manque.push('ville');
  return manque;
}

export const MESSAGE_A_COMPLETER = 'Le dossier est « À compléter » : complétez-le avant de créer un devis.';

// ─── Montant final, solde, avoir (ADR 0010, RG-18) ──────────

export interface LigneMontantFinal {
  lignePosteId: number | null;
  /** Commission unitaire HT figée au devis (ou à l'avenant). */
  commission: number;
  /** Placements retenus (hors remplacements) sur la ligne. */
  placementsRetenus: number;
}

/** Montant final HT = Σ commission figée × placements retenus, puis TVA figée. */
export function montantFinal(lignes: readonly LigneMontantFinal[], tauxTva: number): { totalHt: number; montantTva: number; totalTtc: number } {
  const totalHt = lignes.reduce((s, l) => s + l.commission * l.placementsRetenus, 0);
  const montantTva = Math.round((totalHt * tauxTva) / 100);
  return { totalHt, montantTva, totalTtc: totalHt + montantTva };
}

export type Regularisation = { type: 'solde'; montantTtc: number } | { type: 'avoir'; montantTtc: number } | { type: 'aucune' };

/** RG-18 : solde = montant final TTC − acompte facturé TTC ; négatif → avoir de la différence. */
export function regularisation(montantFinalTtc: number, acompteFactureTtc: number): Regularisation {
  const ecart = montantFinalTtc - acompteFactureTtc;
  if (ecart > 0) return { type: 'solde', montantTtc: ecart };
  if (ecart < 0) return { type: 'avoir', montantTtc: -ecart };
  return { type: 'aucune' };
}

/** Décompose un TTC en HT + TVA (taux figé), pour les factures de solde et avoirs. */
export function decomposerTtc(ttc: number, tauxTva: number): { totalHt: number; montantTva: number; totalTtc: number } {
  const totalHt = tauxTva > 0 ? Math.round((ttc * 100) / (100 + tauxTva)) : ttc;
  return { totalHt, montantTva: ttc - totalHt, totalTtc: ttc };
}

/** RG-14 : date d'expiration = date d'envoi + validité (jours). */
export function dateExpiration(envoyeLe: Date, validiteJours: number): Date {
  return new Date(envoyeLe.getTime() + validiteJours * 24 * 60 * 60 * 1000);
}
