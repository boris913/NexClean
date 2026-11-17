// Dépenses (saisie légère, ADR 0020 §1 ; specs/POST-03). Pas de comptabilité : ni partie double ni
// plan comptable. Voir lib/depenses/domaine.ts pour les règles.
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { dossierTypeEnum } from './collaborateurs';
import { dossier } from './dossiers';
import { moyenPaiementEnum } from './encaissements';
import { ville } from './geo';

/** RG-02 : catégories paramétrables par la Direction ; désactivées plutôt que supprimées une fois utilisées. */
export const categorieDepense = pgTable(
  'categorie_depense',
  {
    id: serial('id').primaryKey(),
    libelle: text('libelle').notNull(),
    actif: boolean('actif').notNull().default(true),
    ordre: integer('ordre').notNull().default(100),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('categorie_depense_libelle_uq').on(sql`lower(${t.libelle})`)],
);

/**
 * RG-01 : une dépense payée. Modifiable (journalisé, avant / après) ; jamais supprimée : une erreur
 * se corrige par une **annulation** motivée (RG-06), exclue des indicateurs et de l'export.
 * Le justificatif (photo ou PDF) est stocké hors racine web (ADR 0003) sous la clé `justificatifCle`.
 */
export const depense = pgTable(
  'depense',
  {
    id: serial('id').primaryKey(),
    /** Date de la dépense (fuseau Africa/Douala) : range la dépense dans une période. */
    depenseLe: date('depense_le').notNull(),
    categorieId: integer('categorie_id')
      .notNull()
      .references(() => categorieDepense.id),
    libelle: text('libelle').notNull(),
    /** FCFA, entier > 0 : montant effectivement payé. */
    montant: integer('montant').notNull(),
    moyen: moyenPaiementEnum('moyen').notNull(),
    reference: text('reference'),
    villeId: integer('ville_id').references(() => ville.id),
    dossierId: integer('dossier_id').references(() => dossier.id),
    /** RG-04 : service rattaché (type du Dossier s'il y en a un, sinon choisi). */
    service: dossierTypeEnum('service'),
    commentaire: text('commentaire'),
    justificatifCle: text('justificatif_cle').unique(),
    justificatifNom: text('justificatif_nom'),
    justificatifMime: text('justificatif_mime'),
    justificatifTaille: integer('justificatif_taille'),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
    majParId: text('maj_par_id').references(() => user.id),
    /** RG-06 : annulation (motif obligatoire). */
    annuleeLe: timestamp('annulee_le', { withTimezone: true }),
    annuleeParId: text('annulee_par_id').references(() => user.id),
    motifAnnulation: text('motif_annulation'),
  },
  (t) => [
    index('depense_date_idx').on(t.depenseLe),
    index('depense_categorie_idx').on(t.categorieId),
    index('depense_dossier_idx').on(t.dossierId),
    check('depense_montant_positif', sql`${t.montant} > 0`),
  ],
);
