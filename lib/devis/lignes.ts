// Lignes facturables d'un Dossier REC (specs/MVP2-04 RG-09, ADR 0010) : devis accepté + avenants
// acceptés, consolidés par ligne de poste. Utilisé par la facturation à la clôture de la recherche
// (montant final = Σ commission figée × placements retenus) et par l'écran du devis.
//
// Convention des avenants (lot A) : les lignes d'un avenant portent l'**écart** de personnes par
// ligne de poste (`nombre` positif ou négatif) et la commission figée applicable :
//  - ligne déjà présente au devis accepté → commission figée du devis (RG-02, inchangée) ;
//  - ligne de poste nouvelle → commission en vigueur à la création de l'avenant, figée dans l'avenant.
// La consolidation additionne donc `nombre` par (ligne de poste, commission).
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { LigneDevis } from './domaine';

type Lecteur = Pick<ReturnType<typeof getDb>, 'select'>;

export interface LigneFacturable {
  lignePosteId: number | null;
  intitule: string;
  /** Commission unitaire HT figée (devis ou avenant). */
  commission: number;
  /** Nombre de personnes contractuel : devis accepté ± avenants acceptés. */
  nombre: number;
}

/** Consolide des lignes (devis puis avenants, dans l'ordre) par ligne de poste et commission. */
export function consoliderLignes(listes: readonly (readonly Pick<LigneDevis, 'lignePosteId' | 'intitule' | 'commission' | 'nombre'>[])[]): LigneFacturable[] {
  const resultat: LigneFacturable[] = [];
  for (const lignes of listes) {
    for (const l of lignes) {
      const existante = resultat.find((r) => r.commission === l.commission && (l.lignePosteId !== null ? r.lignePosteId === l.lignePosteId : r.lignePosteId === null && r.intitule === l.intitule));
      if (existante) existante.nombre += l.nombre;
      else resultat.push({ lignePosteId: l.lignePosteId, intitule: l.intitule, commission: l.commission, nombre: l.nombre });
    }
  }
  return resultat.map((r) => ({ ...r, nombre: Math.max(0, r.nombre) }));
}

/** Devis (type `devis`) accepté du Dossier, le plus récent ; null s'il n'y en a pas. */
export async function devisAccepte(dossierId: number, db: Lecteur = getDb()) {
  const [d] = await db
    .select()
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis'), eq(schema.devis.statut, 'accepte')))
    .orderBy(desc(schema.devis.accepteLe), desc(schema.devis.id))
    .limit(1);
  return d ?? null;
}

/**
 * RG-09 : lignes facturables du Dossier = devis accepté + avenants acceptés, consolidées
 * `{ lignePosteId, intitule, commission, nombre }`. Vide si aucun devis n'est accepté.
 * `db` permet l'appel dans une transaction (clôture de la recherche).
 */
export async function lignesFacturables(dossierId: number, db: Lecteur = getDb()): Promise<LigneFacturable[]> {
  const d = await devisAccepte(dossierId, db);
  if (!d) return [];
  const avenants = await db
    .select({ lignes: schema.devis.lignes })
    .from(schema.devis)
    .where(and(eq(schema.devis.devisInitialId, d.id), eq(schema.devis.type, 'avenant'), eq(schema.devis.statut, 'accepte')))
    .orderBy(schema.devis.accepteLe, schema.devis.id);
  return consoliderLignes([d.lignes, ...avenants.map((a) => a.lignes)]);
}

/**
 * RG-08 : état des devis du Dossier pour les transitions manuelles (`changerStatut`) : présence de
 * devis intégrés (mode transitoire sinon) et dernier devis (type `devis`) refusé (réouverture).
 */
export async function etatDevisDossier(dossierId: number, db: Lecteur = getDb()): Promise<{ aDesDevis: boolean; dernierDevisRefuse: boolean }> {
  const [dernier] = await db
    .select({ statut: schema.devis.statut })
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis')))
    .orderBy(desc(schema.devis.id))
    .limit(1);
  return { aDesDevis: !!dernier, dernierDevisRefuse: dernier?.statut === 'refuse' };
}
