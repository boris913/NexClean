// Côté client des devis (specs/MVP2-04 RG-12..14, RG-19 ; ADR 0014) : devis en cours affiché sur
// la page de suivi, acceptation et refus par le client, téléchargement des documents (devis,
// factures, accusé de réception). Indépendant de Next.js.
// Le contexte et la vérification des 4 chiffres sont ceux des Propositions
// (lib/propositions/client.ts) : l'appelant contrôle le cookie de vérification (`estVerifie`)
// avant d'appeler ces fonctions. Aucune donnée interne n'est exposée (justification du taux,
// auteur, IP, navigateur, empreinte…).
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { getStockage } from '@/lib/fichiers/stockage';
import { genererAccuseReception } from '@/lib/documents/rendu';
import type { Contexte } from '@/lib/propositions/client';
import { mentionTva, TYPES_FACTURE, type StatutDevis, type TypeDevis, type TypeFacture } from './domaine';
import { accepterDevis, archiverPdf, archiverPdfFacture, refuserDevis, type Tx } from './effets';

// ─── Devis affiché au client (RG-12) ────────────────────────

/** Situation du devis vue par le client. */
export type EtatDevisClient = 'a_accepter' | 'accepte' | 'refuse' | 'expire' | 'remplace';

export interface DevisClient {
  id: number;
  type: TypeDevis;
  numero: string;
  version: number;
  etat: EtatDevisClient;
  /** Libellé lisible de l'état (« En attente de votre réponse », « Accepté »…). */
  statut: string;
  lignes: { intitule: string; nombre: number; commission: number; montantHt: number }[];
  tauxTva: number;
  mentionTva: string;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
  tauxAcompte: number;
  acompte: number;
  delaiRechercheJours: number;
  garantieJours: number;
  validiteJours: number;
  /** Avenant : prolongation du délai de recherche. */
  prolongationJours: number | null;
  envoyeLe: Date;
  expireLe: Date | null;
  conditions: string;
  conditionsParticulieres: string | null;
  /** Le PDF définitif est archivé (lien de téléchargement). */
  aPdf: boolean;
  acceptation: { le: Date; signataireNom: string; signataireFonction: string } | null;
  refuseLe: Date | null;
}

const LIBELLES_ETAT: Record<EtatDevisClient, string> = {
  a_accepter: 'En attente de votre réponse',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  remplace: 'Remplacé',
};

/** Message affiché au client pour une version remplacée (cas limite : lien ancien). */
export const MESSAGE_REMPLACE = 'Ce devis a été remplacé par une version plus récente.';

type LigneDevisBase = typeof schema.devis.$inferSelect;

/** État client : un devis `envoyé` dont la date de validité est passée est présenté comme expiré. */
export function etatClient(statut: StatutDevis, expireLe: Date | null, maintenant = new Date()): EtatDevisClient | null {
  if (statut === 'envoye') return expireLe && maintenant.getTime() > expireLe.getTime() ? 'expire' : 'a_accepter';
  if (statut === 'accepte' || statut === 'refuse' || statut === 'expire' || statut === 'remplace') return statut;
  return null;
}

function versClient(d: LigneDevisBase, maintenant: Date): DevisClient | null {
  const etat = etatClient(d.statut, d.expireLe, maintenant);
  if (!etat || !d.envoyeLe) return null;
  return {
    id: d.id,
    type: d.type,
    numero: d.numero,
    version: d.version,
    etat,
    statut: LIBELLES_ETAT[etat],
    lignes: d.lignes.map((l) => ({ intitule: l.intitule, nombre: l.nombre, commission: l.commission, montantHt: l.montantHt })),
    tauxTva: d.tauxTva,
    mentionTva: mentionTva(d.tauxTva),
    totalHt: d.totalHt,
    montantTva: d.montantTva,
    totalTtc: d.totalTtc,
    tauxAcompte: d.tauxAcompte,
    acompte: d.acompte,
    delaiRechercheJours: d.delaiRechercheJours,
    garantieJours: d.garantieJours,
    validiteJours: d.validiteJours,
    prolongationJours: d.prolongationJours,
    envoyeLe: d.envoyeLe,
    expireLe: d.expireLe,
    conditions: d.conditions,
    conditionsParticulieres: d.conditionsParticulieres?.trim() || null,
    aPdf: d.documentId !== null,
    acceptation: d.statut === 'accepte' && d.accepteLe ? { le: d.accepteLe, signataireNom: d.signataireNom ?? '', signataireFonction: d.signataireFonction ?? '' } : null,
    refuseLe: d.statut === 'refuse' ? d.refusLe : null,
  };
}

