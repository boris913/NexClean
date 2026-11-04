// Effets partagés des Encaissements (specs/MVP2-05), appelés **dans une transaction** par le
// Back-Office (onglet Finances), la clôture de la recherche et les remboursements. Indépendant de
// Next.js ; les contrôles de droits sont faits par l'appelant.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { genererPdfRecu } from '@/lib/documents/rendu';
import { archiverPdf, prochainNumero, transitionAutomatique, type Tx } from '@/lib/devis/effets';
import { acompteEncaisse, encaissementsNets, REMBOURSEMENT_EN_ATTENTE, type Ecriture } from './domaine';

type Lecteur = Pick<ReturnType<typeof getDb>, 'select'>;

/** Écritures d'un Dossier, dans l'ordre (date de réception, puis saisie). */
export async function ecrituresDossier(db: Lecteur, dossierId: number) {
  return db
    .select()
    .from(schema.encaissement)
    .where(eq(schema.encaissement.dossierId, dossierId))
    .orderBy(asc(schema.encaissement.recuLe), asc(schema.encaissement.id));
}

export const versEcriture = (e: typeof schema.encaissement.$inferSelect): Ecriture => ({ id: e.id, type: e.type, nature: e.nature, montant: e.montant, annuleEncaissementId: e.annuleEncaissementId });

/**
 * Devis de référence pour les Encaissements : le devis (type `devis`) accepté ; à défaut, la
 * dernière version `envoyée` (RG-06 : acompte payé avant l'acceptation formelle).
 */
export async function devisDeReference(db: Lecteur, dossierId: number) {
  const [accepte] = await db
    .select()
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis'), eq(schema.devis.statut, 'accepte')))
    .orderBy(desc(schema.devis.id))
    .limit(1);
  if (accepte) return accepte;
  const [envoye] = await db
    .select()
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis'), eq(schema.devis.statut, 'envoye')))
    .orderBy(desc(schema.devis.id))
    .limit(1);
  return envoye ?? null;
}

/**
 * Acompte dû TTC d'un devis : l'acompte figé. Une déduction de crédit client (RG-12) n'en est pas
 * retranchée : elle est imputée par une écriture `credit` positive de nature `acompte`.
 */
export const acompteDu = (d: { acompte: number }) => d.acompte;

/** Date (instant) d'une date de réception AAAA-MM-JJ : midi à Douala, pour éviter les décalages de jour. */
export const instantDeDate = (jour: string) => new Date(`${jour}T12:00:00+01:00`);

/**
 * RG-05 : après un Encaissement (ou une annulation), fait passer le Dossier « Accepté » →
 * « Acompte reçu » quand la somme des Encaissements `acompte` atteint l'acompte du devis
 * **accepté**, et fige `acompteCompletLe` = date de réception de l'Encaissement qui le complète
 * (départ du délai de recherche, MVP2-03 RG-20). Retourne vrai si la transition a eu lieu.
 */
export async function appliquerGardeAcompte(tx: Tx, dossierId: number): Promise<boolean> {
  const [d] = await tx.select({ statut: schema.dossier.statut }).from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d || d.statut !== 'accepte') return false;
  const dv = await devisDeReference(tx, dossierId);
  if (!dv || dv.statut !== 'accepte') return false;
  const du = acompteDu(dv);
  const lignes = await ecrituresDossier(tx, dossierId);
  if (acompteEncaisse(lignes.map(versEcriture)) < du) return false;
  // Encaissement qui complète l'acompte : premier instant où le cumul `acompte` atteint le dû.
  let cumul = 0;
  let completeLe: string | null = null;
  for (const e of lignes) {
    if (e.nature !== 'acompte' || e.type === 'remboursement') continue;
    cumul += e.montant;
    if (cumul >= du && completeLe === null) completeLe = e.recuLe;
    if (cumul < du) completeLe = null;
  }
  const fait = await transitionAutomatique(tx, dossierId, ['accepte'], 'acompte_recu', 'acompte encaissé');
  if (fait) await tx.update(schema.dossier).set({ acompteCompletLe: instantDeDate(completeLe ?? lignes.at(-1)!.recuLe) }).where(eq(schema.dossier.id, dossierId));
  return fait;
}

