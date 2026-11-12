// Copilote IA (specs/COM3-01, ADR 0026) : journal des appels et suggestions proposées aux référents.
import { bigserial, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dossier } from './dossiers';

/** RG-03 : un appel au fournisseur = une ligne (tâche, modèle, version du prompt, jetons, durée, issue). */
export const journalIa = pgTable(
  'journal_ia',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tache: text('tache').notNull(),
    modele: text('modele').notNull(),
    versionPrompt: text('version_prompt').notNull(),
    jetonsEntree: integer('jetons_entree'),
    jetonsSortie: integer('jetons_sortie'),
    dureeMs: integer('duree_ms').notNull(),
    /** ok | invalide (sortie hors schéma) | refus | echec (panne, délai dépassé) | rejete (contrôle métier). */
    issue: text('issue').notNull(),
    erreur: text('erreur'),
    dossierId: integer('dossier_id').references(() => dossier.id),
    collaborateurId: text('collaborateur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_ia_cree_idx').on(t.creeLe)],
);

/** RG-06, RG-07, RG-10 : suggestions sur un Dossier (l'IA propose, le référent valide). */
export const suggestionIa = pgTable(
  'suggestion_ia',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    /** qualification | classification | resume */
    tache: text('tache').notNull(),
    contenu: jsonb('contenu').notNull(),
    versionPrompt: text('version_prompt').notNull(),
    /** proposee | appliquee | ignoree */
    statut: text('statut').notNull().default('proposee'),
    traiteLe: timestamp('traite_le', { withTimezone: true }),
    traitePar: text('traite_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('suggestion_ia_dossier_idx').on(t.dossierId, t.tache, t.creeLe)],
);