/** Versions envoyées au client (les brouillons et devis non envoyés ne sont jamais visibles). */
const conditionsEnvoyes = (dossierId: number, type?: TypeDevis) =>
  and(eq(schema.devis.dossierId, dossierId), isNotNull(schema.devis.envoyeLe), type ? eq(schema.devis.type, type) : undefined);

async function dernierEnvoye(dossierId: number, type: TypeDevis): Promise<LigneDevisBase | null> {
  const [d] = await getDb()
    .select()
    .from(schema.devis)
    .where(conditionsEnvoyes(dossierId, type))
    .orderBy(desc(schema.devis.envoyeLe), desc(schema.devis.version), desc(schema.devis.id))
    .limit(1);
  return d ?? null;
}

/**
 * RG-12 : devis en cours du Dossier (dernière version envoyée) et avenant en cours s'il y en a
 * un. Appelé après vérification des 4 chiffres. Lien temporaire de profil : rien.
 */
export async function devisPourSuivi(ctx: Contexte, maintenant = new Date()): Promise<{ devis: DevisClient | null; avenant: DevisClient | null }> {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') return { devis: null, avenant: null };
  const [d, a] = await Promise.all([dernierEnvoye(ctx.dossierId, 'devis'), dernierEnvoye(ctx.dossierId, 'avenant')]);
  return { devis: d ? versClient(d, maintenant) : null, avenant: a ? versClient(a, maintenant) : null };
}

/** Un devis a été envoyé pour ce Dossier (aucune donnée : décide l'affichage avant vérification). */
export async function devisEnvoyeExiste(ctx: Contexte): Promise<boolean> {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') return false;
  const [r] = await getDb().select({ id: schema.devis.id }).from(schema.devis).where(conditionsEnvoyes(ctx.dossierId)).limit(1);
  return !!r;
}

/**
 * Devis visé par une action du client : appartient au Dossier du contexte, a été envoyé, et est
 * la dernière version envoyée de sa chaîne (cas limite : lien ancien → « remplacé »).
 */
async function devisActionnable(tx: Tx, ctx: Contexte, devisId: number) {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') throw new ErreurMetier('Devis introuvable.');
  if (!Number.isInteger(devisId) || devisId <= 0) throw new ErreurMetier('Devis introuvable.');
  const [d] = await tx
    .select({ id: schema.devis.id, numero: schema.devis.numero, version: schema.devis.version, type: schema.devis.type, statut: schema.devis.statut, envoyeLe: schema.devis.envoyeLe })
    .from(schema.devis)
    .where(and(eq(schema.devis.id, devisId), eq(schema.devis.dossierId, ctx.dossierId)))
    .for('update');
  if (!d || !d.envoyeLe) throw new ErreurMetier('Devis introuvable.');
  if (d.statut === 'remplace') throw new ErreurMetier(MESSAGE_REMPLACE);
  const [plusRecent] = await tx
    .select({ id: schema.devis.id })
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, ctx.dossierId), eq(schema.devis.numero, d.numero), gt(schema.devis.version, d.version)))
    .limit(1);
  if (plusRecent) throw new ErreurMetier(MESSAGE_REMPLACE);
  return d;
}

// ─── Acceptation (RG-13) et refus (RG-14) ───────────────────

export interface SaisieAcceptation {
  signataireNom: string;
  signataireFonction: string;
  conditionsAcceptees: boolean;
  ip: string | null;
  navigateur: string | null;
}

/**
 * RG-13 : acceptation sur la page de suivi. Case « J'ai lu et j'accepte les conditions », nom et
 * fonction obligatoires ; horodatage, IP, navigateur et version (empreinte du PDF) enregistrés par
 * `accepterDevis`. La facture d'acompte émise est archivée en PDF après la transaction (échec non
 * bloquant, journalisé : le Back-Office ou le premier téléchargement la régénère).
 */
