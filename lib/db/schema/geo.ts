// Référentiel géographique Ville → Arrondissement → Quartier (ADR 0021, M1-GEO-01).
import { boolean, doublePrecision, index, integer, pgTable, serial, text, unique } from 'drizzle-orm/pg-core';

export const ville = pgTable('ville', {
  id: serial('id').primaryKey(),
  nom: text('nom').notNull().unique(),
  /** Ville où NEXCLEAN intervient (remplace CITIES de lib/constants.ts). */
  couverte: boolean('couverte').notNull().default(false),
  actif: boolean('actif').notNull().default(true),
  ordre: integer('ordre').notNull().default(100),
});

export const arrondissement = pgTable(
  'arrondissement',
  {
    id: serial('id').primaryKey(),
    villeId: integer('ville_id')
      .notNull()
      .references(() => ville.id),
    nom: text('nom').notNull(),
    actif: boolean('actif').notNull().default(true),
  },
  (t) => [unique('arrondissement_ville_nom_uq').on(t.villeId, t.nom)],
);

export const quartier = pgTable(
  'quartier',
  {
    id: serial('id').primaryKey(),
    villeId: integer('ville_id')
      .notNull()
      .references(() => ville.id),
    /** Facultatif : un quartier issu d'une saisie « Autre » peut ne pas encore être rattaché. */
    arrondissementId: integer('arrondissement_id').references(() => arrondissement.id),
    nom: text('nom').notNull(),
    /** Centroïde approximatif, pour le filtre par rayon (ADR 0021 §4). */
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    actif: boolean('actif').notNull().default(true),
  },
  (t) => [unique('quartier_ville_nom_uq').on(t.villeId, t.nom), index('quartier_arrondissement_idx').on(t.arrondissementId)],
);
