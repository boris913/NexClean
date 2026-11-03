// Garde des pages et actions du vivier (MVP2-02 RG-13).
import { forbidden } from 'next/navigation';
import { journaliser } from '@/lib/audit';
import type { Permission } from '@/lib/authz/permissions';
import { exigerCollaborateur, type Collaborateur } from '@/lib/authz/session';
import { peutAccederVivier } from './acces';

/**
 * Pour les pages et actions du vivier : collaborateur connecté (2FA si exigée), puis 403
 * journalisé si l'accès au vivier manque (critère d'acceptation RG-13).
 */
export async function exigerAccesVivier(permission: Permission = 'candidat.voir', details?: Record<string, unknown>): Promise<Collaborateur> {
  const c = await exigerCollaborateur();
  if (!(await peutAccederVivier(c, permission))) {
    await journaliser({ acteurType: 'collaborateur', acteurId: c.id, action: 'acces.refuse', details: { permission, vivier: true, ...details }, ip: c.ip });
    forbidden();
  }
  return c;
}
