// RG-23 (specs/MVP2-03) : révocation de l'accès client aux profils des candidats non placés, à la
// clôture de la recherche ou à la fermeture du Dossier. Module sans dépendance vers les services
// (appelé par lib/dossiers/service.ts et lib/propositions/service.ts, sans import circulaire).
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/**
 * Marque `accesRevoqueLe` sur toutes les Propositions non `placée` du Dossier (page de suivi) et
 * révoque leurs liens d'accès temporaires encore valides. Renvoie le nombre de Propositions touchées.
 */
export async function revoquerAccesNonPlaces(tx: Tx, dossierId: number, maintenant = new Date()): Promise<number> {
  const p = schema.proposition;
  const touchees = await tx
    .update(p)
    .set({ accesRevoqueLe: maintenant })
    .where(and(eq(p.dossierId, dossierId), ne(p.statut, 'placee'), isNull(p.accesRevoqueLe)))
    .returning({ id: p.id });
  // Liens temporaires : toutes les Propositions non placées du Dossier (y compris déjà révoquées).
  const nonPlacees = await tx
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.dossierId, dossierId), ne(p.statut, 'placee')));
  if (nonPlacees.length) {
    await tx
      .update(schema.accesProfil)
      .set({ revoqueLe: maintenant })
      .where(and(inArray(schema.accesProfil.propositionId, nonPlacees.map((x) => x.id)), isNull(schema.accesProfil.revoqueLe)));
  }
  return touchees.length;
}

/** Révoque les liens d'accès temporaires encore valides d'une Proposition (retrait, révocation). */
export async function revoquerLiensProposition(tx: Tx, propositionId: number, maintenant = new Date()): Promise<number> {
  const r = await tx
    .update(schema.accesProfil)
    .set({ revoqueLe: maintenant })
    .where(and(eq(schema.accesProfil.propositionId, propositionId), isNull(schema.accesProfil.revoqueLe)))
    .returning({ id: schema.accesProfil.id });
  return r.length;
}
