// Contrôle d'accès côté serveur (M1-ROL-03) : chaque page, action ou route du
// Back-Office appelle `exigerCollaborateur` avant toute lecture de données.
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getAuth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';
import { ipDepuisEnTetes, journaliser } from '@/lib/audit';
import type { Role } from '@/lib/domain/referentiels';
import { exige2FA, peut, type Permission } from './permissions';

export interface Collaborateur {
  id: string;
  nom: string;
  email: string;
  roles: Role[];
  deuxFacteurs: boolean;
  ip: string | null;
}

/** Collaborateur connecté et actif, ou null. Ne redirige pas. */
export async function collaborateurCourant(): Promise<Collaborateur | null> {
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;
  const db = getDb();
  const [u] = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, active: schema.user.active, twoFactorEnabled: schema.user.twoFactorEnabled })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id));
  if (!u?.active) return null;
  const roles = (await db.select({ role: schema.collaborateurRole.role }).from(schema.collaborateurRole).where(eq(schema.collaborateurRole.userId, u.id))).map((r) => r.role);
  return { id: u.id, nom: u.name, email: u.email, roles, deuxFacteurs: !!u.twoFactorEnabled, ip: ipDepuisEnTetes(h) };
}

interface Options {
  /** Permission requise ; sans permission, il suffit d'être un collaborateur connecté. */
  permission?: Permission;
  /** Autorise l'accès sans 2FA (page d'activation de la 2FA elle-même). */
  sans2FA?: boolean;
}

/**
 * Pour les pages : redirige vers la connexion si nécessaire, impose l'activation
 * de la 2FA pour les rôles sensibles (M1-AUT-02), et répond 403 (`forbidden()`)
 * si la permission manque. Les refus sont journalisés (M1-ROL-04).
 */
export async function exigerCollaborateur(options: Options = {}): Promise<Collaborateur> {
  const c = await collaborateurCourant();
  if (!c) redirect('/admin/connexion');
  if (!options.sans2FA && exige2FA(c.roles) && !c.deuxFacteurs) redirect('/admin/securite?obligatoire=1');
  if (options.permission && !peut(c.roles, options.permission)) {
    await journaliser({ acteurType: 'collaborateur', acteurId: c.id, action: 'acces.refuse', details: { permission: options.permission }, ip: c.ip });
    forbidden();
  }
  return c;
}
