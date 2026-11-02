// ============================================================
// Référentiels du domaine (CONTEXT.md, ADR 0007, 0018).
// Fichier sans dépendance serveur : importable côté client.
// ============================================================

/** Types de dossier et préfixes de numérotation (specs/MVP1-02 §2). */
export const DOSSIER_TYPES = {
  REC: 'Recrutement / placement',
  NET: 'Nettoyage',
  EV: 'Espaces verts',
  ABO: 'Abonnement',
  MAD: 'Mise à disposition',
  PAR: 'Partenariat',
  RCL: 'Réclamation',
} as const;

export type DossierType = keyof typeof DOSSIER_TYPES;
export const DOSSIER_TYPE_CODES = Object.keys(DOSSIER_TYPES) as [DossierType, ...DossierType[]];

/** Rôles combinables d'un collaborateur (ADR 0018). */
export const ROLES = {
  referent: 'Référent',
  finances: 'Responsable finances',
  direction: 'Direction',
  admin: 'Administrateur',
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_CODES = Object.keys(ROLES) as [Role, ...Role[]];

/** Rôles pour lesquels la double authentification est obligatoire (ADR 0016, M1-AUT-02). */
export const ROLES_2FA_OBLIGATOIRE: readonly Role[] = ['direction', 'finances', 'admin'];

/** Fuseau horaire de référence (specs/README.md). */
export const FUSEAU = 'Africa/Douala';
