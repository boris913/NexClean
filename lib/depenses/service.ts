// Dépenses (specs/POST-03 RG-01..RG-07 ; ADR 0020 §1) : catégories, saisie, modification,
// annulation, justificatif (stockage interne, ADR 0003). Les droits sont vérifiés ici, en plus des
// pages ; chaque écriture et chaque lecture de justificatif est journalisée.
import { and, asc, desc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { peut } from '@/lib/authz/permissions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { DossierType, Role } from '@/lib/domain/referentiels';
import { dateDuJour } from '@/lib/encaissements/domaine';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { erreurDateDepense, motifAnnulationValide, schemaCategorie, schemaDepense, serviceRattache, type EntreeCategorie, type EntreeDepense, type MoyenDepense, type Periode } from './domaine';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface ActeurDepense {
  id: string;
  roles: readonly Role[];
  ip?: string | null;
}

/** Accès refusé à une dépense ou à son justificatif (403 dans les routes). */
export class ErreurAccesDepense extends Error {
  constructor() {
    super('Accès refusé.');
  }
}

const audit = (a: ActeurDepense) => ({ acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null });

function exigerSaisie(a: ActeurDepense) {
  if (!peut([...a.roles], 'depense.saisir')) throw new ErreurMetier('Réservé au Responsable finances et à la Direction.');
}
function exigerCategories(a: ActeurDepense) {
  if (!peut([...a.roles], 'depense.categories')) throw new ErreurMetier('Réservé à la Direction et à l’Administrateur.');
}

// ─── Catégories (RG-02) ───────────────────────────────────────

export async function listerCategories(filtre: { actives?: boolean } = {}) {
  const db = getDb();
  const utilisations = db
    .select({ categorieId: schema.depense.categorieId, n: sql<number>`count(*)::int`.as('n') })
    .from(schema.depense)
    .groupBy(schema.depense.categorieId)
    .as('utilisations');
  const lignes = await db
    .select({ id: schema.categorieDepense.id, libelle: schema.categorieDepense.libelle, actif: schema.categorieDepense.actif, ordre: schema.categorieDepense.ordre, depenses: sql<number>`coalesce(${utilisations.n}, 0)::int` })
    .from(schema.categorieDepense)
    .leftJoin(utilisations, eq(utilisations.categorieId, schema.categorieDepense.id))
    .where(filtre.actives ? eq(schema.categorieDepense.actif, true) : undefined)
    .orderBy(asc(schema.categorieDepense.ordre), asc(schema.categorieDepense.libelle));
  return lignes.map((l) => ({ ...l, depenses: Number(l.depenses) }));
}

async function libelleLibre(tx: Tx, libelle: string, sauf: number | null) {
  const [x] = await tx
    .select({ id: schema.categorieDepense.id })
    .from(schema.categorieDepense)
    .where(and(sql`lower(${schema.categorieDepense.libelle}) = lower(${libelle})`, sauf === null ? undefined : sql`${schema.categorieDepense.id} <> ${sauf}`));
  if (x) throw new ErreurMetier('Une catégorie porte déjà ce libellé.');
}

export async function creerCategorie(entree: EntreeCategorie, a: ActeurDepense): Promise<number> {
  exigerCategories(a);
  const d = schemaCategorie.parse(entree);
  return getDb().transaction(async (tx) => {
    await libelleLibre(tx, d.libelle, null);
    const [r] = await tx.insert(schema.categorieDepense).values(d).returning({ id: schema.categorieDepense.id });
    await journaliser({ ...audit(a), action: 'categorie_depense.creee', objetType: 'categorie_depense', objetId: r!.id, apres: d }, tx);
    return r!.id;
  });
}

/** Renommer une catégorie : les dépenses déjà saisies suivent le nouveau libellé. */
export async function modifierCategorie(id: number, entree: EntreeCategorie, a: ActeurDepense): Promise<void> {
  exigerCategories(a);
  const d = schemaCategorie.parse(entree);
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(schema.categorieDepense).where(eq(schema.categorieDepense.id, id)).for('update');
    if (!avant) throw new ErreurMetier('Catégorie introuvable.');
    await libelleLibre(tx, d.libelle, id);
    await tx.update(schema.categorieDepense).set(d).where(eq(schema.categorieDepense.id, id));
    await journaliser({ ...audit(a), action: 'categorie_depense.modifiee', objetType: 'categorie_depense', objetId: id, avant: { libelle: avant.libelle, ordre: avant.ordre }, apres: d }, tx);
  });
}

