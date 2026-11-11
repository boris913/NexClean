// Agent conversationnel WhatsApp (specs/COM3-02, ADR 0026).
import { bigserial, boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dossier } from './dossiers';
import { conversation } from './whatsapp';

/** RG-03 : base de connaissances administrée par la Direction ; chaque modification incrémente la version. */
export const connaissance = pgTable('connaissance', {
  id: serial('id').primaryKey(),
  titre: text('titre').notNull(),
  contenu: text('contenu').notNull(),
  ordre: integer('ordre').notNull().default(0),
  actif: boolean('actif').notNull().default(true),
  version: integer('version').notNull().default(1),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
  majPar: text('maj_par').references(() => user.id),
});

/**
 * Journal de l'agent (RG-02, RG-05, RG-08, RG-09) : réponse envoyée, brouillon (mode fantôme),
 * message bloqué par le contrôle, passage à l'humain (avec son motif), qualification complète.
 */
export const evenementAgent = pgTable(
  'evenement_agent',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id),
    dossierId: integer('dossier_id').references(() => dossier.id),
    /** reponse | brouillon | bloque | passage | qualification_complete */
    type: text('type').notNull(),
    motif: text('motif'),
    texte: text('texte'),
    /** Outils appelés et leurs résultats (traçabilité, ADR 0026 §5). */
    outils: jsonb('outils'),
    modele: text('modele'),
    versionPrompt: text('version_prompt'),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('evenement_agent_conversation_idx').on(t.conversationId, t.creeLe), index('evenement_agent_type_idx').on(t.type, t.creeLe)],
);
