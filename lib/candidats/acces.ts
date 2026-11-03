// Accès au vivier (MVP2-02 RG-13, ADR 0018) : Direction, ou Référent ayant le service Recrutement.
// Module sans dépendance Next.js ; la garde des pages (refus journalisé, 403) est dans ./acces-page.ts.
// Chaque consultation de fiche et téléchargement de CV est journalisé par l'appelant
// (actions `candidat.fiche_consultee` / `candidat.cv_telecharge`).
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { peut, type Permission } from '@/lib/authz/permissions';
import type { Role } from '@/lib/domain/referentiels';

export interface DemandeurVivier {
  id: string;
  roles: readonly Role[];
}

/** Règle pure : Direction, ou Référent avec le service Recrutement (`REC`). */
export function regleAccesVivier(c: DemandeurVivier, aServiceRecrutement: boolean, permission: Permission = 'candidat.voir'): boolean {
  if (!peut(c.roles, permission)) return false;
  return c.roles.includes('direction') || (c.roles.includes('referent') && aServiceRecrutement);
}

export async function aServiceRecrutement(userId: string): Promise<boolean> {
  const [s] = await getDb()
    .select({ userId: schema.collaborateurService.userId })
    .from(schema.collaborateurService)
    .where(and(eq(schema.collaborateurService.userId, userId), eq(schema.collaborateurService.typeDossier, 'REC')))
    .limit(1);
  return !!s;
}

export async function peutAccederVivier(c: DemandeurVivier, permission: Permission = 'candidat.voir'): Promise<boolean> {
  if (!peut(c.roles, permission)) return false;
  if (c.roles.includes('direction')) return true;
  return regleAccesVivier(c, await aServiceRecrutement(c.id), permission);
}