/** RG-02 : une catégorie désactivée n'est plus proposée à la saisie ; les dépenses existantes la gardent. */
export async function changerActivationCategorie(id: number, actif: boolean, a: ActeurDepense): Promise<void> {
  exigerCategories(a);
  await getDb().transaction(async (tx) => {
    const [c] = await tx.select().from(schema.categorieDepense).where(eq(schema.categorieDepense.id, id)).for('update');
    if (!c) throw new ErreurMetier('Catégorie introuvable.');
    if (c.actif === actif) return;
    if (!actif) {
      const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.categorieDepense).where(eq(schema.categorieDepense.actif, true));
      if (Number(n!.n) <= 1) throw new ErreurMetier('Gardez au moins une catégorie active.');
    }
    await tx.update(schema.categorieDepense).set({ actif }).where(eq(schema.categorieDepense.id, id));
    await journaliser({ ...audit(a), action: actif ? 'categorie_depense.activee' : 'categorie_depense.desactivee', objetType: 'categorie_depense', objetId: id }, tx);
  });
}

/** RG-02 : suppression d'une catégorie jamais utilisée ; sinon il faut la désactiver. */
export async function supprimerCategorie(id: number, a: ActeurDepense): Promise<void> {
  exigerCategories(a);
  await getDb().transaction(async (tx) => {
    const [c] = await tx.select().from(schema.categorieDepense).where(eq(schema.categorieDepense.id, id)).for('update');
    if (!c) throw new ErreurMetier('Catégorie introuvable.');
    const [u] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.depense).where(eq(schema.depense.categorieId, id));
    if (Number(u!.n) > 0) throw new ErreurMetier('Des dépenses utilisent cette catégorie : désactivez-la plutôt que de la supprimer.');
    await tx.delete(schema.categorieDepense).where(eq(schema.categorieDepense.id, id));
    await journaliser({ ...audit(a), action: 'categorie_depense.supprimee', objetType: 'categorie_depense', objetId: id, avant: { libelle: c.libelle } }, tx);
  });
}

// ─── Lecture des dépenses (RG-05) ─────────────────────────────

export interface FiltresDepenses extends Partial<Periode> {
  categorieId?: number | null;
  /** Inclure les dépenses annulées (barrées dans la liste). */
  annulees?: boolean;
}

const colonnesListe = {
  id: schema.depense.id,
  depenseLe: schema.depense.depenseLe,
  libelle: schema.depense.libelle,
  montant: schema.depense.montant,
  moyen: schema.depense.moyen,
  reference: schema.depense.reference,
  categorieId: schema.depense.categorieId,
  categorie: schema.categorieDepense.libelle,
  villeId: schema.depense.villeId,
  ville: schema.ville.nom,
  dossierId: schema.depense.dossierId,
  numeroDossier: schema.dossier.numero,
  service: schema.depense.service,
  commentaire: schema.depense.commentaire,
  aJustificatif: sql<boolean>`${schema.depense.justificatifCle} is not null`,
  justificatifNom: schema.depense.justificatifNom,
  auteurNom: schema.user.name,
  creeLe: schema.depense.creeLe,
  majLe: schema.depense.majLe,
  annuleeLe: schema.depense.annuleeLe,
  motifAnnulation: schema.depense.motifAnnulation,
};

function requeteListe(db: Pick<Db, 'select'>) {
  return db
    .select(colonnesListe)
    .from(schema.depense)
    .innerJoin(schema.categorieDepense, eq(schema.categorieDepense.id, schema.depense.categorieId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.depense.villeId))
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.depense.dossierId))
    .leftJoin(schema.user, eq(schema.user.id, schema.depense.auteurId));
}

export type LigneDepense = Awaited<ReturnType<typeof listerDepenses>>['lignes'][number];

/** Liste filtrée (période sur la date de dépense, catégorie), la plus récente d'abord, avec le total non annulé. */
export async function listerDepenses(f: FiltresDepenses, a: ActeurDepense, limite = 200) {
  exigerSaisie(a);
  const conditions: SQL[] = [];
  if (f.du) conditions.push(gte(schema.depense.depenseLe, f.du));
  if (f.au) conditions.push(lte(schema.depense.depenseLe, f.au));
  if (f.categorieId) conditions.push(eq(schema.depense.categorieId, f.categorieId));
  const filtre = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [lignes, [totaux]] = await Promise.all([
    requeteListe(db)
      .where(f.annulees ? filtre : and(filtre, isNull(schema.depense.annuleeLe)))
      .orderBy(desc(schema.depense.depenseLe), desc(schema.depense.id))
      .limit(limite),
    db
      .select({ total: sql<string>`coalesce(sum(${schema.depense.montant}), 0)::bigint`, nombre: sql<number>`count(*)::int` })
      .from(schema.depense)
      .where(and(filtre, isNull(schema.depense.annuleeLe))),
  ]);
  return { lignes: lignes.map((l) => ({ ...l, aJustificatif: !!l.aJustificatif })), total: Number(totaux!.total), nombre: Number(totaux!.nombre), tronquee: lignes.length >= limite };
}