export async function accepterDevisClient(ctx: Contexte, devisId: number, s: SaisieAcceptation): Promise<{ facture: { id: number; numero: string } | null }> {
  if (s.conditionsAcceptees !== true) throw new ErreurMetier('Cochez la case « J’ai lu et j’accepte les conditions » pour accepter le devis.');
  const nom = String(s.signataireNom ?? '').trim();
  const fonction = String(s.signataireFonction ?? '').trim();
  if (!nom || !fonction) throw new ErreurMetier('Indiquez le nom et la fonction du signataire.');
  if (nom.length > 120 || fonction.length > 120) throw new ErreurMetier('Nom ou fonction trop long (120 caractères au plus).');
  const r = await getDb().transaction(async (tx) => {
    await devisActionnable(tx, ctx, devisId);
    return accepterDevis(tx, devisId, { mode: 'suivi', signataireNom: nom, signataireFonction: fonction, ip: s.ip, navigateur: s.navigateur }, { type: 'client', ip: s.ip });
  });
  if (r.facture) {
    try {
      await archiverPdfFacture(r.facture.id);
    } catch (e) {
      console.error(e);
      await journaliser({ acteurType: 'systeme', action: 'facture.pdf_echec', objetType: 'facture', objetId: r.facture.id, details: { numero: r.facture.numero, message: e instanceof Error ? e.message : String(e) } }).catch(() => {});
    }
  }
  return r;
}

/** RG-14 : refus par le client (motif facultatif) ; Dossier « Refusé », référent notifié. */
export async function refuserDevisClient(ctx: Contexte, devisId: number, motif: string | null, ip: string | null): Promise<void> {
  const m = motif ? String(motif).trim().slice(0, 1000) || null : null;
  await getDb().transaction(async (tx) => {
    await devisActionnable(tx, ctx, devisId);
    await refuserDevis(tx, devisId, m, { type: 'client', ip });
  });
}

// ─── Documents (RG-19, ADR 0014) ────────────────────────────

export interface DocumentsClient {
  /** Accusé de réception du Dossier REC (généré au premier téléchargement s'il n'existe pas). */
  accuseReception: boolean;
  devis: { id: number; libelle: string; etat: EtatDevisClient }[];
  factures: { id: number; numero: string; libelle: string; totalTtc: number; emiseLe: Date }[];
}

/** Liste des documents du Dossier destinés au client (page de suivi, après vérification). */
export async function documentsPourSuivi(ctx: Contexte, maintenant = new Date()): Promise<DocumentsClient> {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') return { accuseReception: false, devis: [], factures: [] };
  const db = getDb();
  const [devis, factures] = await Promise.all([
    db
      .select({ id: schema.devis.id, type: schema.devis.type, numero: schema.devis.numero, version: schema.devis.version, statut: schema.devis.statut, expireLe: schema.devis.expireLe })
      .from(schema.devis)
      .where(and(conditionsEnvoyes(ctx.dossierId), isNotNull(schema.devis.documentId)))
      .orderBy(desc(schema.devis.envoyeLe), desc(schema.devis.id)),
    db
      .select({ id: schema.facture.id, numero: schema.facture.numero, type: schema.facture.type, totalTtc: schema.facture.totalTtc, emiseLe: schema.facture.emiseLe })
      .from(schema.facture)
      .where(eq(schema.facture.dossierId, ctx.dossierId))
      .orderBy(desc(schema.facture.emiseLe), desc(schema.facture.id)),
  ]);
  return {
    accuseReception: true,
    devis: devis.flatMap((d) => {
      const etat = etatClient(d.statut, d.expireLe, maintenant);
      return etat ? [{ id: d.id, libelle: `${d.type === 'avenant' ? 'Avenant' : 'Devis'} ${d.numero} — version ${d.version}`, etat }] : [];
    }),
    factures: factures.map((f) => ({ id: f.id, numero: f.numero, libelle: `${TYPES_FACTURE[f.type as TypeFacture]} ${f.numero}`, totalTtc: f.totalTtc, emiseLe: f.emiseLe })),
  };
}

export interface FichierClient {
  nom: string;
  octets: Uint8Array;
}

async function lireDocument(documentId: number): Promise<Uint8Array> {
  const [doc] = await getDb()
    .select({ cle: schema.document.cle })
    .from(schema.document)
    .where(and(eq(schema.document.id, documentId), isNull(schema.document.supprimeLe)));
  if (!doc) throw new ErreurMetier('Document indisponible.');
  return getStockage().lire(doc.cle);
}