/** Remboursement `à valider` ou `validé` non effectué sur le Dossier. */
export async function aUnRemboursementEnAttente(db: Lecteur, dossierId: number): Promise<boolean> {
  const r = await db
    .select({ id: schema.remboursement.id })
    .from(schema.remboursement)
    .where(and(eq(schema.remboursement.dossierId, dossierId), inArray(schema.remboursement.statut, [...REMBOURSEMENT_EN_ATTENTE])))
    .limit(1);
  return r.length > 0;
}

/**
 * RG-08, RG-11 : fait passer le Dossier « Placements confirmés » → « Solde reçu » quand le montant
 * final est connu, que le solde (montant final − encaissements nets) est nul ou entièrement payé,
 * sans trop-perçu non régularisé ni remboursement en attente. Retourne vrai si la transition a eu lieu.
 */
export async function appliquerGardeSolde(tx: Tx, dossierId: number): Promise<boolean> {
  const [d] = await tx.select({ statut: schema.dossier.statut, montantFinalTtc: schema.dossier.montantFinalTtc }).from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d || d.statut !== 'placements_confirmes' || d.montantFinalTtc === null) return false;
  const nets = encaissementsNets((await ecrituresDossier(tx, dossierId)).map(versEcriture));
  const s = d.montantFinalTtc - nets;
  if (s > 0) return false;
  if (s < 0) return false; // trop-perçu : solde reçu après le remboursement effectué ou le crédit (RG-10..12)
  if (await aUnRemboursementEnAttente(tx, dossierId)) return false;
  return transitionAutomatique(tx, dossierId, ['placements_confirmes'], 'solde_recu', 'solde entièrement réglé');
}

/** Numéro de reçu REÇ-AAAA-NNNNN, attribué dans la transaction d'enregistrement (sans trou). */
export const prochainNumeroRecu = (tx: Tx) => prochainNumero(tx, 'recu');

/** Génère et archive le PDF d'un reçu (après la transaction d'enregistrement). Idempotent. */
export async function archiverPdfRecu(encaissementId: number): Promise<number> {
  const [deja] = await getDb().select({ documentId: schema.recuPdf.documentId }).from(schema.recuPdf).where(eq(schema.recuPdf.encaissementId, encaissementId));
  if (deja) return deja.documentId;
  const [e] = await getDb().select({ recuNumero: schema.encaissement.recuNumero, dossierId: schema.encaissement.dossierId }).from(schema.encaissement).where(eq(schema.encaissement.id, encaissementId));
  if (!e?.recuNumero) throw new ErreurMetier('Reçu introuvable.');
  const octets = await genererPdfRecu(encaissementId);
  return getDb().transaction(async (tx) => {
    const { documentId, empreinte } = await archiverPdf(e.dossierId, `${e.recuNumero}.pdf`, octets, 'recu', { type: 'systeme' }, tx);
    await tx.insert(schema.recuPdf).values({ encaissementId, documentId, empreinte }).onConflictDoNothing();
    return documentId;
  });
}

/** Archive le PDF d'un reçu sans faire échouer l'opération appelante. */
export async function archiverPdfRecuSansEchec(encaissementId: number): Promise<number | null> {
  try {
    return await archiverPdfRecu(encaissementId);
  } catch (e) {
    console.error(`Archivage du PDF du reçu ${encaissementId} impossible :`, e);
    return null;
  }
}

/** RG-12 : crédit disponible d'un Client (somme des mouvements). */
export async function creditDisponible(db: Lecteur, clientId: number): Promise<number> {
  const lignes = await db.select({ montant: schema.mouvementCredit.montant }).from(schema.mouvementCredit).where(eq(schema.mouvementCredit.clientId, clientId));
  return lignes.reduce((s, l) => s + l.montant, 0);
}
