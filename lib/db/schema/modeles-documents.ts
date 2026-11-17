// Versions des modèles de documents PDF (specs/POST-05 RG-08..11). Une ligne par version,
// jamais modifiée ni supprimée ; sans ligne pour un type, le modèle d'origine (code) s'applique.
// La version applicable à un document est la dernière créée au plus tard à sa date de référence.
import { index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { TYPES_DOCUMENT_CODES, type ContenuModele } from '@/lib/documents/personnalisation';
import { user } from './auth';

export const typeModeleDocumentEnum = pgEnum('type_modele_document', TYPES_DOCUMENT_CODES);

export const modeleDocumentVersion = pgTable(
  'modele_document_version',
  {
    id: serial('id').primaryKey(),
    type: typeModeleDocumentEnum('type').notNull(),
    /** Numéro de version par type (1, 2…) ; 0 désigne le modèle d'origine, jamais stocké. */
    version: integer('version').notNull(),
    contenu: jsonb('contenu').$type<ContenuModele>().notNull(),
    commentaire: text('commentaire'),
    /** RG-10 : version recopiée par « Revenir à cette version » (0 = modèle d'origine). */
    restaureDe: integer('restaure_de'),
    creePar: text('cree_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('modele_document_version_uq').on(t.type, t.version), index('modele_document_vigueur_idx').on(t.type, t.creeLe)],
);
