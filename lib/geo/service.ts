// Référentiel géographique : lecture et administration (M1-GEO-01..03, 05).
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier, type Auteur } from '@/lib/collaborateurs/service';
import { VILLES_INITIALES } from './donnees-initiales';

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
          const insereeQ = await tx.insert(schema.quartier).values({ villeId: ville!.id, arrondissementId: arr!.id, nom: nomQ }).onConflictDoNothing().returning({ id: schema.quartier.id });
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
    .orderBy(asc(schema.ville.ordre));
  return rows.map((r) => r.nom);
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
  changements: { nom?: string; actif?: boolean; couverte?: boolean; latitude?: number | null; longitude?: number | null },
  auteur: Auteur,
) {
  const c = z
    .object({
      nom: nom.optional(),
      actif: z.boolean().optional(),
      couverte: z.boolean().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
    })
    .parse(changements);
  if (entite !== 'ville' && c.couverte !== undefined) throw new ErreurMetier('« Couverte » ne s’applique qu’aux villes.');
  if (entite !== 'quartier' && (c.latitude !== undefined || c.longitude !== undefined)) throw new ErreurMetier('Les coordonnées ne s’appliquent qu’aux quartiers.');
  const table = tables[entite];
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(table).where(eq(table.id, id));
    if (!avant) throw new ErreurMetier('Entrée introuvable.');
    const [apres] = await tx.update(table).set(c).where(eq(table.id, id)).returning();
    await journaliser({ ...auteurAudit(auteur), action: `referentiel.${entite}_modifie`, objetType: entite, objetId: id, avant, apres }, tx);
  });
}
