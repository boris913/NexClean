// Devis, avenants, factures, séquences de numérotation, historique des paramètres
// (ADR 0008, 0009, 0010, 0020 ; specs/MVP2-04).
import { bigserial, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { MODES_ACCEPTATION, STATUT_DEVIS_CODES, TYPES_DEVIS, TYPES_FACTURE, type LigneDevis, type ModeAcceptation, type TypeDevis, type TypeFacture } from '@/lib/devis/domaine';
import { user } from './auth';
import { client, document, dossier } from './dossiers';

export const statutDevisEnum = pgEnum('statut_devis', STATUT_DEVIS_CODES);
export const typeDevisEnum = pgEnum('type_devis', Object.keys(TYPES_DEVIS) as [TypeDevis, ...TypeDevis[]]);
export const modeAcceptationEnum = pgEnum('mode_acceptation', Object.keys(MODES_ACCEPTATION) as [ModeAcceptation, ...ModeAcceptation[]]);
export const typeFactureEnum = pgEnum('type_facture', Object.keys(TYPES_FACTURE) as [TypeFacture, ...TypeFacture[]]);

/** Séquences annuelles des documents (DEV, FAC, REÇ). Incrément dans la transaction d'émission : sans trou (RG-17). */
export const sequenceDocument = pgTable(
  'sequence_document',
  {
    sequence: text('sequence').notNull(),
    annee: integer('annee').notNull(),
    dernier: integer('dernier').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sequence, t.annee] })],
);

/**
 * Devis et avenants (RG-04..09). Une chaîne de versions partage `numero` (DEV-AAAA-NNNNN) ;
 * `version` 1, 2… ; une nouvelle version fait passer la précédente à `remplace`.
 * Un avenant (`type = 'avenant'`) porte sur un devis accepté (`devisInitialId`) et a son propre numéro.
 * Toutes les valeurs tarifaires sont figées à la création (RG-02).
 */
export const devis = pgTable(
  'devis',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id),
    type: typeDevisEnum('type').notNull().default('devis'),
    numero: text('numero').notNull(),
    version: integer('version').notNull().default(1),
    /** Avenant : devis accepté qu'il modifie. */
    devisInitialId: integer('devis_initial_id'),
    statut: statutDevisEnum('statut').notNull().default('brouillon'),
    // Valeurs figées (RG-02)
    lignes: jsonb('lignes').$type<LigneDevis[]>().notNull(),
    tauxTva: integer('taux_tva').notNull(),
    totalHt: integer('total_ht').notNull(),
    montantTva: integer('montant_tva').notNull(),
    totalTtc: integer('total_ttc').notNull(),
    tauxAcompte: integer('taux_acompte').notNull(),
    justificationTaux: text('justification_taux'),
    acompte: integer('acompte').notNull(),
    delaiRechercheJours: integer('delai_recherche_jours').notNull(),
    garantieJours: integer('garantie_jours').notNull(),
    validiteJours: integer('validite_jours').notNull(),
    conditions: text('conditions').notNull(),
    conditionsParticulieres: text('conditions_particulieres'),
    mentionsLegales: text('mentions_legales').notNull(),
    /** Avenant : prolongation du délai de recherche, en jours. */
    prolongationJours: integer('prolongation_jours'),
    /** MVP2-05 RG-12 : déduction du crédit client conservée sur ce devis (FCFA TTC, figée), reportée sur la facture d'acompte. */
    deductionCredit: integer('deduction_credit').notNull().default(0),
    // Cycle
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
    /** RG-06 : taux hors bornes validé par la Direction. */
    valideDirectionParId: text('valide_direction_par_id').references(() => user.id),
    valideDirectionLe: timestamp('valide_direction_le', { withTimezone: true }),
    valideParId: text('valide_par_id').references(() => user.id),
    valideLe: timestamp('valide_le', { withTimezone: true }),
    envoyeLe: timestamp('envoye_le', { withTimezone: true }),
    expireLe: timestamp('expire_le', { withTimezone: true }),
    /** PDF définitif archivé (RG-10) et son empreinte SHA-256 (preuve de la version acceptée, RG-13). */
    documentId: integer('document_id').references(() => document.id),
    pdfEmpreinte: text('pdf_empreinte'),
    // Acceptation (RG-13, RG-15)
    acceptationMode: modeAcceptationEnum('acceptation_mode'),
    accepteLe: timestamp('accepte_le', { withTimezone: true }),
    signataireNom: text('signataire_nom'),
    signataireFonction: text('signataire_fonction'),
    acceptationIp: text('acceptation_ip'),
    acceptationNavigateur: text('acceptation_navigateur'),
    acceptationPreuveCle: text('acceptation_preuve_cle'),
    acceptationPreuveMime: text('acceptation_preuve_mime'),
    acceptationParId: text('acceptation_par_id').references(() => user.id),
    // Refus (RG-14)
    refusLe: timestamp('refus_le', { withTimezone: true }),
    refusMotif: text('refus_motif'),
  },
  (t) => [
    index('devis_dossier_idx').on(t.dossierId),
    index('devis_statut_idx').on(t.statut),
    uniqueIndex('devis_numero_version_uq').on(t.numero, t.version),
  ],
);

/**
 * Factures et avoirs (RG-16..18, ADR 0020) : numéro FAC-AAAA-NNNNN continu, sans trou ;
 * **immuables** après émission (déclencheur en base, migration 0011). Toutes les données
 * imprimées sont figées dans la ligne (client, lignes, mentions).
 */
export const facture = pgTable(
  'facture',
  {
    id: serial('id').primaryKey(),
    numero: text('numero').notNull().unique(),
    type: typeFactureEnum('type').notNull(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    devisId: integer('devis_id').references(() => devis.id),
    /** Avoir : facture corrigée ou régularisée. */
    factureOrigineId: integer('facture_origine_id'),
    libelle: text('libelle').notNull(),
    lignes: jsonb('lignes').$type<{ libelle: string; quantite: number; prixUnitaire: number; montantHt: number }[]>().notNull(),
    tauxTva: integer('taux_tva').notNull(),
    totalHt: integer('total_ht').notNull(),
    montantTva: integer('montant_tva').notNull(),
    totalTtc: integer('total_ttc').notNull(),
    client: jsonb('client').$type<{ nom: string; contact: string | null; whatsapp: string; email: string | null; ville: string | null }>().notNull(),
    mentionsLegales: text('mentions_legales').notNull(),
    emiseLe: timestamp('emise_le', { withTimezone: true }).notNull().defaultNow(),
    auteurId: text('auteur_id').references(() => user.id),
  },
  (t) => [index('facture_dossier_idx').on(t.dossierId)],
);

/**
 * PDF archivé d'une facture (RG-19). Table séparée car `facture` est immuable : le PDF est
 * généré après l'émission (hors transaction) et rattaché ici.
 */
export const facturePdf = pgTable('facture_pdf', {
  factureId: integer('facture_id')
    .primaryKey()
    .references(() => facture.id),
  documentId: integer('document_id')
    .notNull()
    .references(() => document.id),
  empreinte: text('empreinte').notNull(),
});

/** RG-01 : historique des paramètres (valeur, date d'effet, auteur). */
export const parametreHistorique = pgTable(
  'parametre_historique',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cle: text('cle').notNull(),
    valeur: jsonb('valeur').notNull(),
    effetLe: timestamp('effet_le', { withTimezone: true }).notNull().defaultNow(),
    auteurId: text('auteur_id').references(() => user.id),
  },
  (t) => [index('parametre_historique_cle_idx').on(t.cle, t.effetLe)],
);
