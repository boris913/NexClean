// Référentiel géographique : lecture et administration (M1-GEO-01..03, 05).
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier, type Auteur } from '@/lib/collaborateurs/service';
import { QUARTIERS_AFFICHES_INITIAUX, VILLES_INITIALES } from './donnees-initiales';

const auteurAudit = (a: Auteur) => ({ acteurType: a.id ? ('collaborateur' as const) : ('systeme' as const), acteurId: a.id, ip: a.ip ?? null });

/** Insère les données initiales ; idempotent (n'écrase rien d'existant). */
export async function initialiserReferentiel(): Promise<{ villes: number; arrondissements: number; quartiers: number }> {
  const db = getDb();
  const compte = { villes: 0, arrondissements: 0, quartiers: 0 };
  await db.transaction(async (tx) => {
    for (const v of VILLES_INITIALES) {
      const insereeV = await tx.insert(schema.ville).values({ nom: v.nom, couverte: v.couverte, ordre: v.ordre }).onConflictDoNothing().returning({ id: schema.ville.id });
      compte.villes += insereeV.length;
      const [ville] = await tx.select({ id: schema.ville.id }).from(schema.ville).where(eq(schema.ville.nom, v.nom));
      for (const [nomArr, quartiers] of Object.entries(v.arrondissements)) {
        const insereeA = await tx.insert(schema.arrondissement).values({ villeId: ville!.id, nom: nomArr }).onConflictDoNothing().returning({ id: schema.arrondissement.id });
        compte.arrondissements += insereeA.length;
        const [arr] = await tx.select({ id: schema.arrondissement.id }).from(schema.arrondissement).where(and(eq(schema.arrondissement.villeId, ville!.id), eq(schema.arrondissement.nom, nomArr)));
        for (const nomQ of quartiers) {
          const insereeQ = await tx.insert(schema.quartier).values({ villeId: ville!.id, arrondissementId: arr!.id, nom: nomQ, afficheSite: (QUARTIERS_AFFICHES_INITIAUX[v.nom] ?? []).includes(nomQ) }).onConflictDoNothing().returning({ id: schema.quartier.id });
          compte.quartiers += insereeQ.length;
        }
      }
    }
  });
  return compte;
}

/** Arbre complet pour l'administration (entrées inactives incluses). */
export async function lireReferentiel() {
  const db = getDb();
  const [villes, arrondissements, quartiers] = await Promise.all([
    db.select().from(schema.ville).orderBy(asc(schema.ville.ordre), asc(schema.ville.nom)),
    db.select().from(schema.arrondissement).orderBy(asc(schema.arrondissement.nom)),
    db.select().from(schema.quartier).orderBy(asc(schema.quartier.nom)),
  ]);
  return villes.map((v) => ({
    ...v,
    arrondissements: arrondissements
      .filter((a) => a.villeId === v.id)
      .map((a) => ({ ...a, quartiers: quartiers.filter((q) => q.arrondissementId === a.id) })),
    quartiersNonRattaches: quartiers.filter((q) => q.villeId === v.id && q.arrondissementId === null),
  }));
}

/** Villes couvertes et actives, pour le site public (M1-GEO-05). */
export async function villesCouvertes(): Promise<string[]> {
  const rows = await getDb()
    .select({ nom: schema.ville.nom })
    .from(schema.ville)
    .where(and(eq(schema.ville.couverte, true), eq(schema.ville.actif, true)))
    .orderBy(asc(schema.ville.ordre), asc(schema.ville.nom));
  return rows.map((r) => r.nom);
}

export interface CouverturePublique {
  villes: string[];
  /** Quartiers cochés « Afficher sur le site », actifs, des villes couvertes, groupés par ville. */
  quartiers: { ville: string; noms: string[] }[];
}