export async function lireDepense(id: number, a: ActeurDepense) {
  exigerSaisie(a);
  const [d] = await requeteListe(getDb()).where(eq(schema.depense.id, id));
  return d ? { ...d, aJustificatif: !!d.aJustificatif } : null;
}

/** Villes actives proposées à la saisie. */
export async function villesActives() {
  return getDb().select({ id: schema.ville.id, nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.actif, true)).orderBy(asc(schema.ville.ordre), asc(schema.ville.nom));
}

// ─── Écriture (RG-01, RG-03, RG-04, RG-06) ────────────────────

export interface FichierJustificatif {
  nom: string;
  octets: Uint8Array;
}

/** Contrôle le fichier (type réel, 5 Mo) et le dépose ; retourne les colonnes à enregistrer. */
async function deposerJustificatif(f: FichierJustificatif, maintenant: Date) {
  const v = validerFichier(f.nom, f.octets);
  if (!v.ok) throw new ErreurMetier(`Justificatif : ${v.erreur}`);
  if (v.type === 'docx') throw new ErreurMetier('Justificatif : photo (JPEG, PNG, WebP) ou PDF uniquement.');
  const cle = nouvelleCle('depenses', v.type === 'jpeg' ? 'jpg' : v.type, maintenant);
  await getStockage().deposer(cle, f.octets);
  return { justificatifCle: cle, justificatifNom: f.nom.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150), justificatifMime: v.mime, justificatifTaille: f.octets.byteLength };
}

/** Résout catégorie, Dossier et ville ; contrôle la date. */
async function resoudre(tx: Tx, entree: EntreeDepense, maintenant: Date, categorieActuelle: number | null) {
  const d = schemaDepense.parse(entree);
  const erreurDate = erreurDateDepense(d.depenseLe, dateDuJour(maintenant));
  if (erreurDate) throw new ErreurMetier(erreurDate);
  const [cat] = await tx.select().from(schema.categorieDepense).where(eq(schema.categorieDepense.id, d.categorieId));
  if (!cat) throw new ErreurMetier('Catégorie inconnue.');
  // RG-02 : une catégorie désactivée reste acceptée sur une dépense qui l'avait déjà.
  if (!cat.actif && cat.id !== categorieActuelle) throw new ErreurMetier(`La catégorie « ${cat.libelle} » est désactivée.`);
  let dossierId: number | null = null;
  let typeDossier: DossierType | null = null;
  if (d.dossierNumero) {
    const [dos] = await tx.select({ id: schema.dossier.id, type: schema.dossier.type }).from(schema.dossier).where(eq(schema.dossier.numero, d.dossierNumero));
    if (!dos) throw new ErreurMetier(`Dossier ${d.dossierNumero} introuvable.`);
    dossierId = dos.id;
    typeDossier = dos.type;
  }
  if (d.villeId !== null) {
    const [v] = await tx.select({ id: schema.ville.id }).from(schema.ville).where(eq(schema.ville.id, d.villeId));
    if (!v) throw new ErreurMetier('Ville inconnue.');
  }
  return {
    depenseLe: d.depenseLe,
    categorieId: d.categorieId,
    libelle: d.libelle,
    montant: d.montant,
    moyen: d.moyen as MoyenDepense,
    reference: d.reference,
    villeId: d.villeId,
    dossierId,
    service: serviceRattache(typeDossier, d.service),
    commentaire: d.commentaire,
  };
}

export async function creerDepense(entree: EntreeDepense, fichier: FichierJustificatif | null, a: ActeurDepense, maintenant = new Date()): Promise<number> {
  exigerSaisie(a);
  // Contrôle des données avant tout dépôt de fichier.
  schemaDepense.parse(entree);
  const justificatif = fichier ? await deposerJustificatif(fichier, maintenant) : null;
  try {
    return await getDb().transaction(async (tx) => {
      const valeurs = await resoudre(tx, entree, maintenant, null);
      const [r] = await tx
        .insert(schema.depense)
        .values({ ...valeurs, ...(justificatif ?? {}), auteurId: a.id, majParId: a.id, creeLe: maintenant, majLe: maintenant })
        .returning({ id: schema.depense.id });
      await journaliser({ ...audit(a), action: 'depense.creee', objetType: 'depense', objetId: r!.id, apres: { ...valeurs, justificatif: !!justificatif } }, tx);
      return r!.id;
    });
  } catch (e) {
    if (justificatif) await getStockage().supprimer(justificatif.justificatifCle); // pas de fichier orphelin
    throw e;
  }
}

