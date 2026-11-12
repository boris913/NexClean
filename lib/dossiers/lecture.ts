// Lectures pour la liste et la fiche Dossier (specs/MVP1-02 RG-21..23).
import { aliasedTable, and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { peut } from '@/lib/authz/permissions';
import type { DossierType } from '@/lib/domain/referentiels';
import { peutVoir, peutVoirSalaire, type Demandeur } from './acces';
import { STATUT_CODES, phaseDe, type Phase, type Statut } from './statuts';

export const TAILLE_PAGE_DOSSIERS = 20;

// Recherche insensible aux accents (« hotel » trouve « Hôtel ») sans extension PostgreSQL :
// translate() ramène les lettres accentuées usuelles du français à leur lettre de base.
const AVEC_ACCENTS = 'ÀÂÄÁÃÇÉÈÊËÍÎÏÌÑÓÔÖÒÕÚÛÜÙŸàâäáãçéèêëíîïìñóôöòõúûüùÿ';
const SANS_ACCENTS = 'AAAAACEEEEIIIINOOOOOUUUUYaaaaaceeeeiiiinooooouuuuy';
const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const contientSansAccents = (col: SQL | typeof schema.client.nom, motif: string) => sql`translate(${col}, ${AVEC_ACCENTS}, ${SANS_ACCENTS}) ilike ${motif}`;
/** Seuil de l'indicateur « sans action depuis N jours » (RG-23, paramètre). */
export const JOURS_SANS_ACTION = 3;

export interface FiltresDossiers {
  q?: string;
  type?: DossierType;
  statut?: Statut;
  phase?: Phase;
  villeId?: number;
  referentId?: string | 'aucun';
  du?: string;
  au?: string;
  tri?: 'creation' | 'action';
  page?: number;
}

export async function listerDossiers(c: Demandeur, f: FiltresDossiers) {
  const d = schema.dossier;
  const conditions: (SQL | undefined)[] = [];
  // Périmètre : un Référent ne voit que ses dossiers (M1-ROL-04).
  if (!peut(c.roles, 'dossier.voir_tous')) conditions.push(eq(d.referentId, c.id));
  if (f.q?.trim()) {
    const q = f.q.trim();
    const chiffres = q.replace(/\D/g, '');
    const motif = `%${sansAccents(q).replace(/[%_\\]/g, '\\$&')}%`;
    conditions.push(or(ilike(d.numero, motif), contientSansAccents(schema.client.nom, motif), contientSansAccents(sql`coalesce(${schema.client.contact}, '')`, motif), chiffres.length >= 4 ? ilike(schema.client.whatsapp, `%${chiffres}%`) : undefined));
  }
  if (f.type) conditions.push(eq(d.type, f.type));
  if (f.statut) conditions.push(eq(d.statut, f.statut));
  if (f.phase) conditions.push(inArray(d.statut, STATUT_CODES.filter((s) => phaseDe(s) === f.phase)));
  if (f.villeId) conditions.push(eq(d.villeId, f.villeId));
  if (f.referentId && peut(c.roles, 'dossier.voir_tous')) conditions.push(f.referentId === 'aucun' ? isNull(d.referentId) : eq(d.referentId, f.referentId));
  if (f.du) conditions.push(gte(d.creeLe, new Date(`${f.du}T00:00:00+01:00`)));
  if (f.au) conditions.push(lt(d.creeLe, new Date(new Date(`${f.au}T00:00:00+01:00`).getTime() + 86_400_000)));

  const page = Math.max(1, f.page ?? 1);
  const referent = aliasedTable(schema.user, 'referent');
  const lignes = await getDb()
    .select({
      id: d.id,
      numero: d.numero,
      type: d.type,
      statut: d.statut,
      creeLe: d.creeLe,
      derniereActionLe: d.derniereActionLe,
      clientNom: schema.client.nom,
      clientWhatsapp: schema.client.whatsapp,
      ville: schema.ville.nom,
      villeAutre: d.villeAutre,
      referentId: d.referentId,
      referentNom: referent.name,
      personnes: sql<number>`(select coalesce(sum(${schema.lignePoste.nombre}), 0) from ${schema.lignePoste} where ${schema.lignePoste.dossierId} = ${d.id})`.mapWith(Number),
      // COM3-01 RG-07 : dernière classification IA (indicative, jamais utilisée pour l'attribution).
      temperature: sql<'chaud' | 'tiede' | 'froid' | null>`(select s.contenu->>'temperature' from ${schema.suggestionIa} s where s.dossier_id = ${d.id} and s.tache = 'classification' order by s.cree_le desc limit 1)`,
    })
    .from(d)
    .innerJoin(schema.client, eq(schema.client.id, d.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, d.villeId))
    .leftJoin(referent, eq(referent.id, d.referentId))
    .where(and(...conditions.filter(Boolean)))
    .orderBy(f.tri === 'action' ? desc(d.derniereActionLe) : desc(d.creeLe), desc(d.id))
    .limit(TAILLE_PAGE_DOSSIERS + 1)
    .offset((page - 1) * TAILLE_PAGE_DOSSIERS);
  return { lignes: lignes.slice(0, TAILLE_PAGE_DOSSIERS), suivante: lignes.length > TAILLE_PAGE_DOSSIERS, page };
}

export const sansActionDepuis = (derniereAction: Date, maintenant = new Date()) => Math.floor((maintenant.getTime() - derniereAction.getTime()) / 86_400_000);

/** Fiche complète ; null si le dossier n'existe pas, 'interdit' si hors périmètre. */
export async function lireDossier(id: number, c: Demandeur) {
  const db = getDb();
  const referent = aliasedTable(schema.user, 'referent');
  const quartierT = schema.quartier;
  const [d] = await db
    .select({
      dossier: schema.dossier,
      client: schema.client,
      ville: schema.ville.nom,
      quartier: quartierT.nom,
      referentNom: referent.name,
    })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .leftJoin(quartierT, eq(quartierT.id, schema.dossier.quartierId))
    .leftJoin(referent, eq(referent.id, schema.dossier.referentId))
    .where(eq(schema.dossier.id, id));
  if (!d) return null;
  if (!peutVoir(c, d.dossier.referentId)) return 'interdit' as const;

  const auteur = aliasedTable(schema.user, 'auteur');
  const [demandes, lignes, documents, evenements] = await Promise.all([
    db.select().from(schema.demande).where(eq(schema.demande.dossierId, id)).orderBy(asc(schema.demande.creeLe)),
    db.select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, id)).orderBy(asc(schema.lignePoste.ordre)),
    db
      .select({ id: schema.document.id, nom: schema.document.nomOrigine, categorie: schema.document.categorie, taille: schema.document.taille, creeLe: schema.document.creeLe, auteurId: schema.document.auteurId, auteurNom: auteur.name })
      .from(schema.document)
      .leftJoin(auteur, eq(auteur.id, schema.document.auteurId))
      .where(and(eq(schema.document.dossierId, id), isNull(schema.document.supprimeLe)))
      .orderBy(desc(schema.document.creeLe)),
    db
      .select({ ev: schema.evenementDossier, auteurNom: auteur.name })
      .from(schema.evenementDossier)
      .leftJoin(auteur, eq(auteur.id, schema.evenementDossier.auteurId))
      .where(eq(schema.evenementDossier.dossierId, id))
      .orderBy(desc(schema.evenementDossier.horodatage), desc(schema.evenementDossier.id)),
  ]);
  const voirSalaire = peutVoirSalaire(c, d.dossier.referentId);
  // Le salaire / budget n'est transmis à l'interface qu'aux personnes autorisées (ADR 0018) :
  // lignes de poste, mais aussi données brutes des demandes et avant / après de l'historique.
  const m = <T,>(v: T): T => (voirSalaire ? v : (masquerSalaire(v) as T));
  return {
    ...d,
    demandes: demandes.map((dem) => ({ ...dem, donnees: m(dem.donnees) })),
    lignes: lignes.map((l) => (voirSalaire ? l : { ...l, salaire: null })),
    voirSalaire,
    documents,
    evenements: evenements.map((e) => ({ ...e, ev: { ...e.ev, avant: m(e.ev.avant), apres: m(e.ev.apres) } })),
  };
}

/** Retire récursivement toute clé « salaire » (données brutes, historique). */
export function masquerSalaire(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(masquerSalaire);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => k !== 'salaire').map(([k, x]) => [k, masquerSalaire(x)]));
  }
  return v;
}

/** Dossiers ouverts du même client, cibles possibles d'un rattachement (RG-08). */
export async function dossiersDuClient(clientId: number, saufId: number, c: Demandeur) {
  const lignes = await getDb()
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, statut: schema.dossier.statut, referentId: schema.dossier.referentId })
    .from(schema.dossier)
    .where(and(eq(schema.dossier.clientId, clientId), sql`${schema.dossier.id} <> ${saufId}`))
    .orderBy(desc(schema.dossier.creeLe));
  return lignes.filter((l) => peutVoir(c, l.referentId));
}