/** Ce que le site public annonce (M1-GEO-05) : villes couvertes et quartiers mis en avant. */
export async function couverturePublique(): Promise<CouverturePublique> {
  const villes = await villesCouvertes();
  const lignes = await getDb()
    .select({ ville: schema.ville.nom, nom: schema.quartier.nom })
    .from(schema.quartier)
    .innerJoin(schema.ville, eq(schema.ville.id, schema.quartier.villeId))
    .where(and(eq(schema.quartier.afficheSite, true), eq(schema.quartier.actif, true), eq(schema.ville.couverte, true), eq(schema.ville.actif, true)))
    .orderBy(asc(schema.ville.ordre), asc(schema.quartier.nom));
  const quartiers = villes
    .map((ville) => ({ ville, noms: lignes.filter((l) => l.ville === ville).map((l) => l.nom) }))
    .filter((g) => g.noms.length > 0);
  return { villes, quartiers };
}

const nom = z.string().trim().min(2, 'Nom trop court').max(80);

export async function ajouterVille(donnees: { nom: string; couverte: boolean }, auteur: Auteur) {
  const d = z.object({ nom, couverte: z.boolean() }).parse(donnees);
  const [v] = await getDb().insert(schema.ville).values(d).onConflictDoNothing().returning();
  if (!v) throw new ErreurMetier('Cette ville existe déjà.');
  await journaliser({ ...auteurAudit(auteur), action: 'referentiel.ville_ajoutee', objetType: 'ville', objetId: v.id, apres: v });
  return v;
}

export async function ajouterArrondissement(donnees: { villeId: number; nom: string }, auteur: Auteur) {
  const d = z.object({ villeId: z.number().int().positive(), nom }).parse(donnees);
  const [a] = await getDb().insert(schema.arrondissement).values(d).onConflictDoNothing().returning();
  if (!a) throw new ErreurMetier('Cet arrondissement existe déjà dans cette ville.');
  await journaliser({ ...auteurAudit(auteur), action: 'referentiel.arrondissement_ajoute', objetType: 'arrondissement', objetId: a.id, apres: a });
  return a;
}

export async function ajouterQuartier(donnees: { villeId: number; arrondissementId: number | null; nom: string }, auteur: Auteur) {
  const d = z.object({ villeId: z.number().int().positive(), arrondissementId: z.number().int().positive().nullable(), nom }).parse(donnees);
  const [q] = await getDb().insert(schema.quartier).values(d).onConflictDoNothing().returning();
  if (!q) throw new ErreurMetier('Ce quartier existe déjà dans cette ville.');
  await journaliser({ ...auteurAudit(auteur), action: 'referentiel.quartier_ajoute', objetType: 'quartier', objetId: q.id, apres: q });
  return q;
}

type Entite = 'ville' | 'arrondissement' | 'quartier';
const tables = { ville: schema.ville, arrondissement: schema.arrondissement, quartier: schema.quartier } as const;

/** Renommer / activer / désactiver. Une entrée n'est jamais supprimée (M1-GEO-03). */
export async function modifierEntree(
  entite: Entite,
  id: number,
  changements: { nom?: string; actif?: boolean; couverte?: boolean; afficheSite?: boolean; latitude?: number | null; longitude?: number | null },
  auteur: Auteur,
) {
  const c = z
    .object({
      nom: nom.optional(),
      actif: z.boolean().optional(),
      couverte: z.boolean().optional(),
      afficheSite: z.boolean().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
    })
    .parse(changements);
  if (entite !== 'ville' && c.couverte !== undefined) throw new ErreurMetier('« Couverte » ne s’applique qu’aux villes.');
  if (entite !== 'quartier' && c.afficheSite !== undefined) throw new ErreurMetier('« Afficher sur le site » ne s’applique qu’aux quartiers.');
  if (entite !== 'quartier' && (c.latitude !== undefined || c.longitude !== undefined)) throw new ErreurMetier('Les coordonnées ne s’appliquent qu’aux quartiers.');
  const table = tables[entite];
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(table).where(eq(table.id, id));
    if (!avant) throw new ErreurMetier('Entrée introuvable.');
    const [apres] = await tx.update(table).set(c).where(eq(table.id, id)).returning();
    await journaliser({ ...auteurAudit(auteur), action: `referentiel.${entite}_modifie`, objetType: entite, objetId: id, avant, apres }, tx);
  });
}

