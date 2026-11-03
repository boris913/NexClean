// Candidat, expériences, documents, consentements, sessions et jetons (ADR 0015, 0016, 0017, 0024 ;
// specs/MVP2-01). Le Candidat est hors modèle Dossier.
import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { STATUT_CANDIDAT_CODES } from '@/lib/candidats/domaine';
import { user } from './auth';
import { arrondissement, quartier, ville } from './geo';

export const statutCandidatEnum = pgEnum('statut_candidat', STATUT_CANDIDAT_CODES);
export const disponibiliteEnum = pgEnum('disponibilite_candidat', ['immediate', 'a_partir_du', 'preavis']);
export const categorieDocumentCandidatEnum = pgEnum('categorie_document_candidat', ['cv', 'justificatif']);
export const typeConsentementEnum = pgEnum('type_consentement', ['traitement', 'contact', 'majorite']);
export const canalConsentementEnum = pgEnum('canal_consentement', ['site', 'assiste']);
export const statutCandidatureEnum = pgEnum('statut_candidature', ['recue', 'retenue', 'refusee']);
export const typeJetonCandidatEnum = pgEnum('type_jeton_candidat', ['reinitialisation', 'activation']);

export const candidat = pgTable(
  'candidat',
  {
    id: serial('id').primaryKey(),
    /** Identifiant de connexion (E.164). Null une fois les données supprimées (RG-17). */
    telephone: text('telephone'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    nom: text('nom').notNull(),
    prenom: text('prenom').notNull(),
    // Localisation (ADR 0021)
    villeId: integer('ville_id').references(() => ville.id),
    villeAutre: text('ville_autre'),
    arrondissementId: integer('arrondissement_id').references(() => arrondissement.id),
    quartierId: integer('quartier_id').references(() => quartier.id),
    quartierAutre: text('quartier_autre'),
    repere: text('repere'),
    zonesTouteVille: boolean('zones_toute_ville').notNull().default(false),
    zonesArrondissementIds: integer('zones_arrondissement_ids').array().notNull().default(sql`'{}'::integer[]`),
    zonesQuartierIds: integer('zones_quartier_ids').array().notNull().default(sql`'{}'::integer[]`),
    // Recherche
    metiers: text('metiers').array().notNull().default(sql`'{}'::text[]`),
    secteurs: text('secteurs').array().notNull().default(sql`'{}'::text[]`),
    typesContrat: text('types_contrat').array().notNull().default(sql`'{}'::text[]`),
    salaireMin: integer('salaire_min'),
    salaireMax: integer('salaire_max'),
    // Parcours
    niveauEtudes: text('niveau_etudes'),
    qualifications: text('qualifications'),
    competences: text('competences').array().notNull().default(sql`'{}'::text[]`),
    // Disponibilité
    disponibilite: disponibiliteEnum('disponibilite'),
    disponibleLe: date('disponible_le'),
    preavis: text('preavis'),
    horaires: text('horaires').array().notNull().default(sql`'{}'::text[]`),
    // Statut (ADR 0015) ; statutAvantIndisponible permet le retour « Je suis toujours en recherche » (RG-10).
    statut: statutCandidatEnum('statut').notNull().default('nouveau'),
    statutAvantIndisponible: statutCandidatEnum('statut_avant_indisponible'),
    /**
     * Référent recrutement (MVP2-02 RG-01). La file « Nouveaux candidats » d'un référent = ses
     * candidats au statut `nouveau` ; null = file « Non attribués » (Direction).
     */
    referentId: text('referent_id').references(() => user.id),
    /** Date d'attribution au référent actuel (alerte « non traités depuis 5 jours ouvrés », RG-03). */
    attribueLe: timestamp('attribue_le', { withTimezone: true }),
    /** Entrée dans la file « Non attribués » (RG-03, comme les Dossiers) ; null si attribué. */
    enFileDepuis: timestamp('en_file_depuis', { withTimezone: true }),
    /** Dernière relance d'escalade envoyée à la Direction (RG-03). */
    derniereRelanceLe: timestamp('derniere_relance_le', { withTimezone: true }),
    /** Dernière alerte « non traité depuis 5 jours ouvrés » envoyée au référent (RG-03). */
    alerteNonTraiteLe: timestamp('alerte_non_traite_le', { withTimezone: true }),
    /** Compte léger créé par une candidature (RG-07) : profil incomplet, à compléter. */
    compteLeger: boolean('compte_leger').notNull().default(false),
    motDePasse: text('mot_de_passe'),
    canalInscription: text('canal_inscription').notNull().default('site'),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    profilMisAJourLe: timestamp('profil_mis_a_jour_le', { withTimezone: true }).notNull().defaultNow(),
    derniereConnexionLe: timestamp('derniere_connexion_le', { withTimezone: true }),
    // Suppression des données (RG-15..18)
    suppressionDemandeeLe: timestamp('suppression_demandee_le', { withTimezone: true }),
    suppressionPrevueLe: timestamp('suppression_prevue_le', { withTimezone: true }),
    /** Données supprimées : il ne reste que le pseudonyme et les liens nécessaires aux statistiques. */
    supprimeLe: timestamp('supprime_le', { withTimezone: true }),
  },
  (t) => [
    // Un téléphone = un compte (RG-04) ; les comptes supprimés n'en ont plus.
    uniqueIndex('candidat_telephone_uq').on(t.telephone),
    index('candidat_statut_idx').on(t.statut),
    index('candidat_referent_idx').on(t.referentId),
    index('candidat_ville_idx').on(t.villeId),
  ],
);

export const candidatExperience = pgTable(
  'candidat_experience',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    ordre: integer('ordre').notNull(),
    poste: text('poste').notNull(),
    employeur: text('employeur'),
    ville: text('ville'),
    duree: text('duree'),
    missions: text('missions'),
  },
  (t) => [index('candidat_experience_candidat_idx').on(t.candidatId)],
);

