// Matrice des droits (ADR 0018, M1-ROL-01). Définie dans le code : pas d'éditeur en V1.
// Fichier pur, sans dépendance serveur, testable unitairement.
import { ROLES_2FA_OBLIGATOIRE, type Role } from '@/lib/domain/referentiels';

export const PERMISSIONS = {
  /** Voir les dossiers qui lui sont attribués et la file Nouveaux candidats de ses villes. */
  'dossier.voir_siens': ['referent', 'direction'],
  /** Voir tous les dossiers (lecture seule pour le Responsable finances). */
  'dossier.voir_tous': ['finances', 'direction'],
  'dossier.traiter': ['referent', 'direction'],
  'dossier.reaffecter': ['direction'],
  'dossier.rouvrir': ['direction'],
  'ligne_poste.voir_salaire': ['referent', 'direction'],
  /** Vivier et fiches candidats. Pour un Référent, il faut en plus le service Recrutement (lib/candidats/acces.ts). */
  'candidat.voir': ['referent', 'direction'],
  /** Statut, notes, réinitialisation assistée, changement de numéro (MVP2-02). */
  'candidat.traiter': ['referent', 'direction'],
  /** Réaffecter un candidat ou une candidature, traiter la file « Non attribués ». */
  'candidat.reaffecter': ['direction'],
  /** Désigner le référent responsable d'une offre (MVP2-02 RG-10). */
  'offre.responsables': ['direction'],
  'encaissement.enregistrer': ['referent', 'finances', 'direction'],
  'remboursement.valider': ['direction'],
  'finances.tableau_de_bord': ['finances', 'direction'],
  /** Tableau de bord commercial (COM1-02 RG-05) : un Référent n'y voit que ses Dossiers. */
  'commercial.tableau_de_bord': ['referent', 'direction'],
  /** Messagerie WhatsApp (COM2-01 RG-10) : toutes les conversations. Un Référent voit celles de ses Dossiers. */
  'messagerie.voir_tout': ['direction'],
  'export.donnees': ['finances', 'direction'],
  'tarifs.modifier': ['direction', 'admin'],
  'modeles.gerer': ['direction', 'admin'],
  'referentiel.gerer': ['direction', 'admin'],
  'collaborateurs.attributs': ['direction', 'admin'],
  'collaborateurs.gerer': ['admin'],
  'audit.consulter': ['direction', 'admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Vrai si au moins un des rôles accorde la permission. */
export function peut(roles: readonly Role[], permission: Permission): boolean {
  const autorises: readonly Role[] = PERMISSIONS[permission];
  return roles.some((r) => autorises.includes(r));
}

/** Liste des permissions accordées à un ensemble de rôles (pour l'interface). */
export function permissionsDe(roles: readonly Role[]): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => peut(roles, p));
}

/** M1-AUT-02 : la 2FA est obligatoire si l'un des rôles est sensible. */
export function exige2FA(roles: readonly Role[]): boolean {
  return roles.some((r) => ROLES_2FA_OBLIGATOIRE.includes(r));
}
