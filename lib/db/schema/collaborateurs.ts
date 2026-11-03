// Rôles et attributs des collaborateurs (ADR 0018, 0019 ; M1-ROL-01/02, M1-AUT-03).
import { date, index, integer, pgEnum, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { DOSSIER_TYPE_CODES, ROLE_CODES } from '@/lib/domain/referentiels';
import { user } from './auth';
import { ville } from './geo';

export const roleEnum = pgEnum('role_collaborateur', ROLE_CODES);
export const dossierTypeEnum = pgEnum('type_dossier', DOSSIER_TYPE_CODES);

export const collaborateurRole = pgTable(
  'collaborateur_role',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/** Services (types de dossier) traités par un collaborateur. */
export const collaborateurService = pgTable(
  'collaborateur_service',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    typeDossier: dossierTypeEnum('type_dossier').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.typeDossier] })],
);

/** Villes couvertes par un collaborateur. */
export const collaborateurVille = pgTable(
  'collaborateur_ville',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    villeId: integer('ville_id')
      .notNull()
      .references(() => ville.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.villeId] })],
);

/** Attributs scalaires : téléphone, capacité, absence (M1-ROL-02). */
export const collaborateurProfil = pgTable('collaborateur_profil', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  telephone: text('telephone'),
  /** Nombre maximal de dossiers ouverts ; null = illimité. */
  capacite: integer('capacite'),
  absentDu: date('absent_du'),
  absentAu: date('absent_au'),
  /** Dernière attribution reçue : départage « tour de rôle » (MVP1-05 RG-03). */
  derniereAttributionLe: timestamp('derniere_attribution_le', { withTimezone: true }),
});

/** Lien d'activation de compte (48 h, usage unique). Seule l'empreinte SHA-256 est stockée. */
export const jetonActivation = pgTable(
  'jeton_activation',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    empreinte: text('empreinte').notNull().unique(),
    expireLe: timestamp('expire_le', { withTimezone: true }).notNull(),
    utiliseLe: timestamp('utilise_le', { withTimezone: true }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('jeton_activation_user_idx').on(t.userId)],
);