export const candidatDocument = pgTable(
  'candidat_document',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    categorie: categorieDocumentCandidatEnum('categorie').notNull(),
    cle: text('cle').notNull().unique(),
    nomOrigine: text('nom_origine').notNull(),
    mime: text('mime').notNull(),
    taille: integer('taille').notNull(),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('candidat_document_candidat_idx').on(t.candidatId)],
);

/** Trace des consentements (RG-03) : horodatage, version du texte accepté, canal. */
export const candidatConsentement = pgTable(
  'candidat_consentement',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    type: typeConsentementEnum('type').notNull(),
    version: text('version').notNull(),
    canal: canalConsentementEnum('canal').notNull(),
    ip: text('ip'),
    horodatage: timestamp('horodatage', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('candidat_consentement_candidat_idx').on(t.candidatId)],
);

/** Sessions de l'espace candidat (ADR 0024) : seule l'empreinte du jeton est stockée. */
export const candidatSession = pgTable(
  'candidat_session',
  {
    empreinte: text('empreinte').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    expireLe: timestamp('expire_le', { withTimezone: true }).notNull(),
    ip: text('ip'),
  },
  (t) => [index('candidat_session_candidat_idx').on(t.candidatId)],
);

/** Jetons à usage unique : réinitialisation (30 min), activation d'un compte créé par un référent. */
export const candidatJeton = pgTable(
  'candidat_jeton',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    type: typeJetonCandidatEnum('type').notNull(),
    empreinte: text('empreinte').notNull().unique(),
    expireLe: timestamp('expire_le', { withTimezone: true }).notNull(),
    utiliseLe: timestamp('utilise_le', { withTimezone: true }),
    /** Référent qui a généré le lien (réinitialisation assistée) ; null si envoyé par e-mail. */
    creePar: text('cree_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('candidat_jeton_candidat_idx').on(t.candidatId)],
);

/** Demande de réinitialisation assistée (RG-07) : tâche chez le référent, ou en file. */
export const candidatDemandeReinitialisation = pgTable(
  'candidat_demande_reinitialisation',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    traiteeLe: timestamp('traitee_le', { withTimezone: true }),
    traiteePar: text('traitee_par').references(() => user.id),
  },
  (t) => [index('candidat_demande_reinit_candidat_idx').on(t.candidatId)],
);

/**
 * Candidature à une offre (MVP2-02 RG-07..12). En MVP-2 les offres restent dans
 * `content/jobs-data.ts` : l'offre est référencée par son slug et son titre au moment de la
 * candidature (RG-08) ; le lien vers l'entité Offre viendra avec la migration (ADR 0013).
 */
export const candidature = pgTable(
  'candidature',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    offreSlug: text('offre_slug').notNull(),
    offreTitre: text('offre_titre').notNull(),
    motivation: text('motivation'),
    statut: statutCandidatureEnum('statut').notNull().default('recue'),
    /** Référent qui suit l'offre (RG-10) ; null = file « Non attribués ». */
    referentId: text('referent_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    traiteeLe: timestamp('traitee_le', { withTimezone: true }),
    traiteePar: text('traitee_par').references(() => user.id),
  },
  (t) => [
    // RG-12 : une seule candidature par candidat et par offre.
    uniqueIndex('candidature_candidat_offre_uq').on(t.candidatId, t.offreSlug),
    index('candidature_offre_idx').on(t.offreSlug),
    index('candidature_referent_idx').on(t.referentId),
  ],
);

/**
 * Responsables d'une offre (RG-10) : le référent qui suit l'offre, ou les collaborateurs désignés
 * par la Direction pour une offre de recrutement interne. Sans responsable : attribution par ville.
 */
export const offreResponsable = pgTable(
  'offre_responsable',
  {
    offreSlug: text('offre_slug').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.offreSlug, t.userId] })],
);
