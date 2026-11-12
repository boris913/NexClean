// WhatsApp Cloud API, réception (specs/COM2-01, ADR 0025).
import { bigserial, boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { candidat } from './candidats';
import { client, dossier } from './dossiers';

export const sensMessageEnum = pgEnum('sens_message_whatsapp', ['entrant', 'sortant']);
export const origineMessageEnum = pgEnum('origine_message_whatsapp', ['client', 'application', 'back_office']);
export const statutMessageEnum = pgEnum('statut_message_whatsapp', ['envoye', 'remis', 'lu', 'echec']);

/**
 * RG-02 : webhooks reçus, stockés tels quels avant traitement (réponse 200 immédiate).
 * Le traitement reprend les lignes non traitées (3 essais), y compris après une panne.
 */
export const webhookWhatsapp = pgTable(
  'webhook_whatsapp',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    recuLe: timestamp('recu_le', { withTimezone: true }).notNull().defaultNow(),
    corps: jsonb('corps').notNull(),
    traiteLe: timestamp('traite_le', { withTimezone: true }),
    essais: integer('essais').notNull().default(0),
    erreur: text('erreur'),
  },
  (t) => [index('webhook_whatsapp_attente_idx').on(t.traiteLe, t.essais)],
);

/** RG-05 : un numéro WhatsApp ↔ un Client (ou un Candidat connu, sans Dossier client). */
export const conversation = pgTable(
  'conversation',
  {
    id: serial('id').primaryKey(),
    /** Numéro du correspondant, E.164 (unique). */
    numero: text('numero').notNull().unique(),
    nomProfil: text('nom_profil'),
    clientId: integer('client_id').references(() => client.id),
    candidatId: integer('candidat_id').references(() => candidat.id),
    /** Dossier auquel les messages sont rattachés (RG-06, RG-07). */
    dossierId: integer('dossier_id').references(() => dossier.id),
    dernierEntrantLe: timestamp('dernier_entrant_le', { withTimezone: true }),
    /** Dernière réponse **humaine** (Back-Office ou téléphone) : les réponses automatiques n'y comptent pas. */
    dernierSortantLe: timestamp('dernier_sortant_le', { withTimezone: true }),
    /** COM2-02 RG-08 : « actif » (réponses automatiques permises) ou « manuel » (reprise de la main). */
    automate: text('automate').$type<'actif' | 'manuel'>().notNull().default('actif'),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conversation_dossier_idx').on(t.dossierId), index('conversation_entrant_idx').on(t.dernierEntrantLe)],
);

export interface MediaWhatsapp {
  mediaId: string;
  mime: string | null;
  nom: string | null;
  /** Clé de stockage interne (ADR 0003), une fois téléchargé. */
  cle?: string | null;
  taille?: number | null;
  tropVolumineux?: boolean;
  essais?: number;
  erreur?: string | null;
}

export const messageWhatsapp = pgTable(
  'message_whatsapp',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id),
    /** Identifiant WhatsApp (wamid) : idempotence (RG-02). */
    waId: text('wa_id').notNull().unique(),
    sens: sensMessageEnum('sens').notNull(),
    origine: origineMessageEnum('origine').notNull(),
    type: text('type').notNull(),
    texte: text('texte').notNull().default(''),
    media: jsonb('media').$type<MediaWhatsapp>(),
    horodatage: timestamp('horodatage', { withTimezone: true }).notNull(),
    /** COM2-02 : réponse automatique (accusé, mot-clé, confirmation STOP). */
    automatique: boolean('automatique').notNull().default(false),
    /** Collaborateur qui a envoyé depuis le Back-Office. */
    auteurId: text('auteur_id').references(() => user.id),
    /** Modèle Meta envoyé, et sa catégorie (plafond marketing, RG-10). */
    modele: text('modele'),
    categorie: text('categorie').$type<'utility' | 'marketing' | 'authentication'>(),
    statut: statutMessageEnum('statut'),
    statutLe: timestamp('statut_le', { withTimezone: true }),
    erreur: text('erreur'),
    recuLe: timestamp('recu_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('message_whatsapp_conversation_idx').on(t.conversationId, t.horodatage)],
);

/** COM2-02 RG-09 : accord explicite aux messages marketing (et son retrait par STOP). */
export const consentementWhatsapp = pgTable('consentement_whatsapp', {
  numero: text('numero').primaryKey(),
  accordLe: timestamp('accord_le', { withTimezone: true }),
  formulation: text('formulation'),
  canal: text('canal'),
  retireLe: timestamp('retire_le', { withTimezone: true }),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});

/** État du numéro synchronisé depuis Meta (note de qualité, RG-10). */
export const etatWhatsapp = pgTable('etat_whatsapp', {
  cle: text('cle').primaryKey(),
  valeur: jsonb('valeur').notNull(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});
