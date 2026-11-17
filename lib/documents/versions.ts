// Versions des modèles de documents PDF (specs/POST-05 RG-08..12). Le contrôle des droits
// (modeles.gerer) est fait par l'appelant.
import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier, type Auteur } from '@/lib/collaborateurs/service';
import { erreursModele, memeContenu, modeleOrigine, nettoyerModele, normaliserModele, TYPES_DOCUMENT_CODES, type ContenuModele, type TypeDocument } from './personnalisation';

export const schemaContenuModele = z.object({
  blocs: z.record(z.string(), z.string().max(5000)),
  ordre: z.array(z.string().max(40)).max(20),
});

export const schemaEnregistrement = z.object({
  type: z.enum(TYPES_DOCUMENT_CODES),
  /** Version affichée à l'ouverture de l'éditeur (contrôle des enregistrements concurrents). */
  versionBase: z.number().int().min(0),
  contenu: schemaContenuModele,
  commentaire: z.string().trim().max(200, '200 caractères maximum').optional().transform((v) => v || null),
});

/** Contenu saisi validé et nettoyé ; ErreurMetier avec toutes les erreurs sinon (RG-03, RG-05, RG-07). */
export function contenuValide(type: TypeDocument, contenu: ContenuModele): ContenuModele {
  const propre = nettoyerModele(type, contenu);
  const erreurs = erreursModele(type, { blocs: { ...contenu.blocs, ...propre.blocs }, ordre: propre.ordre });
  if (erreurs.length) throw new ErreurMetier(erreurs.join(' · '));
  return propre;
}

export interface VersionModele {
  version: number;
  contenu: ContenuModele;
  commentaire: string | null;
  restaureDe: number | null;
  creeLe: Date | null;
  auteur: string | null;
}

const ORIGINE = (type: TypeDocument): VersionModele => ({ version: 0, contenu: modeleOrigine(type), commentaire: 'Modèle d’origine', restaureDe: null, creeLe: null, auteur: null });

/** Historique d'un type, de la plus récente à la version 0 (modèle d'origine). */
export async function listerVersions(type: TypeDocument): Promise<VersionModele[]> {
  const lignes = await getDb()
    .select({ v: schema.modeleDocumentVersion, auteur: schema.user.name })
    .from(schema.modeleDocumentVersion)
    .leftJoin(schema.user, eq(schema.user.id, schema.modeleDocumentVersion.creePar))
    .where(eq(schema.modeleDocumentVersion.type, type))
    .orderBy(desc(schema.modeleDocumentVersion.version));
  return [
    ...lignes.map(({ v, auteur }) => ({ version: v.version, contenu: normaliserModele(type, v.contenu), commentaire: v.commentaire, restaureDe: v.restaureDe, creeLe: v.creeLe, auteur })),
    ORIGINE(type),
  ];
}

/** Version courante de chaque type (0 si aucune), pour la liste des modèles. */
export async function versionsCourantes(): Promise<Record<TypeDocument, { version: number; creeLe: Date | null }>> {
  const lignes = await getDb()
    .select({ type: schema.modeleDocumentVersion.type, version: sql<number>`max(${schema.modeleDocumentVersion.version})::int`, creeLe: sql<Date>`max(${schema.modeleDocumentVersion.creeLe})` })
    .from(schema.modeleDocumentVersion)
    .groupBy(schema.modeleDocumentVersion.type);
  const r = Object.fromEntries(TYPES_DOCUMENT_CODES.map((t) => [t, { version: 0, creeLe: null }])) as Record<TypeDocument, { version: number; creeLe: Date | null }>;
  for (const l of lignes) r[l.type] = { version: l.version, creeLe: l.creeLe ? new Date(l.creeLe) : null };
  return r;
}

/**
 * RG-11 : modèle applicable à un document dont la date de référence est `date` (émission d'une
 * facture, enregistrement d'un Encaissement…) : dernière version créée au plus tard à cette date,
 * sinon le modèle d'origine. Les versions étant immuables, le résultat ne change jamais pour une date passée.
 */