/** Listes pour les formulaires : villes actives (couvertes en tête), leurs arrondissements et quartiers actifs. */
export async function listesLieux() {
  const db = getDb();
  const [villes, arrondissements, quartiers] = await Promise.all([
    db.select({ id: schema.ville.id, nom: schema.ville.nom, couverte: schema.ville.couverte }).from(schema.ville).where(eq(schema.ville.actif, true)).orderBy(desc(schema.ville.couverte), asc(schema.ville.ordre), asc(schema.ville.nom)),
    db.select({ id: schema.arrondissement.id, nom: schema.arrondissement.nom, villeId: schema.arrondissement.villeId }).from(schema.arrondissement).where(eq(schema.arrondissement.actif, true)).orderBy(asc(schema.arrondissement.nom)),
    db.select({ id: schema.quartier.id, nom: schema.quartier.nom, villeId: schema.quartier.villeId, arrondissementId: schema.quartier.arrondissementId }).from(schema.quartier).where(eq(schema.quartier.actif, true)).orderBy(asc(schema.quartier.nom)),
  ]);
  return villes.map((v) => ({
    ...v,
    arrondissements: arrondissements.filter((a) => a.villeId === v.id).map(({ id, nom }) => ({ id, nom })),
    quartiers: quartiers.filter((q) => q.villeId === v.id).map(({ id, nom, arrondissementId }) => ({ id, nom, arrondissementId })),
  }));
}

/** Noms de la ville et du quartier choisis dans le référentiel (null si non trouvés). */
export async function nomsLieu(villeId: number | null, quartierId: number | null): Promise<{ ville: string | null; quartier: string | null }> {
  const db = getDb();
  const [v] = villeId ? await db.select({ nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.id, villeId)) : [];
  const [q] = quartierId ? await db.select({ nom: schema.quartier.nom }).from(schema.quartier).where(eq(schema.quartier.id, quartierId)) : [];
  return { ville: v?.nom ?? null, quartier: q?.nom ?? null };
}

export type ListesLieux = Awaited<ReturnType<typeof listesLieux>>;

// ---------------------------------------------------------------------------
// M1-GEO-04 : revue des saisies « Autre quartier »
// ---------------------------------------------------------------------------

/** Forme comparable d'une saisie libre : sans espaces superflus, insensible à la casse. */
const cleSaisie = sql<string>`lower(btrim(${schema.dossier.quartierAutre}))`;

export interface SaisieAutre {
  villeId: number;
  ville: string;
  /** Libellé tel que saisi la première fois. */
  saisie: string;
  nombreDossiers: number;
  /** Numéros des 5 dossiers les plus récents portant cette saisie. */
  numeros: string[];
}

/** Saisies « Autre quartier » non encore rattachées, regroupées par ville et par libellé. */
export async function saisiesAutreQuartier(): Promise<SaisieAutre[]> {
  const groupes = await getDb()
    .select({
      villeId: schema.dossier.villeId,
      ville: schema.ville.nom,
      saisie: sql<string>`(array_agg(btrim(${schema.dossier.quartierAutre}) order by ${schema.dossier.creeLe}))[1]`,
      nombreDossiers: count(),
      numeros: sql<string[]>`(array_agg(${schema.dossier.numero} order by ${schema.dossier.creeLe} desc))[1:5]`,
    })
    .from(schema.dossier)
    .innerJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(and(isNull(schema.dossier.quartierId), isNotNull(schema.dossier.quartierAutre), sql`btrim(${schema.dossier.quartierAutre}) <> ''`))
    .groupBy(schema.dossier.villeId, schema.ville.nom, cleSaisie)
    .orderBy(desc(count()), asc(schema.ville.nom));
  return groupes.map((g) => ({ ...g, villeId: g.villeId! }));
}

