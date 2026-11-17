// Offres publiées (ADR 0013) : administration depuis le Back-Office (création, modification,
// publication, fermeture), brouillon pré-rempli depuis une Ligne de poste, fermeture automatique
// quand la Ligne de poste est pourvue ou le Dossier fermé. Toute écriture est journalisée.
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutAccederVivier, type DemandeurVivier } from '@/lib/candidats/acces';
import { dateDuJour as dateDouala } from '@/lib/encaissements/domaine';
import { brouillonDepuisLigne, lignePourvue, manquesPourPublier, schemaOffre, transitionOffrePermise, type EntreeOffre, type StatutOffre } from './domaine';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface ActeurOffre extends DemandeurVivier {
  ip?: string | null;
}

async function exigerGestion(a: ActeurOffre) {
  if (!(await peutAccederVivier(a, 'offre.gerer'))) throw new ErreurMetier('Réservé à la Direction et aux référents du service Recrutement.');
}

const audit = (a: ActeurOffre) => ({ acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null });

// ─── Lecture (Back-Office) ────────────────────────────────────

export async function listerOffres(filtre: { statut?: StatutOffre } = {}) {
  const db = getDb();
  const offres = await db
    .select()
    .from(schema.offre)
    .where(filtre.statut ? eq(schema.offre.statut, filtre.statut) : undefined)
    .orderBy(sql`case ${schema.offre.statut} when 'brouillon' then 0 when 'publiee' then 1 else 2 end`, asc(schema.offre.ordre), desc(schema.offre.creeLe));
  if (!offres.length) return [];
  const candidatures = await db
    .select({ slug: schema.candidature.offreSlug, n: count() })
    .from(schema.candidature)
    .where(inArray(schema.candidature.offreSlug, offres.map((o) => o.slug)))
    .groupBy(schema.candidature.offreSlug);
  return offres.map((o) => ({ ...o, candidatures: candidatures.find((c) => c.slug === o.slug)?.n ?? 0 }));
}

export async function lireOffre(id: number) {
  const [o] = await getDb().select().from(schema.offre).where(eq(schema.offre.id, id));
  return o ?? null;
}

/** Ligne de poste liée, pour l'affichage (dossier, intitulé) — jamais publiée. */
export async function lireLigneLiee(lignePosteId: number) {
  const [l] = await getDb()
    .select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre, dossierId: schema.dossier.id, numero: schema.dossier.numero })
    .from(schema.lignePoste)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.lignePoste.dossierId))
    .where(eq(schema.lignePoste.id, lignePosteId));
  return l ?? null;
}

/** Offres rattachées aux lignes de poste d'un Dossier (onglet Postes). */
export async function offresDesLignes(ids: number[]) {
  if (!ids.length) return [];
  return getDb()
    .select({ id: schema.offre.id, lignePosteId: schema.offre.lignePosteId, titre: schema.offre.titre, statut: schema.offre.statut })
    .from(schema.offre)
    .where(inArray(schema.offre.lignePosteId, ids))
    .orderBy(desc(schema.offre.creeLe));
}

// ─── Écriture ─────────────────────────────────────────────────

async function verifierLigne(tx: Tx, lignePosteId: number | null) {
  if (lignePosteId === null) return;
  const [l] = await tx
    .select({ type: schema.dossier.type })
    .from(schema.lignePoste)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.lignePoste.dossierId))
    .where(eq(schema.lignePoste.id, lignePosteId));
  if (!l) throw new ErreurMetier('Ligne de poste introuvable.');
  if (l.type !== 'REC') throw new ErreurMetier('Seule une ligne de poste d’un dossier de recrutement peut porter une offre.');
}

async function slugLibre(tx: Tx | Db, slug: string, sauf: number | null) {
  const [x] = await tx
    .select({ id: schema.offre.id })
    .from(schema.offre)
    .where(sauf === null ? eq(schema.offre.slug, slug) : and(eq(schema.offre.slug, slug), ne(schema.offre.id, sauf)));
  if (x) throw new ErreurMetier('Cette adresse est déjà utilisée par une autre offre.');
}

/** Crée un brouillon (jamais publié automatiquement, ADR 0013 §3). */
export async function creerOffre(entree: EntreeOffre, a: ActeurOffre): Promise<number> {
  await exigerGestion(a);
  const d = schemaOffre.parse(entree);
  return getDb().transaction(async (tx) => {
    await slugLibre(tx, d.slug, null);
    await verifierLigne(tx, d.lignePosteId);
    const [r] = await tx
      .insert(schema.offre)
      .values({ ...d, statut: 'brouillon', creePar: a.id })
      .returning({ id: schema.offre.id });
    await journaliser({ ...audit(a), action: 'offre.creee', objetType: 'offre', objetId: r!.id, apres: { slug: d.slug, titre: d.titre, origine: d.origine, lignePosteId: d.lignePosteId } }, tx);
    return r!.id;
  });
}

