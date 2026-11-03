// Droits sur un dossier précis (ADR 0018, M1-ROL-04) — module pur.
import { peut } from '@/lib/authz/permissions';
import type { Role } from '@/lib/domain/referentiels';

export interface Demandeur {
  id: string;
  roles: readonly Role[];
}

/** Lecture : Direction / Responsable finances voient tout ; un Référent ne voit que ses dossiers. */
export function peutVoir(c: Demandeur, referentId: string | null): boolean {
  if (peut(c.roles, 'dossier.voir_tous')) return true;
  return peut(c.roles, 'dossier.voir_siens') && referentId === c.id;
}

/** Traitement (statut, notes, documents, modifications) : référent du dossier ou Direction. */
export function peutTraiter(c: Demandeur, referentId: string | null): boolean {
  if (!peut(c.roles, 'dossier.traiter')) return false;
  return c.roles.includes('direction') || referentId === c.id;
}

/** Salaires / budgets des lignes de poste (ADR 0018) : référent du dossier ou Direction. */
export function peutVoirSalaire(c: Demandeur, referentId: string | null): boolean {
  if (!peut(c.roles, 'ligne_poste.voir_salaire')) return false;
  return c.roles.includes('direction') || referentId === c.id;
}
