// Offres publiées (ADR 0013) : annonce publique, distincte de la Ligne de poste, administrable
// depuis le Back-Office. Remplace `content/jobs-data.ts`. Les Candidatures et les responsables
// d'offre restent rattachés par le slug (stable : non modifiable après la première publication).
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { ORIGINES_OFFRE_CODES, STATUTS_OFFRE_CODES, type Salaire } from '@/lib/offres/domaine';
import { user } from './auth';
import { lignePoste } from './dossiers';

export const statutOffreEnum = pgEnum('statut_offre', STATUTS_OFFRE_CODES);
export const origineOffreEnum = pgEnum('origine_offre', ORIGINES_OFFRE_CODES);

export const offre = pgTable(
  'offre',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    titre: text('titre').notNull(),
    categorie: text('categorie').notNull(),
    statut: statutOffreEnum('statut').notNull().default('brouillon'),
    origine: origineOffreEnum('origine').notNull().default('interne'),
    /** Ligne de poste d'origine (placement) : fermeture automatique quand elle est pourvue. */
    lignePosteId: integer('ligne_poste_id').references(() => lignePoste.id, { onDelete: 'set null' }),
    lieu: text('lieu').notNull(),
    contrat: text('contrat').notNull(),
    secteur: text('secteur'),
    postes: integer('postes').notNull().default(1),
    /** Résumé affiché sur la carte de /recrutement. */
    description: text('description').notNull(),
    exigences: text('exigences').array().notNull().default(sql`'{}'::text[]`),
    intro: text('intro'),
    missions: text('missions').array().notNull().default(sql`'{}'::text[]`),
    profil: text('profil').array().notNull().default(sql`'{}'::text[]`),
    horaires: text('horaires').array().notNull().default(sql`'{}'::text[]`),
    salaire: jsonb('salaire').$type<Salaire>(),
    /** ADR 0013 §4 : accord du Client pour publier le salaire (offres de placement). */
    accordSalaireClient: boolean('accord_salaire_client').notNull().default(false),
    /** Date réelle de première publication (JSON-LD JobPosting). */
    publieeLe: date('publiee_le'),
    valableJusquau: date('valable_jusquau'),
    fermeeLe: timestamp('fermee_le', { withTimezone: true }),
    motifFermeture: text('motif_fermeture'),
    /** Ordre d'affichage parmi les offres de même statut (plus petit = en premier). */
    ordre: integer('ordre').notNull().default(0),
    creePar: text('cree_par').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('offre_slug_uq').on(t.slug), index('offre_statut_idx').on(t.statut), index('offre_ligne_idx').on(t.lignePosteId)],
);
