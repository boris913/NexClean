// Vue Responsable finances (specs/MVP2-05 RG-09, RG-11, RG-12, cas limite « numéro personnel ») :
// lectures seules pour la page /admin/finances (permission `finances.tableau_de_bord`). Aucune
// écriture : les actions (annuler, valider, effectuer) restent dans l'onglet Finances du Dossier.
// Sans contrôle de droits : l'appelant vérifie la permission.
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { MOYEN_CODES, type MoyenPaiement, type StatutRemboursement } from './domaine';

type Lecteur = Pick<ReturnType<typeof getDb>, 'select'>;

/** Lien vers l'onglet Finances d'un Dossier (onglet du lot A). */
export const lienFinancesDossier = (dossierId: number) => `/admin/dossiers/${dossierId}?onglet=finances`;

const JOUR = 24 * 60 * 60 * 1000;
const estJour = (j: string | undefined | null): j is string => !!j && /^\d{4}-\d{2}-\d{2}$/.test(j);

export interface FiltresEncaissements {
  /** Période sur la date de réception (AAAA-MM-JJ, bornes incluses). */
  du?: string | null;
  au?: string | null;
  moyen?: string | null;
  limite?: number;
}

/** Filtres valides (dates AAAA-MM-JJ, moyen connu) ; les autres valeurs sont ignorées. */
export function normaliserFiltres(f: FiltresEncaissements): { du: string | null; au: string | null; moyen: MoyenPaiement | null; limite: number } {
  const moyen = f.moyen && (MOYEN_CODES as readonly string[]).includes(f.moyen) ? (f.moyen as MoyenPaiement) : null;
  return { du: estJour(f.du) ? f.du : null, au: estJour(f.au) ? f.au : null, moyen, limite: Math.min(Math.max(f.limite ?? 50, 1), 200) };
}

const colonnesDossier = { dossierId: schema.dossier.id, numeroDossier: schema.dossier.numero, clientNom: schema.client.nom };

export interface LigneEncaissementFinances {
  id: number;
  dossierId: number;
  numeroDossier: string;
  clientNom: string;
  type: (typeof schema.encaissement.$inferSelect)['type'];
  nature: (typeof schema.encaissement.$inferSelect)['nature'];
  montant: number;
  moyen: MoyenPaiement;
  reference: string | null;
  recuLe: string;
  recuNumero: string | null;
  commentaire: string | null;
  auteurNom: string | null;
  creeLe: Date;
  /** Encaissement annulé par une écriture d'annulation. */
  annule: boolean;
}

/** Écritures récentes (toutes natures et types), filtrées par période de réception et moyen. */
export async function encaissementsRecents(filtres: FiltresEncaissements = {}, db: Lecteur = getDb()): Promise<LigneEncaissementFinances[]> {
  const f = normaliserFiltres(filtres);
  const conditions: SQL[] = [];
  if (f.du) conditions.push(gte(schema.encaissement.recuLe, f.du));
  if (f.au) conditions.push(lte(schema.encaissement.recuLe, f.au));
  if (f.moyen) conditions.push(eq(schema.encaissement.moyen, f.moyen));
  const lignes = await db
    .select({
      ...colonnesDossier,
      id: schema.encaissement.id,
      type: schema.encaissement.type,
      nature: schema.encaissement.nature,
      montant: schema.encaissement.montant,
      moyen: schema.encaissement.moyen,
      reference: schema.encaissement.reference,
      recuLe: schema.encaissement.recuLe,
      recuNumero: schema.encaissement.recuNumero,
      commentaire: schema.encaissement.commentaire,
      auteurNom: schema.user.name,
      creeLe: schema.encaissement.creeLe,
      annule: sql<boolean>`exists (select 1 from ${schema.encaissement} a where a.annule_encaissement_id = ${schema.encaissement.id})`,
    })
    .from(schema.encaissement)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.encaissement.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.user, eq(schema.user.id, schema.encaissement.auteurId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.encaissement.recuLe), desc(schema.encaissement.id))
    .limit(f.limite);
  return lignes;
}

/**
 * Cas limite « paiement reçu sur le numéro personnel d'un collaborateur » : Encaissements au moyen
 * « Autre » (commentaire obligatoire à la saisie), signalés au Responsable finances. Les
 * Encaissements déjà annulés sont exclus.
 */
