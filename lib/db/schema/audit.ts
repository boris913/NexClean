// Journal d'audit en ajout seul (M1-AUD-01..03). L'immuabilité est garantie par un
// déclencheur SQL (migration 0001_journal_immuable) : aucun UPDATE / DELETE / TRUNCATE.
import { bigserial, index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const acteurTypeEnum = pgEnum('type_acteur', ['collaborateur', 'client', 'candidat', 'systeme', 'anonyme']);

export const journalAudit = pgTable(
  'journal_audit',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    horodatage: timestamp('horodatage', { withTimezone: true }).notNull().defaultNow(),
    acteurType: acteurTypeEnum('acteur_type').notNull(),
    /** Identifiant du collaborateur / client / candidat ; null pour système ou anonyme. */
    acteurId: text('acteur_id'),
    action: text('action').notNull(),
    objetType: text('objet_type'),
    objetId: text('objet_id'),
    avant: jsonb('avant'),
    apres: jsonb('apres'),
    details: jsonb('details'),
    ip: text('ip'),
  },
  (t) => [
    index('journal_horodatage_idx').on(t.horodatage),
    index('journal_action_horodatage_idx').on(t.action, t.horodatage),
    index('journal_objet_idx').on(t.objetType, t.objetId),
    index('journal_acteur_idx').on(t.acteurId),
  ],
);
