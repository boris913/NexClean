// Client, Demande, Dossier, lignes de poste, historique, documents (ADR 0006, 0007, 0003 ; specs/MVP1-02).
import { sql } from 'drizzle-orm';
import { bigserial, boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { STATUT_CODES } from '@/lib/dossiers/statuts';
import { user } from './auth';
import { dossierTypeEnum } from './collaborateurs';
import { quartier, ville } from './geo';

export const clientTypeEnum = pgEnum('type_client', ['entreprise', 'particulier']);
export const canalEnum = pgEnum('canal_demande', ['site', 'whatsapp', 'telephone', 'email', 'visite', 'autre']);
export const statutEnum = pgEnum('statut_dossier', STATUT_CODES);
export const categorieDocumentEnum = pgEnum('categorie_document', ['piece_client', 'devis_externe', 'justificatif', 'autre']);
export const evenementTypeEnum = pgEnum('type_evenement', [
  'creation',
  'transition',
  'modification',
  'attribution',
  'reaffectation',
  'note',
  'document',
  'rattachement',
  'whatsapp',
  'lien_suivi',
  'client',
]);

export const client = pgTable('client', {
  id: serial('id').primaryKey(),
  type: clientTypeEnum('type').notNull(),
  /** Raison sociale (entreprise) ou nom (particulier). */
  nom: text('nom').notNull(),
  contact: text('contact'),
  /** Identifiant unique (E.164), RG-03. */
  whatsapp: text('whatsapp').notNull().unique(),
  autreTelephone: text('autre_telephone'),
  email: text('email'),
  villeId: integer('ville_id').references(() => ville.id),
  quartierId: integer('quartier_id').references(() => quartier.id),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});

/** Séquence de numérotation par type et par année (RG-01). */
export const sequenceDossier = pgTable(
  'sequence_dossier',
  {
    type: dossierTypeEnum('type').notNull(),
    annee: integer('annee').notNull(),
    dernier: integer('dernier').notNull(),
  },
  (t) => [primaryKey({ columns: [t.type, t.annee] })],
);

export const dossier = pgTable(
  'dossier',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    type: dossierTypeEnum('type').notNull(),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id),
    referentId: text('referent_id').references(() => user.id),
    statut: statutEnum('statut').notNull().default('nouvelle_demande'),
    villeId: integer('ville_id').references(() => ville.id),
    villeAutre: text('ville_autre'),
    quartierId: integer('quartier_id').references(() => quartier.id),
    quartierAutre: text('quartier_autre'),
    lieu: text('lieu'),
    secteur: text('secteur'),
    description: text('description'),
    /** Jeton de la page de suivi (≥ 128 bits), RG-24. */
    jetonSuivi: text('jeton_suivi').notNull().unique(),
    /** Date de passage à un statut final (expiration du lien de suivi, RG-29). */
    fermeLe: timestamp('ferme_le', { withTimezone: true }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    derniereActionLe: timestamp('derniere_action_le', { withTimezone: true }).notNull().defaultNow(),
    /** Entrée dans la file « Non attribués » (MVP1-05 RG-05, RG-06) ; null si attribué. */
    enFileDepuis: timestamp('en_file_depuis', { withTimezone: true }),
    /** Dernière relance d'escalade envoyée à la Direction (RG-06). */
    derniereRelanceLe: timestamp('derniere_relance_le', { withTimezone: true }),
  },
  (t) => [
    index('dossier_referent_idx').on(t.referentId),
    index('dossier_client_idx').on(t.clientId),
    index('dossier_statut_idx').on(t.statut),
    index('dossier_cree_le_idx').on(t.creeLe),
  ],
);

export const demande = pgTable(
  'demande',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id),
    canal: canalEnum('canal').notNull(),
    /** Formulaire d'origine (ex. « demande-personnel », « devis-pro ») ou « saisie ». */
    formulaire: text('formulaire').notNull(),
    /** Données soumises, telles quelles (RG-06). Immuables. */
    donnees: jsonb('donnees').notNull(),
    /** Empreinte des données normalisées, pour l'anti-doublon. */
    empreinte: text('empreinte').notNull(),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('demande_dossier_idx').on(t.dossierId), index('demande_doublon_idx').on(t.clientId, t.formulaire, t.empreinte, t.creeLe)],
);

export const lignePoste = pgTable(
  'ligne_poste',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id, { onDelete: 'cascade' }),
    ordre: integer('ordre').notNull(),
    intitule: text('intitule').notNull(),
    nombre: integer('nombre').notNull(),
    missions: text('missions'),
    competences: text('competences'),
    experience: text('experience'),
    /** Salaire / budget : confidentiel (RG-07 de MVP1-03, ADR 0018). */
    salaire: text('salaire'),
    typeContrat: text('type_contrat'),
    duree: text('duree'),
    horaires: text('horaires'),
    joursRepos: text('jours_repos')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    avantages: text('avantages'),
    datePriseFonction: date('date_prise_fonction'),
    desQuePossible: boolean('des_que_possible').notNull().default(false),
  },
  (t) => [index('ligne_poste_dossier_idx').on(t.dossierId)],
);

/** Historique du dossier (RG-10, RG-11, RG-17), affiché dans l'onglet Historique. */
export const evenementDossier = pgTable(
  'evenement_dossier',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    horodatage: timestamp('horodatage', { withTimezone: true }).notNull().defaultNow(),
    auteurId: text('auteur_id').references(() => user.id),
    type: evenementTypeEnum('type').notNull(),
    deStatut: statutEnum('de_statut'),
    versStatut: statutEnum('vers_statut'),
    commentaire: text('commentaire'),
    avant: jsonb('avant'),
    apres: jsonb('apres'),
  },
  (t) => [index('evenement_dossier_idx').on(t.dossierId, t.horodatage)],
);

export const document = pgTable(
  'document',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    cle: text('cle').notNull().unique(),
    nomOrigine: text('nom_origine').notNull(),
    mime: text('mime').notNull(),
    taille: integer('taille').notNull(),
    categorie: categorieDocumentEnum('categorie').notNull(),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    /** Suppression logique (M1-DOC-05) ; purge physique 30 jours plus tard. */
    supprimeLe: timestamp('supprime_le', { withTimezone: true }),
    supprimePar: text('supprime_par').references(() => user.id),
  },
  (t) => [index('document_dossier_idx').on(t.dossierId)],
);