export async function signalementsMoyenAutre(filtres: Pick<FiltresEncaissements, 'du' | 'au'> = {}, db: Lecteur = getDb()): Promise<LigneEncaissementFinances[]> {
  const lignes = await encaissementsRecents({ ...filtres, moyen: 'autre', limite: 200 }, db);
  return lignes.filter((l) => l.type === 'encaissement' && !l.annule);
}

export interface DemandeAnnulationFinances {
  id: number;
  encaissementId: number;
  dossierId: number;
  numeroDossier: string;
  clientNom: string;
  montant: number;
  moyen: MoyenPaiement;
  recuNumero: string | null;
  motif: string;
  demandeParNom: string | null;
  demandeLe: Date;
}

/** RG-02 : demandes d'annulation en attente (les plus anciennes d'abord). */
export async function demandesAnnulationEnAttente(db: Lecteur = getDb()): Promise<DemandeAnnulationFinances[]> {
  return db
    .select({
      ...colonnesDossier,
      id: schema.demandeAnnulation.id,
      encaissementId: schema.encaissement.id,
      montant: schema.encaissement.montant,
      moyen: schema.encaissement.moyen,
      recuNumero: schema.encaissement.recuNumero,
      motif: schema.demandeAnnulation.motif,
      demandeParNom: schema.user.name,
      demandeLe: schema.demandeAnnulation.demandeLe,
    })
    .from(schema.demandeAnnulation)
    .innerJoin(schema.encaissement, eq(schema.encaissement.id, schema.demandeAnnulation.encaissementId))
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.encaissement.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.user, eq(schema.user.id, schema.demandeAnnulation.demandeParId))
    .where(eq(schema.demandeAnnulation.statut, 'en_attente'))
    .orderBy(asc(schema.demandeAnnulation.demandeLe), asc(schema.demandeAnnulation.id));
}

export interface RemboursementFinances {
  id: number;
  dossierId: number;
  numeroDossier: string;
  clientNom: string;
  montant: number;
  statut: StatutRemboursement;
  prepareLe: Date;
  prepareParNom: string | null;
  valideLe: Date | null;
}

/** RG-11 : remboursements `à valider` (Direction) ou `validés` à effectuer (Finances / Direction). */
export async function remboursementsParStatut(statut: 'a_valider' | 'valide', db: Lecteur = getDb()): Promise<RemboursementFinances[]> {
  return db
    .select({
      ...colonnesDossier,
      id: schema.remboursement.id,
      montant: schema.remboursement.montant,
      statut: schema.remboursement.statut,
      prepareLe: schema.remboursement.prepareLe,
      prepareParNom: schema.user.name,
      valideLe: schema.remboursement.valideLe,
    })
    .from(schema.remboursement)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.remboursement.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.user, eq(schema.user.id, schema.remboursement.prepareParId))
    .where(eq(schema.remboursement.statut, statut))
    .orderBy(asc(schema.remboursement.prepareLe), asc(schema.remboursement.id));
}

export interface SoldeImpaye {
  dossierId: number;
  numeroDossier: string;
  clientNom: string;
  referentNom: string | null;
  factureId: number;
  factureNumero: string;
  emiseLe: Date;
  montantFinalTtc: number;
  nets: number;
  resteAPayer: number;
  /** Jours écoulés depuis l'émission de la facture de solde. */
  ancienneteJours: number;
}

/**
 * RG-09 : soldes impayés — Dossiers avec une facture de solde émise et un reste à payer > 0
 * (montant final − encaissements nets), quel que soit le statut du Dossier. Les plus anciens d’abord.
 */
