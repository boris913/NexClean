// Rapport commercial hebdomadaire (specs/COM1-02 RG-09..11) : instantané figé à la génération.
import { date, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { ContenuRapport } from '@/lib/commercial/rapport';

export const rapportHebdomadaire = pgTable(
  'rapport_hebdomadaire',
  {
    id: serial('id').primaryKey(),
    /** Lundi de la semaine couverte (heure de Douala). */
    semaine: date('semaine').notNull(),
    /** « direction » (vue globale) ou identifiant du référent (ses dossiers). */
    portee: text('portee').notNull(),
    contenu: jsonb('contenu').$type<ContenuRapport>().notNull(),
    genereLe: timestamp('genere_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rapport_hebdomadaire_uq').on(t.semaine, t.portee)],
);
