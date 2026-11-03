// Paramètres administrables (MVP1-03 RG-05 : commission par personne, liste de métiers).
// Une ligne par clé ; chaque modification est journalisée (avant / après).
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const parametre = pgTable('parametre', {
  cle: text('cle').primaryKey(),
  valeur: jsonb('valeur').notNull(),
  modifieLe: timestamp('modifie_le', { withTimezone: true }).notNull().defaultNow(),
  modifiePar: text('modifie_par').references(() => user.id),
});