export async function soldesImpayes(maintenant = new Date(), db: Lecteur = getDb()): Promise<SoldeImpaye[]> {
  const nets = db
    .select({ dossierId: schema.encaissement.dossierId, total: sql<number>`coalesce(sum(${schema.encaissement.montant}), 0)::int`.as('total') })
    .from(schema.encaissement)
    .groupBy(schema.encaissement.dossierId)
    .as('nets');
  const lignes = await db
    .select({
      ...colonnesDossier,
      referentNom: schema.user.name,
      factureId: schema.facture.id,
      factureNumero: schema.facture.numero,
      emiseLe: schema.facture.emiseLe,
      montantFinalTtc: schema.dossier.montantFinalTtc,
      nets: sql<number>`coalesce(${nets.total}, 0)::int`,
    })
    .from(schema.facture)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.facture.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.user, eq(schema.user.id, schema.dossier.referentId))
    .leftJoin(nets, eq(nets.dossierId, schema.dossier.id))
    .where(and(eq(schema.facture.type, 'solde'), isNotNull(schema.dossier.montantFinalTtc)))
    .orderBy(asc(schema.facture.emiseLe), asc(schema.facture.id));
  // Une seule ligne par Dossier : la dernière facture de solde émise.
  const parDossier = new Map<number, (typeof lignes)[number]>();
  for (const l of lignes) parDossier.set(l.dossierId, l);
  return [...parDossier.values()]
    .map((l) => ({ ...l, montantFinalTtc: l.montantFinalTtc!, resteAPayer: l.montantFinalTtc! - l.nets, ancienneteJours: Math.max(0, Math.floor((maintenant.getTime() - l.emiseLe.getTime()) / JOUR)) }))
    .filter((l) => l.resteAPayer > 0)
    .sort((a, b) => b.ancienneteJours - a.ancienneteJours || a.dossierId - b.dossierId);
}

export interface CreditClientFinances {
  clientId: number;
  clientNom: string;
  credit: number;
  /** Dernier Dossier à l'origine d'un mouvement (lien vers son onglet Finances). */
  dossierId: number | null;
  numeroDossier: string | null;
}

/** RG-12 : crédits clients disponibles (somme des mouvements > 0), du plus élevé au plus faible. */
export async function creditsClientsDisponibles(db: Lecteur = getDb()): Promise<CreditClientFinances[]> {
  const soldes = await db
    .select({ clientId: schema.mouvementCredit.clientId, clientNom: schema.client.nom, credit: sql<number>`sum(${schema.mouvementCredit.montant})::int`, dossierId: sql<number | null>`max(${schema.mouvementCredit.dossierId})` })
    .from(schema.mouvementCredit)
    .innerJoin(schema.client, eq(schema.client.id, schema.mouvementCredit.clientId))
    .groupBy(schema.mouvementCredit.clientId, schema.client.nom)
    .having(sql`sum(${schema.mouvementCredit.montant}) > 0`)
    .orderBy(desc(sql`sum(${schema.mouvementCredit.montant})`));
  const ids = soldes.map((s) => s.dossierId).filter((x): x is number => x !== null);
  const numeros = ids.length ? await db.select({ id: schema.dossier.id, numero: schema.dossier.numero }).from(schema.dossier).where(inArray(schema.dossier.id, ids)) : [];
  const numero = new Map(numeros.map((n) => [n.id, n.numero]));
  return soldes.map((s) => ({ ...s, dossierId: s.dossierId === null ? null : Number(s.dossierId), numeroDossier: s.dossierId === null ? null : (numero.get(Number(s.dossierId)) ?? null) }));
}

export interface VueFinances {
  encaissements: LigneEncaissementFinances[];
  moyenAutre: LigneEncaissementFinances[];
  demandesAnnulation: DemandeAnnulationFinances[];
  remboursementsAValider: RemboursementFinances[];
  remboursementsAEffectuer: RemboursementFinances[];
  impayes: SoldeImpaye[];
  credits: CreditClientFinances[];
}

/** Toutes les lectures de la page /admin/finances. */
export async function vueFinances(filtres: FiltresEncaissements = {}, maintenant = new Date(), db: Lecteur = getDb()): Promise<VueFinances> {
  const [encaissements, moyenAutre, demandesAnnulation, remboursementsAValider, remboursementsAEffectuer, impayes, credits] = await Promise.all([
    encaissementsRecents(filtres, db),
    signalementsMoyenAutre({ du: filtres.du, au: filtres.au }, db),
    demandesAnnulationEnAttente(db),
    remboursementsParStatut('a_valider', db),
    remboursementsParStatut('valide', db),
    soldesImpayes(maintenant, db),
    creditsClientsDisponibles(db),
  ]);
  return { encaissements, moyenAutre, demandesAnnulation, remboursementsAValider, remboursementsAEffectuer, impayes, credits };
}