const journalTelechargement = (ctx: Contexte, action: string, objetType: string, objetId: number, ip: string | null, details: Record<string, unknown> = {}) =>
  journaliser({ acteurType: 'client', action, objetType, objetId, ip, details: { dossierId: ctx.dossierId, via: 'suivi', ...details } });

function exigerSuiviRec(ctx: Contexte) {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') throw new ErreurMetier('Document introuvable.');
}

/** PDF archivé d'un devis envoyé au client (RG-19), journalisé. */
export async function pdfDevisClient(ctx: Contexte, devisId: number, ip: string | null): Promise<FichierClient> {
  exigerSuiviRec(ctx);
  if (!Number.isInteger(devisId) || devisId <= 0) throw new ErreurMetier('Document introuvable.');
  const [d] = await getDb()
    .select({ numero: schema.devis.numero, version: schema.devis.version, type: schema.devis.type, documentId: schema.devis.documentId })
    .from(schema.devis)
    .where(and(eq(schema.devis.id, devisId), conditionsEnvoyes(ctx.dossierId)));
  if (!d?.documentId) throw new ErreurMetier('Document introuvable.');
  const octets = await lireDocument(d.documentId);
  await journalTelechargement(ctx, 'devis.pdf_telecharge', 'devis', devisId, ip, { documentId: d.documentId, version: d.version });
  return { nom: `${d.type === 'avenant' ? 'Avenant' : 'Devis'}-${d.numero}-v${d.version}.pdf`, octets };
}

/** PDF d'une facture ou d'un avoir du Dossier (archivé à la volée s'il ne l'est pas encore), journalisé. */
export async function pdfFactureClient(ctx: Contexte, factureId: number, ip: string | null): Promise<FichierClient> {
  exigerSuiviRec(ctx);
  if (!Number.isInteger(factureId) || factureId <= 0) throw new ErreurMetier('Document introuvable.');
  const [f] = await getDb()
    .select({ numero: schema.facture.numero, documentId: schema.facturePdf.documentId })
    .from(schema.facture)
    .leftJoin(schema.facturePdf, eq(schema.facturePdf.factureId, schema.facture.id))
    .where(and(eq(schema.facture.id, factureId), eq(schema.facture.dossierId, ctx.dossierId)));
  if (!f) throw new ErreurMetier('Document introuvable.');
  const documentId = f.documentId ?? (await archiverPdfFacture(factureId));
  const octets = await lireDocument(documentId);
  await journalTelechargement(ctx, 'facture.pdf_telecharge', 'facture', factureId, ip, { documentId, numero: f.numero });
  return { nom: `${f.numero}.pdf`, octets };
}

/**
 * Accusé de réception du Dossier REC (RG-16) : archivé dans les Documents du Dossier au premier
 * téléchargement (catégorie `accuse_reception`), puis resservi tel quel. Un verrou consultatif
 * par Dossier évite deux archivages lors de téléchargements simultanés.
 */
export async function accuseReceptionClient(ctx: Contexte, ip: string | null): Promise<FichierClient> {
  exigerSuiviRec(ctx);
  const { documentId, cree } = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('accuse_reception'), ${ctx.dossierId}::int)`);
    const [existant] = await tx
      .select({ id: schema.document.id })
      .from(schema.document)
      .where(and(eq(schema.document.dossierId, ctx.dossierId), eq(schema.document.categorie, 'accuse_reception'), isNull(schema.document.supprimeLe)))
      .orderBy(schema.document.id)
      .limit(1);
    if (existant) return { documentId: existant.id, cree: false };
    const octets = await genererAccuseReception(ctx.dossierId);
    const r = await archiverPdf(ctx.dossierId, `Accuse-reception-${ctx.numero}.pdf`, octets, 'accuse_reception', { type: 'systeme' }, tx);
    return { documentId: r.documentId, cree: true };
  });
  const octets = await lireDocument(documentId);
  await journalTelechargement(ctx, 'dossier.accuse_reception_telecharge', 'dossier', ctx.dossierId, ip, { documentId, archive: cree });
  return { nom: `Accuse-reception-${ctx.numero}.pdf`, octets };
}