/**
 * RG-03 : modification d'une dépense non annulée, journalisée avec les valeurs avant / après.
 * `justificatif` : nouveau fichier (remplace l'ancien), `'retirer'`, ou null (inchangé).
 */
export async function modifierDepense(id: number, entree: EntreeDepense, justificatif: FichierJustificatif | 'retirer' | null, a: ActeurDepense, maintenant = new Date()): Promise<void> {
  exigerSaisie(a);
  schemaDepense.parse(entree);
  const nouveau = justificatif && justificatif !== 'retirer' ? await deposerJustificatif(justificatif, maintenant) : null;
  let ancienneCle: string | null = null;
  try {
    await getDb().transaction(async (tx) => {
      const [avant] = await tx.select().from(schema.depense).where(eq(schema.depense.id, id)).for('update');
      if (!avant) throw new ErreurMetier('Dépense introuvable.');
      if (avant.annuleeLe) throw new ErreurMetier('Cette dépense est annulée : elle ne peut plus être modifiée.');
      const valeurs = await resoudre(tx, entree, maintenant, avant.categorieId);
      const fichierChange = justificatif !== null && (justificatif === 'retirer' ? avant.justificatifCle !== null : true);
      const colonnesFichier = !fichierChange ? {} : nouveau ?? { justificatifCle: null, justificatifNom: null, justificatifMime: null, justificatifTaille: null };
      if (fichierChange) ancienneCle = avant.justificatifCle;
      const champs = (Object.keys(valeurs) as (keyof typeof valeurs)[]).filter((k) => valeurs[k] !== avant[k]);
      if (!champs.length && !fichierChange) return;
      await tx
        .update(schema.depense)
        .set({ ...valeurs, ...colonnesFichier, majLe: maintenant, majParId: a.id })
        .where(eq(schema.depense.id, id));
      await journaliser(
        {
          ...audit(a),
          action: 'depense.modifiee',
          objetType: 'depense',
          objetId: id,
          avant: Object.fromEntries(champs.map((k) => [k, avant[k]])),
          apres: Object.fromEntries(champs.map((k) => [k, valeurs[k]])),
          details: fichierChange ? { justificatif: nouveau ? 'remplace' : 'retire' } : undefined,
        },
        tx,
      );
    });
  } catch (e) {
    if (nouveau) await getStockage().supprimer(nouveau.justificatifCle);
    throw e;
  }
  // Ancien fichier retiré ou remplacé : supprimé après la validation de la transaction.
  if (ancienneCle) await getStockage().supprimer(ancienneCle);
}

/** RG-06 : annulation motivée (jamais de suppression) ; la dépense sort des indicateurs et de l'export. */
export async function annulerDepense(id: number, motif: string, a: ActeurDepense, maintenant = new Date()): Promise<void> {
  exigerSaisie(a);
  const m = motifAnnulationValide(motif);
  if (!m) throw new ErreurMetier('Indiquez le motif de l’annulation.');
  await getDb().transaction(async (tx) => {
    const [d] = await tx.select().from(schema.depense).where(eq(schema.depense.id, id)).for('update');
    if (!d) throw new ErreurMetier('Dépense introuvable.');
    if (d.annuleeLe) throw new ErreurMetier('Cette dépense est déjà annulée.');
    await tx.update(schema.depense).set({ annuleeLe: maintenant, annuleeParId: a.id, motifAnnulation: m }).where(eq(schema.depense.id, id));
    await journaliser({ ...audit(a), action: 'depense.annulee', objetType: 'depense', objetId: id, avant: { montant: d.montant, depenseLe: d.depenseLe, libelle: d.libelle }, details: { motif: m } }, tx);
  });
}

/** RG-07 : lecture du justificatif après contrôle des droits ; lectures et refus journalisés. */
export async function lireJustificatif(id: number, a: ActeurDepense): Promise<{ nom: string; mime: string; octets: Uint8Array } | null> {
  if (!peut([...a.roles], 'depense.saisir')) {
    await journaliser({ ...audit(a), action: 'acces.refuse', objetType: 'depense', objetId: id, details: { justificatif: true } });
    throw new ErreurAccesDepense();
  }
  const [d] = await getDb()
    .select({ cle: schema.depense.justificatifCle, nom: schema.depense.justificatifNom, mime: schema.depense.justificatifMime })
    .from(schema.depense)
    .where(eq(schema.depense.id, id));
  if (!d?.cle) return null;
  const octets = await getStockage().lire(d.cle);
  await journaliser({ ...audit(a), action: 'depense.justificatif_telecharge', objetType: 'depense', objetId: id });
  return { nom: d.nom ?? 'justificatif', mime: d.mime ?? 'application/octet-stream', octets };
}
