// Rendez-vous commerciaux rattachés à un Dossier (specs/COM1-02 RG-01..03).
import { index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dossier } from './dossiers';
import { RDV_STATUT_CODES, RDV_TYPE_CODES } from '@/lib/rendezvous/domaine';

export const rdvTypeEnum = pgEnum('type_rendez_vous', RDV_TYPE_CODES);
export const rdvStatutEnum = pgEnum('statut_rendez_vous', RDV_STATUT_CODES);

export const rendezVous = pgTable(
  'rendez_vous',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    type: rdvTypeEnum('type').notNull(),
    /** Instant du début (stocké en UTC, affiché en Africa/Douala). */
    debut: timestamp('debut', { withTimezone: true }).notNull(),
    /** Dernière (re)planification de `debut` : un rappel dont l'heure était déjà passée n'est pas envoyé. */
    planifieLe: timestamp('planifie_le', { withTimezone: true }).notNull().defaultNow(),
    dureeMinutes: integer('duree_minutes').notNull().default(60),
    /** Adresse, lieu ou lien de visioconférence. */
    lieu: text('lieu'),
    /** Collaborateurs participants, en plus du référent du dossier. */
    participants: text('participants').array().notNull().default([]),
    statut: rdvStatutEnum('statut').notNull().default('prevu'),
    compteRendu: text('compte_rendu'),
    creePar: text('cree_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    modifieLe: timestamp('modifie_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rendez_vous_debut_idx').on(t.debut), index('rendez_vous_dossier_idx').on(t.dossierId)],
);