/**
 * Convertit une saisie « Autre quartier » en Quartier du référentiel (M1-GEO-04) : quartier existant,
 * ou nouveau quartier créé à cette occasion. Tous les Dossiers de la ville portant la même saisie
 * (casse et espaces ignorés) sont rattachés au quartier ; leur historique en garde la trace.
 */
export async function convertirSaisieAutre(
  donnees: { villeId: number; saisie: string; quartierId?: number | null; nouveau?: { nom: string; arrondissementId: number | null } | null },
  auteur: Auteur,
): Promise<{ quartierId: number; dossiers: number }> {
  const d = z
    .object({
      villeId: z.number().int().positive(),
      saisie: z.string().trim().min(1),
      quartierId: z.number().int().positive().nullish(),
      nouveau: z.object({ nom, arrondissementId: z.number().int().positive().nullable() }).nullish(),
    })
    .parse(donnees);
  if (!d.quartierId === !d.nouveau) throw new ErreurMetier('Choisissez un quartier existant ou créez-en un nouveau.');

  return getDb().transaction(async (tx) => {
    let quartier: typeof schema.quartier.$inferSelect | undefined;
    if (d.quartierId) {
      [quartier] = await tx.select().from(schema.quartier).where(eq(schema.quartier.id, d.quartierId));
      if (!quartier || quartier.villeId !== d.villeId) throw new ErreurMetier('Ce quartier n’appartient pas à la ville de la saisie.');
      if (!quartier.actif) throw new ErreurMetier('Ce quartier est désactivé : réactivez-le d’abord.');
    } else {
      const n = d.nouveau!;
      if (n.arrondissementId) {
        const [a] = await tx.select({ villeId: schema.arrondissement.villeId }).from(schema.arrondissement).where(eq(schema.arrondissement.id, n.arrondissementId));
        if (!a || a.villeId !== d.villeId) throw new ErreurMetier('Cet arrondissement n’appartient pas à la ville de la saisie.');
      }
      [quartier] = await tx.insert(schema.quartier).values({ villeId: d.villeId, arrondissementId: n.arrondissementId, nom: n.nom }).onConflictDoNothing().returning();
      if (!quartier) throw new ErreurMetier('Ce quartier existe déjà dans cette ville : choisissez-le dans la liste.');
      await journaliser({ ...auteurAudit(auteur), action: 'referentiel.quartier_ajoute', objetType: 'quartier', objetId: quartier.id, apres: quartier }, tx);
    }
    const cible = quartier;

    const concernes = await tx
      .select({ id: schema.dossier.id, quartierAutre: schema.dossier.quartierAutre })
      .from(schema.dossier)
      .where(and(eq(schema.dossier.villeId, d.villeId), isNull(schema.dossier.quartierId), sql`${cleSaisie} = lower(${d.saisie})`));
    if (concernes.length === 0) throw new ErreurMetier('Aucun dossier ne porte plus cette saisie : elle a peut-être déjà été traitée.');

    const ids = concernes.map((c) => c.id);
    await tx.update(schema.dossier).set({ quartierId: cible.id, quartierAutre: null, derniereActionLe: new Date() }).where(inArray(schema.dossier.id, ids));
    await tx.insert(schema.evenementDossier).values(
      concernes.map((c) => ({
        dossierId: c.id,
        auteurId: auteur.id,
        type: 'modification' as const,
        commentaire: `Quartier « ${c.quartierAutre?.trim()} » rattaché au référentiel : ${cible.nom}.`,
        avant: { quartierAutre: c.quartierAutre },
        apres: { quartierId: cible.id, quartier: cible.nom },
      })),
    );
    await journaliser(
      {
        ...auteurAudit(auteur),
        action: 'referentiel.saisie_convertie',
        objetType: 'quartier',
        objetId: cible.id,
        avant: { villeId: d.villeId, saisie: d.saisie },
        apres: { quartierId: cible.id, dossiers: ids },
      },
      tx,
    );
    return { quartierId: cible.id, dossiers: ids.length };
  });
}
