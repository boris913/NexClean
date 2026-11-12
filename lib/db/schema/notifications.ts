// Notifications in-app et file d'envoi des e-mails (MVP1-05 RG-10..13), modèles WhatsApp (RG-14..17).
import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dossierTypeEnum } from './collaborateurs';
import { dossier } from './dossiers';

/**
 * Une ligne par destinataire. La notification in-app fait foi ; si `email` est vrai, la
 * ligne sert aussi de file d'envoi (envoi après validation de la transaction, reprise par la
 * tâche planifiée en cas d'échec). `cle` évite les doublons pour un même événement.
 */
export const notification = pgTable(
  'notification',
  {
    id: serial('id').primaryKey(),
    destinataireId: text('destinataire_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    dossierId: integer('dossier_id').references(() => dossier.id),
    titre: text('titre').notNull(),
    texte: text('texte').notNull(),
    lien: text('lien'),
    cle: text('cle'),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    luLe: timestamp('lu_le', { withTimezone: true }),
    /** Visible dans l'application (faux pour un e-mail seul, ex. escalade). */
    inApp: boolean('in_app').notNull().default(true),
    email: boolean('email').notNull().default(false),
    emailEnvoyeLe: timestamp('email_envoye_le', { withTimezone: true }),
    emailEchecLe: timestamp('email_echec_le', { withTimezone: true }),
    emailEssais: integer('email_essais').notNull().default(0),
  },
  (t) => [
    index('notification_destinataire_idx').on(t.destinataireId, t.luLe),
    uniqueIndex('notification_cle_uq').on(t.destinataireId, t.cle),
    index('notification_email_idx').on(t.email, t.emailEnvoyeLe),
  ],
);

export const modeleMessage = pgTable('modele_message', {
  id: serial('id').primaryKey(),
  nom: text('nom').notNull().unique(),
  /** Types de dossier concernés ; vide = tous. */
  types: dossierTypeEnum('types').array().notNull().default([]),
  langue: text('langue').notNull().default('fr'),
  texte: text('texte').notNull(),
  actif: boolean('actif').notNull().default(true),
  // COM2-02 RG-03 : modèle approuvé par Meta (envoi hors fenêtre de 24 h).
  /** Nom du modèle dans le WhatsApp Manager ; null = modèle interne seulement (texte prérempli). */
  metaNom: text('meta_nom'),
  metaLangue: text('meta_langue').notNull().default('fr'),
  /** Variables du modèle interne passées dans l'ordre {{1}}, {{2}}… */
  metaParametres: text('meta_parametres').array().notNull().default([]),
  /** Synchronisés depuis l'API Meta. */
  metaCategorie: text('meta_categorie'),
  metaStatut: text('meta_statut'),
  metaSynchroLe: timestamp('meta_synchro_le', { withTimezone: true }),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  modifieLe: timestamp('modifie_le', { withTimezone: true }).notNull().defaultNow(),
  modifiePar: text('modifie_par').references(() => user.id),
});