/**
 * Modifie une offre. Le slug est figé dès la première publication : les Candidatures, les
 * responsables d'offre et les liens déjà diffusés (Google, WhatsApp) y sont rattachés.
 */
export async function modifierOffre(id: number, entree: EntreeOffre, a: ActeurOffre): Promise<void> {
  await exigerGestion(a);
  const d = schemaOffre.parse(entree);
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(schema.offre).where(eq(schema.offre.id, id)).for('update');
    if (!avant) throw new ErreurMetier('Offre introuvable.');
    if (d.slug !== avant.slug) {
      if (avant.publieeLe || avant.statut !== 'brouillon') throw new ErreurMetier('L’adresse d’une offre déjà publiée ne peut plus changer.');
      await slugLibre(tx, d.slug, id);
    }
    if (avant.statut === 'publiee') {
      const manques = manquesPourPublier(d);
      if (manques.length) throw new ErreurMetier(`Une offre publiée doit rester complète : il manque ${manques.join(' et ')}.`);
    }
    await verifierLigne(tx, d.lignePosteId);
    await tx.update(schema.offre).set({ ...d, majLe: new Date() }).where(eq(schema.offre.id, id));
    const champs = Object.keys(d).filter((k) => JSON.stringify((d as Record<string, unknown>)[k]) !== JSON.stringify((avant as Record<string, unknown>)[k]));
    if (champs.length) await journaliser({ ...audit(a), action: 'offre.modifiee', objetType: 'offre', objetId: id, details: { champs } }, tx);
  });
}

/** Publier (ou rouvrir) / fermer manuellement. */
export async function changerStatutOffre(id: number, vers: StatutOffre, motif: string | null, a: ActeurOffre, maintenant = new Date()): Promise<{ slug: string }> {
  await exigerGestion(a);
  return getDb().transaction(async (tx) => {
    const [o] = await tx.select().from(schema.offre).where(eq(schema.offre.id, id)).for('update');
    if (!o) throw new ErreurMetier('Offre introuvable.');
    if (!transitionOffrePermise(o.statut, vers)) throw new ErreurMetier('Changement de statut impossible.');
    if (vers === 'publiee') {
      const manques = manquesPourPublier(o);
      if (manques.length) throw new ErreurMetier(`Avant de publier, ajoutez ${manques.join(' et ')}.`);
      if (o.valableJusquau && o.valableJusquau < dateDouala(maintenant)) throw new ErreurMetier('La date limite de candidature est passée : modifiez-la avant de publier.');
      if (o.lignePosteId && (await etatLigne(tx, o.lignePosteId))?.fermee) throw new ErreurMetier('La ligne de poste liée est pourvue ou son dossier est fermé.');
    }
    if (vers === 'fermee' && !motif?.trim()) motif = 'Fermeture manuelle';
    await tx
      .update(schema.offre)
      .set({
        statut: vers,
        publieeLe: vers === 'publiee' ? (o.publieeLe ?? dateDouala(maintenant)) : o.publieeLe,
        fermeeLe: vers === 'fermee' ? maintenant : null,
        motifFermeture: vers === 'fermee' ? motif!.trim() : null,
        majLe: maintenant,
      })
      .where(eq(schema.offre.id, id));
    await journaliser({ ...audit(a), action: vers === 'publiee' ? 'offre.publiee' : 'offre.fermee', objetType: 'offre', objetId: id, avant: o.statut, apres: vers, details: motif ? { motif } : undefined }, tx);
    return { slug: o.slug };
  });
}

/** Supprime un brouillon jamais publié et sans candidature. */
export async function supprimerBrouillon(id: number, a: ActeurOffre): Promise<void> {
  await exigerGestion(a);
  await getDb().transaction(async (tx) => {
    const [o] = await tx.select().from(schema.offre).where(eq(schema.offre.id, id)).for('update');
    if (!o) throw new ErreurMetier('Offre introuvable.');
    if (o.statut !== 'brouillon' || o.publieeLe) throw new ErreurMetier('Seul un brouillon jamais publié peut être supprimé ; fermez l’offre à la place.');
    const [c] = await tx.select({ n: count() }).from(schema.candidature).where(eq(schema.candidature.offreSlug, o.slug));
    if (c!.n > 0) throw new ErreurMetier('Des candidatures sont rattachées à cette offre.');
    await tx.delete(schema.offre).where(eq(schema.offre.id, id));
    await journaliser({ ...audit(a), action: 'offre.supprimee', objetType: 'offre', objetId: id, avant: { slug: o.slug, titre: o.titre } }, tx);
  });
}

