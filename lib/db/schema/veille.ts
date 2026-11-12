// Veille prospects (specs/COM4-01, ADR 0027) : pistes repérées avant tout contact.
import { bigserial, boolean, index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { STATUTS_PISTE_CODES, TYPES_SOURCE_CODES } from '@/lib/veille/domaine';
import { user } from './auth';
import { dossierTypeEnum } from './collaborateurs';
import { client, dossier } from './dossiers';
import { quartier, ville } from './geo';

export const statutPisteEnum = pgEnum('statut_piste', STATUTS_PISTE_CODES);
export const typeSourceEnum = pgEnum('type_source_veille', TYPES_SOURCE_CODES);

/** RG-04 : référentiel des sources de veille (Direction). */
export const sourceVeille = pgTable('source_veille', {
  id: serial('id').primaryKey(),
  nom: text('nom').notNull(),
  type: typeSourceEnum('type').notNull(),
  /** Adresse du flux (RSS / Atom) ou de la page de la source. */
  url: text('url'),
  /** Requêtes surveillées (« femme de ménage Douala ») : filtre des éléments collectés. */
  requetes: text('requetes').array().notNull().default([]),
  frequenceHeures: integer('frequence_heures').notNull().default(12),
  actif: boolean('actif').notNull().default(true),
  derniereCollecteLe: timestamp('derniere_collecte_le', { withTimezone: true }),
  dernierResultat: text('dernier_resultat'),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
});

/** RG-01 : une Piste. La référence `P-xxxx` découle de l'identifiant. */
export const piste = pgTable(
  'piste',
  {
    id: serial('id').primaryKey(),
    /** saisie_assistee, ou type de la source automatisée (RG-04). */
    source: text('source').notNull(),
    sourceId: integer('source_id').references(() => sourceVeille.id, { onDelete: 'set null' }),
    /** RG-12 : requête de la source qui a produit la piste. */
    requete: text('requete'),
    url: text('url'),
    /** RG-03 : URL normalisée, clé de déduplication. */
    urlNormalisee: text('url_normalisee').unique(),
    extrait: text('extrait').notNull(),
    publieLe: timestamp('publie_le', { withTimezone: true }),
    // Besoin détecté
    type: dossierTypeEnum('type'),
    postes: text('postes').array().notNull().default([]),
    effectif: integer('effectif'),
    besoin: text('besoin'),
    villeId: integer('ville_id').references(() => ville.id),
    quartierId: integer('quartier_id').references(() => quartier.id),
    /** Lieu tel qu'écrit, s'il n'est pas dans le référentiel. */
    lieuTexte: text('lieu_texte'),
    // Contact publié par l'auteur lui-même
    contactNom: text('contact_nom'),
    contactEmail: text('contact_email'),
    contactTelephone: text('contact_telephone'),
    score: integer('score'),
    justification: text('justification'),
    statut: statutPisteEnum('statut').notNull().default('nouvelle'),
    motifEcart: text('motif_ecart'),
    assigneA: text('assigne_a').references(() => user.id),
    /** RG-07 : message d'approche (texte seul ; le lien wa.me est ajouté à l'affichage). */
    message: text('message'),
    versionPrompt: text('version_prompt'),
    dossierId: integer('dossier_id').references(() => dossier.id),
    convertieLe: timestamp('convertie_le', { withTimezone: true }),
    creePar: text('cree_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('piste_statut_idx').on(t.statut, t.score), index('piste_contact_idx').on(t.contactTelephone), index('piste_cree_idx').on(t.creeLe)],
);

/** RG-08, RG-10 : premier contact et relance, toujours faits par un humain sur le canal d'origine. */
export const contactPiste = pgTable(
  'contact_piste',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    pisteId: integer('piste_id')
      .notNull()
      .references(() => piste.id, { onDelete: 'cascade' }),
    /** premier | relance */
    type: text('type').$type<'premier' | 'relance'>().notNull(),
    canal: text('canal').notNull(),
    texte: text('texte').notNull(),
    collaborateurId: text('collaborateur_id')
      .notNull()
      .references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_piste_collab_idx').on(t.collaborateurId, t.creeLe), index('contact_piste_piste_idx').on(t.pisteId)],
);

/** RG-03 : un contact déjà client n'ouvre pas de Piste ; la publication est rattachée au client. */
export const signalementClient = pgTable('signalement_client', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id')
    .notNull()
    .references(() => client.id),
  url: text('url'),
  extrait: text('extrait').notNull(),
  creePar: text('cree_par').references(() => user.id),
  creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
});