export async function modeleEnVigueur(type: TypeDocument, date: Date): Promise<ContenuModele> {
  const [v] = await getDb()
    .select({ contenu: schema.modeleDocumentVersion.contenu })
    .from(schema.modeleDocumentVersion)
    .where(and(eq(schema.modeleDocumentVersion.type, type), lte(schema.modeleDocumentVersion.creeLe, date)))
    .orderBy(desc(schema.modeleDocumentVersion.creeLe), desc(schema.modeleDocumentVersion.version))
    .limit(1);
  return normaliserModele(type, v?.contenu);
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** Dernière version d'un type, sous verrou consultatif (numérotation sans doublon). */
async function derniereSousVerrou(tx: Tx, type: TypeDocument): Promise<{ version: number; contenu: ContenuModele }> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('modele_document'), hashtext(${type}))`);
  const [v] = await tx
    .select({ version: schema.modeleDocumentVersion.version, contenu: schema.modeleDocumentVersion.contenu })
    .from(schema.modeleDocumentVersion)
    .where(eq(schema.modeleDocumentVersion.type, type))
    .orderBy(desc(schema.modeleDocumentVersion.version))
    .limit(1);
  return v ? { version: v.version, contenu: normaliserModele(type, v.contenu) } : { version: 0, contenu: modeleOrigine(type) };
}

/** RG-09 : enregistre une nouvelle version (journalisée). Renvoie son numéro. */
export async function enregistrerModeleDocument(entree: z.input<typeof schemaEnregistrement>, auteur: Auteur, maintenant = new Date()): Promise<number> {
  const e = schemaEnregistrement.parse(entree);
  const contenu = contenuValide(e.type, e.contenu);
  return getDb().transaction(async (tx) => {
    const courante = await derniereSousVerrou(tx, e.type);
    if (courante.version !== e.versionBase) throw new ErreurMetier('Le modèle a été modifié entre-temps : rechargez la page.');
    if (memeContenu(courante.contenu, contenu)) throw new ErreurMetier('Aucune modification par rapport à la version en vigueur.');
    const version = courante.version + 1;
    await tx.insert(schema.modeleDocumentVersion).values({ type: e.type, version, contenu, commentaire: e.commentaire, creePar: auteur.id, creeLe: maintenant });
    await journaliser(
      { acteurType: 'collaborateur', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'modele_document.version_creee', objetType: 'modele_document', objetId: e.type, avant: courante.contenu, apres: contenu, details: { version, versionPrecedente: courante.version, commentaire: e.commentaire } },
      tx,
    );
    return version;
  });
}

/** RG-10 : revenir à une version (0 = modèle d'origine) crée une nouvelle version qui la recopie. */
export async function restaurerVersion(type: TypeDocument, version: number, auteur: Auteur, maintenant = new Date()): Promise<number> {
  if (!TYPES_DOCUMENT_CODES.includes(type)) throw new ErreurMetier('Type de document inconnu.');
  if (!Number.isInteger(version) || version < 0) throw new ErreurMetier('Version introuvable.');
  return getDb().transaction(async (tx) => {
    const courante = await derniereSousVerrou(tx, type);
    let source: ContenuModele;
    if (version === 0) source = modeleOrigine(type);
    else {
      const [v] = await tx.select({ contenu: schema.modeleDocumentVersion.contenu }).from(schema.modeleDocumentVersion).where(and(eq(schema.modeleDocumentVersion.type, type), eq(schema.modeleDocumentVersion.version, version)));
      if (!v) throw new ErreurMetier('Version introuvable.');
      source = normaliserModele(type, v.contenu);
    }
    if (memeContenu(courante.contenu, source)) throw new ErreurMetier('Cette version est déjà celle en vigueur.');
    const nouvelle = courante.version + 1;
    await tx.insert(schema.modeleDocumentVersion).values({ type, version: nouvelle, contenu: source, commentaire: version === 0 ? 'Retour au modèle d’origine' : `Reprise de la version ${version}`, restaureDe: version, creePar: auteur.id, creeLe: maintenant });
    await journaliser(
      { acteurType: 'collaborateur', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'modele_document.version_restauree', objetType: 'modele_document', objetId: type, avant: courante.contenu, apres: source, details: { version: nouvelle, restaureDe: version } },
      tx,
    );
    return nouvelle;
  });
}
