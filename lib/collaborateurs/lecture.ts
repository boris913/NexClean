// Lectures pour les écrans de gestion des collaborateurs.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { Role } from '@/lib/domain/referentiels';

export interface LigneCollaborateur {
  id: string;
  nom: string;
  email: string;
  actif: boolean;
  deuxFacteurs: boolean;
  /** Mot de passe défini (compte activé). */
  active: boolean;
  roles: Role[];
}

export async function listerCollaborateurs(): Promise<LigneCollaborateur[]> {
  const db = getDb();
  const users = await db
    .select({ id: schema.user.id, nom: schema.user.name, email: schema.user.email, actif: schema.user.active, deuxFacteurs: schema.user.twoFactorEnabled })
    .from(schema.user)
    .orderBy(asc(schema.user.name));
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const [roles, comptes] = await Promise.all([
    db.select().from(schema.collaborateurRole).where(inArray(schema.collaborateurRole.userId, ids)),
    db.select({ userId: schema.account.userId }).from(schema.account).where(and(inArray(schema.account.userId, ids), eq(schema.account.providerId, 'credential'))),
  ]);
  const avecMotDePasse = new Set(comptes.map((c) => c.userId));
  return users.map((u) => ({
    ...u,
    deuxFacteurs: !!u.deuxFacteurs,
    active: avecMotDePasse.has(u.id),
    roles: roles.filter((r) => r.userId === u.id).map((r) => r.role),
  }));
}

export async function lireCollaborateur(id: string): Promise<LigneCollaborateur | null> {
  const tous = await listerCollaborateurs();
  return tous.find((c) => c.id === id) ?? null;
}