/** ADR 0013 §3 : brouillon pré-rempli et anonymisé depuis une Ligne de poste (à relire avant publication). */
export async function preremplirDepuisLigne(lignePosteId: number, a: ActeurOffre): Promise<EntreeOffre> {
  await exigerGestion(a);
  const [l] = await getDb()
    .select({
      id: schema.lignePoste.id,
      intitule: schema.lignePoste.intitule,
      nombre: schema.lignePoste.nombre,
      missions: schema.lignePoste.missions,
      competences: schema.lignePoste.competences,
      experience: schema.lignePoste.experience,
      typeContrat: schema.lignePoste.typeContrat,
      horaires: schema.lignePoste.horaires,
      type: schema.dossier.type,
      secteur: schema.dossier.secteur,
      ville: schema.ville.nom,
      quartier: schema.quartier.nom,
    })
    .from(schema.lignePoste)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.lignePoste.dossierId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .leftJoin(schema.quartier, eq(schema.quartier.id, schema.dossier.quartierId))
    .where(eq(schema.lignePoste.id, lignePosteId));
  if (!l) throw new ErreurMetier('Ligne de poste introuvable.');
  if (l.type !== 'REC') throw new ErreurMetier('Seule une ligne de poste d’un dossier de recrutement peut porter une offre.');
  const brouillon = brouillonDepuisLigne(l);
  // Adresse unique : suffixe numérique si déjà prise.
  const pris = new Set((await getDb().select({ slug: schema.offre.slug }).from(schema.offre).where(sql`${schema.offre.slug} like ${brouillon.slug + '%'}`)).map((x) => x.slug));
  let slug = brouillon.slug;
  for (let i = 2; pris.has(slug); i++) slug = `${brouillon.slug}-${i}`;
  return { ...brouillon, slug };
}

// ─── Fermeture automatique (ADR 0013 §5) ──────────────────────

async function etatLigne(tx: Tx, lignePosteId: number) {
  const [l] = await tx
    .select({ nombre: schema.lignePoste.nombre, fermeLe: schema.dossier.fermeLe })
    .from(schema.lignePoste)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.lignePoste.dossierId))
    .where(eq(schema.lignePoste.id, lignePosteId));
  if (!l) return null;
  const [p] = await tx
    .select({ n: count() })
    .from(schema.placement)
    .where(and(eq(schema.placement.lignePosteId, lignePosteId), eq(schema.placement.statut, 'confirme')));
  const pourvue = lignePourvue(l.nombre, p!.n);
  return { pourvue, fermee: pourvue || l.fermeLe !== null };
}

async function fermerOffres(tx: Tx, ids: number[], motif: string, maintenant: Date): Promise<string[]> {
  if (!ids.length) return [];
  const r = await tx
    .update(schema.offre)
    .set({ statut: 'fermee', fermeeLe: maintenant, motifFermeture: motif, majLe: maintenant })
    .where(and(inArray(schema.offre.id, ids), eq(schema.offre.statut, 'publiee')))
    .returning({ id: schema.offre.id, slug: schema.offre.slug });
  for (const o of r) await journaliser({ acteurType: 'systeme', action: 'offre.fermee', objetType: 'offre', objetId: o.id, avant: 'publiee', apres: 'fermee', details: { motif, automatique: true } }, tx);
  return r.map((o) => o.slug);
}

/** Après un placement confirmé : ferme les offres publiées de la ligne si elle est pourvue. */
export async function fermerOffresSiLignePourvue(tx: Tx, lignePosteId: number, maintenant = new Date()): Promise<string[]> {
  const e = await etatLigne(tx, lignePosteId);
  if (!e?.pourvue) return [];
  const offres = await tx.select({ id: schema.offre.id }).from(schema.offre).where(and(eq(schema.offre.lignePosteId, lignePosteId), eq(schema.offre.statut, 'publiee')));
  return fermerOffres(tx, offres.map((o) => o.id), 'Ligne de poste pourvue', maintenant);
}

/** À la fermeture d'un Dossier (statut final) ou à la clôture de sa recherche : ferme ses offres publiées. */
export async function fermerOffresDuDossier(tx: Tx, dossierId: number, motif: string, maintenant = new Date()): Promise<string[]> {
  const offres = await tx
    .select({ id: schema.offre.id })
    .from(schema.offre)
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, schema.offre.lignePosteId))
    .where(and(eq(schema.lignePoste.dossierId, dossierId), eq(schema.offre.statut, 'publiee')));
  return fermerOffres(tx, offres.map((o) => o.id), motif, maintenant);
}

/** Ferme les offres dont la date limite de candidature est passée (tâche planifiée quotidienne). */
export async function fermerOffresEchues(maintenant = new Date()): Promise<number> {
  return getDb().transaction(async (tx) => {
    const offres = await tx
      .select({ id: schema.offre.id })
      .from(schema.offre)
      .where(and(eq(schema.offre.statut, 'publiee'), sql`${schema.offre.valableJusquau} < ${dateDouala(maintenant)}`));
    return (await fermerOffres(tx, offres.map((o) => o.id), 'Date limite de candidature passée', maintenant)).length;
  });
}
