// Dépenses et tableau de bord direction (specs/POST-03 ; ADR 0020). Module pur : vocabulaire,
// validation, période, indicateurs dérivés, tranches d'ancienneté et export CSV, sans dépendance
// serveur, testable unitairement. Les sommes sont calculées en SQL (lib/depenses/indicateurs.ts) ;
// ce module ne fait que les combiner selon les définitions uniques de l'ADR 0020 §2.
import { z } from 'zod';
import { DOSSIER_TYPE_CODES, DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { MOYENS_PAIEMENT, MOYENS_SAISIE, type MoyenPaiement } from '@/lib/encaissements/domaine';

// ─── Catégories (RG-02) ───────────────────────────────────────

/** Liste initiale semée par la migration (valeur par défaut, à confirmer par la Direction). */
export const CATEGORIES_INITIALES = [
  'Salaires et primes',
  'Transport',
  'Produits et consommables',
  'Matériel',
  'Loyer et charges',
  'Communication et publicité',
  'Téléphone et internet',
  'Impôts et taxes',
  'Frais bancaires et mobile money',
  'Autre',
] as const;

export const schemaCategorie = z.object({
  libelle: z.string().trim().min(2, 'Libellé trop court').max(80, 'Libellé trop long (80 caractères au plus)'),
  ordre: z.number().int().min(0).max(1000).optional().default(100),
});
export type EntreeCategorie = z.input<typeof schemaCategorie>;

// ─── Saisie d'une dépense (RG-01, RG-03) ──────────────────────

/** RG-01 : moyens de paiement des Encaissements, hors « Crédit client » (écriture interne). */
export const MOYENS_DEPENSE = MOYENS_SAISIE as readonly Exclude<MoyenPaiement, 'credit_client'>[];
export type MoyenDepense = (typeof MOYENS_DEPENSE)[number];

export const MONTANT_MAX = 1_000_000_000;
const JOUR_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

export const schemaDepense = z.object({
  /** Date de la dépense (AAAA-MM-JJ, fuseau Africa/Douala) : c'est elle qui range la dépense dans une période. */
  depenseLe: z.string().trim().regex(JOUR_REGEX, 'Indiquez la date de la dépense.'),
  categorieId: z.number({ error: 'Choisissez une catégorie.' }).int().positive('Choisissez une catégorie.'),
  libelle: z.string().trim().min(2, 'Indiquez un libellé (ex. « Taxi Akwa – Bonamoussadi »).').max(200, 'Libellé trop long (200 caractères au plus).'),
  montant: z
    .number({ error: 'Le montant doit être un nombre entier de FCFA supérieur à 0.' })
    .int('Le montant doit être un nombre entier de FCFA supérieur à 0.')
    .positive('Le montant doit être un nombre entier de FCFA supérieur à 0.')
    .max(MONTANT_MAX, 'Montant trop élevé.'),
  moyen: z.enum(MOYENS_DEPENSE as unknown as [MoyenDepense, ...MoyenDepense[]], 'Moyen de paiement invalide.'),
  reference: texteFacultatif(100),
  villeId: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
  /** Numéro du Dossier rattaché (ex. REC-2026-00012), facultatif. */
  dossierNumero: z
    .string()
    .trim()
    .toUpperCase()
    .nullable()
    .optional()
    .transform((v) => v || null),
  /** RG-04 : service rattaché sans Dossier (ignoré si un Dossier est indiqué : son type fait foi). */
  service: z.enum(DOSSIER_TYPE_CODES, 'Service inconnu.').nullable().optional().transform((v) => v ?? null),
  commentaire: texteFacultatif(1000),
});
export type EntreeDepense = z.input<typeof schemaDepense>;
export type DonneesDepense = z.output<typeof schemaDepense>;

/** RG-01 : la date d'une dépense ne peut pas être dans le futur. Retourne l'erreur, ou null. */
export function erreurDateDepense(depenseLe: string, aujourdhui: string): string | null {
  if (!JOUR_REGEX.test(depenseLe)) return 'Indiquez la date de la dépense.';
  if (depenseLe > aujourdhui) return 'La date de la dépense ne peut pas être dans le futur.';
  return null;
}

/** RG-04 : service de rattachement — le type du Dossier s'il y en a un, sinon le service choisi. */
export const serviceRattache = (typeDossier: DossierType | null, serviceChoisi: DossierType | null): DossierType | null => typeDossier ?? serviceChoisi;

/** RG-06 : motif d'annulation obligatoire. */
export function motifAnnulationValide(motif: string | null | undefined): string | null {
  const m = motif?.trim() ?? '';
  return m.length >= 3 ? m.slice(0, 500) : null;
}

// ─── Période (RG-08) ──────────────────────────────────────────

export interface Periode {
  /** Bornes incluses, AAAA-MM-JJ (fuseau Africa/Douala). */
  du: string;
  au: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const estJourValide = (j: string | null | undefined): j is string => {
  if (!j || !JOUR_REGEX.test(j)) return false;
  const d = new Date(`${j}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === j;
};

/** Premier et dernier jour du mois contenant `jour` (AAAA-MM-JJ). */
export function moisDe(jour: string): Periode {
  const [a, m] = jour.split('-').map(Number) as [number, number];
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { du: `${a}-${pad(m)}-01`, au: `${a}-${pad(m)}-${pad(dernier)}` };
}

/** Mois précédant celui qui contient `jour`. */
export function moisPrecedent(jour: string): Periode {
  const [a, m] = jour.split('-').map(Number) as [number, number];
  return moisDe(m === 1 ? `${a - 1}-12-01` : `${a}-${pad(m - 1)}-01`);
}

/**
 * RG-08 : période choisie dans l'URL. `mois=AAAA-MM` prime ; sinon `du`/`au` valides (inversés si
 * besoin) ; à défaut, le mois en cours. Une borne seule est complétée par l'autre borne du mois.
 */
export function periodeDepuis(p: { mois?: string | null; du?: string | null; au?: string | null }, aujourdhui: string): Periode {
  if (p.mois && /^\d{4}-\d{2}$/.test(p.mois) && estJourValide(`${p.mois}-01`)) return moisDe(`${p.mois}-01`);
  const du = estJourValide(p.du) ? p.du : null;
  const au = estJourValide(p.au) ? p.au : null;
  if (du && au) return du <= au ? { du, au } : { du: au, au: du };
  if (du) return { du, au: moisDe(du).au };
  if (au) return { du: moisDe(au).du, au };
  return moisDe(aujourdhui);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourLisible = (j: string) => {
  const [a, m, d] = j.split('-').map(Number) as [number, number, number];
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${a}`;
};

/** Libellé d'une période : « novembre 2026 » pour un mois entier, sinon « du … au … ». */
export function libellePeriode(p: Periode): string {
  const m = moisDe(p.du);
  if (m.du === p.du && m.au === p.au) {
    const [a, mm] = p.du.split('-').map(Number) as [number, number];
    return `${MOIS[mm - 1]} ${a}`;
  }
  return p.du === p.au ? `le ${jourLisible(p.du)}` : `du ${jourLisible(p.du)} au ${jourLisible(p.au)}`;
}

/** Écart en jours entre deux dates AAAA-MM-JJ (b − a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// ─── Indicateurs (RG-09..RG-14, ADR 0020 §2) ──────────────────

/** Sommes brutes calculées en SQL sur la période (FCFA). */
export interface SommesPeriode {
  /** Factures d'acompte et de solde émises (hors avoirs). */
  facturesHt: number;
  facturesTtc: number;
  /** Avoirs émis (montants positifs en base, déduits du facturé). */
  avoirsHt: number;
  avoirsTtc: number;
  /** Écritures d'encaissement reçues : encaissements, annulations (négatives), remboursements (négatifs). Hors crédit client. */
  encaisse: number;
  /** Dépenses non annulées, par date de dépense. */
  depenses: number;
}

export interface Indicateurs {
  /** Facturé TTC = factures − avoirs (RG-09). */
  factureTtc: number;
  factureHt: number;
  /** Encaissé, remboursements et annulations déduits (RG-10). */
  encaisse: number;
  depenses: number;
  /** Résultat mensuel estimé = Facturé HT − Dépenses (RG-12), indicatif. */
  resultatEstime: number;
  /** Trésorerie du mois = Encaissé − Dépenses payées (RG-13). */
  tresorerie: number;
}

/** ADR 0020 §2 : combine les sommes de la période selon les définitions uniques. */
export function calculerIndicateurs(s: SommesPeriode): Indicateurs {
  const factureHt = s.facturesHt - s.avoirsHt;
  const factureTtc = s.facturesTtc - s.avoirsTtc;
  return {
    factureTtc,
    factureHt,
    encaisse: s.encaisse,
    depenses: s.depenses,
    resultatEstime: factureHt - s.depenses,
    // RG-13 : toute dépense saisie est une sortie d'argent effectuée (pas de dépense « à payer »).
    tresorerie: s.encaisse - s.depenses,
  };
}

/** RG-14 : marge = Facturé HT − Dépenses rattachées. */
export const marge = (factureHt: number, depensesRattachees: number) => factureHt - depensesRattachees;

/** Taux de marge en % (arrondi), null si rien n'est facturé. */
export const tauxMarge = (factureHt: number, depensesRattachees: number): number | null => (factureHt > 0 ? Math.round((marge(factureHt, depensesRattachees) / factureHt) * 100) : null);

// ─── Impayés par ancienneté (RG-11) ───────────────────────────

export const TRANCHES_ANCIENNETE = [
  { code: '0_30', libelle: '0 à 30 jours', max: 30 },
  { code: '31_60', libelle: '31 à 60 jours', max: 60 },
  { code: '61_90', libelle: '61 à 90 jours', max: 90 },
  { code: 'plus_90', libelle: 'Plus de 90 jours', max: Number.POSITIVE_INFINITY },
] as const;
export type TrancheAnciennete = (typeof TRANCHES_ANCIENNETE)[number]['code'];

/** Tranche d'ancienneté d'une facture impayée, en jours depuis son émission. */
export function trancheAnciennete(jours: number): TrancheAnciennete {
  return TRANCHES_ANCIENNETE.find((t) => Math.max(0, jours) <= t.max)!.code;
}

export interface FactureImpayee {
  factureId: number;
  numero: string;
  dossierId: number;
  numeroDossier: string;
  clientNom: string;
  emiseLe: string;
  totalTtc: number;
  /** Part de la facture non couverte par les encaissements nets et les avoirs du Dossier. */
  restant: number;
  ancienneteJours: number;
}

/** Ventile les factures impayées par tranche (montants et nombre), dans l'ordre des tranches. */
export function ventilerImpayes(factures: readonly Pick<FactureImpayee, 'restant' | 'ancienneteJours'>[]) {
  const tranches = TRANCHES_ANCIENNETE.map((t) => ({ code: t.code as TrancheAnciennete, libelle: t.libelle, montant: 0, nombre: 0 }));
  for (const f of factures) {
    if (f.restant <= 0) continue;
    const t = tranches.find((x) => x.code === trancheAnciennete(f.ancienneteJours))!;
    t.montant += f.restant;
    t.nombre += 1;
  }
  return { total: tranches.reduce((s, t) => s + t.montant, 0), tranches };
}

/**
 * Référence de la règle SQL de RG-11, pour un Dossier : les encaissements nets et les avoirs
 * couvrent d'abord les factures les plus anciennes ; le reste dû est donc porté par les plus
 * récentes. Retourne la part impayée de chaque facture (même ordre que l'entrée).
 */
export function restantsParFacture(factures: readonly { totalTtc: number; emiseLe: string; id: number }[], couvert: number): number[] {
  const du = factures.reduce((s, f) => s + f.totalTtc, 0) - couvert;
  const ordre = factures.map((f, i) => ({ f, i })).sort((a, b) => (a.f.emiseLe === b.f.emiseLe ? b.f.id - a.f.id : a.f.emiseLe < b.f.emiseLe ? 1 : -1));
  const restants = new Array<number>(factures.length).fill(0);
  let reste = Math.max(0, du);
  for (const { f, i } of ordre) {
    const part = Math.min(f.totalTtc, reste);
    restants[i] = part;
    reste -= part;
  }
  return restants;
}

// ─── Export comptable (RG-15) ─────────────────────────────────

export type NatureLigneComptable = 'facture' | 'avoir' | 'depense';
export const NATURES_COMPTABLES: Record<NatureLigneComptable, string> = { facture: 'Facture', avoir: 'Avoir', depense: 'Dépense' };

export interface LigneComptable {
  nature: NatureLigneComptable;
  /** AAAA-MM-JJ. */
  date: string;
  piece: string;
  libelle: string;
  categorie: string | null;
  tiers: string | null;
  dossier: string | null;
  service: DossierType | null;
  ville: string | null;
  moyen: MoyenPaiement | null;
  reference: string | null;
  /** Montants positifs tels qu'enregistrés ; l'export les signe (avoirs négatifs). */
  ht: number | null;
  tva: number | null;
  ttc: number;
  justificatif: boolean | null;
}

const champCsv = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  // Neutralise les formules (injection CSV), puis échappe les guillemets.
  const sur = typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
};

export const ENTETE_CSV_COMPTABLE = ['Nature', 'Date', 'Pièce', 'Libellé', 'Catégorie', 'Client', 'Dossier', 'Service', 'Ville', 'Moyen de paiement', 'Référence', 'Montant HT', 'TVA', 'Montant TTC', 'Justificatif'];

/**
 * RG-15 : CSV pour le comptable — séparateur « ; », UTF-8 avec BOM (Excel en français), fins de ligne
 * CRLF, montants entiers en FCFA sans séparateur de milliers. Les avoirs sont négatifs (la somme de la
 * colonne TTC des factures et avoirs donne le Facturé TTC) ; les dépenses sont positives.
 */
export function versCsvComptable(lignes: readonly LigneComptable[]): string {
  const signe = (l: LigneComptable, n: number | null) => (n === null ? null : l.nature === 'avoir' ? -n : n);
  const corps = lignes.map((l) =>
    [
      NATURES_COMPTABLES[l.nature],
      l.date,
      l.piece,
      l.libelle,
      l.categorie,
      l.tiers,
      l.dossier,
      l.service ? DOSSIER_TYPES[l.service] : null,
      l.ville,
      l.moyen ? MOYENS_PAIEMENT[l.moyen] : null,
      l.reference,
      signe(l, l.ht),
      signe(l, l.tva),
      signe(l, l.ttc),
      l.justificatif === null ? null : l.justificatif ? 'oui' : 'non',
    ]
      .map(champCsv)
      .join(';'),
  );
  return '﻿' + [ENTETE_CSV_COMPTABLE.join(';'), ...corps].join('\r\n') + '\r\n';
}

/** Nom du fichier exporté : nexclean-comptable-2026-11-01_2026-11-30.csv */
export const nomFichierExport = (p: Periode) => `nexclean-comptable-${p.du}_${p.au}.csv`;
