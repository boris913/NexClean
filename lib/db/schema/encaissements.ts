// Encaissements, reçus, annulations, ajustements de trop-perçu, remboursements, crédit client
// (specs/MVP2-05 ; ADR 0004, 0018, 0020). Voir lib/encaissements/domaine.ts pour les règles.
import { date, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { CHOIX_AJUSTEMENT_CODES, MOYEN_CODES, NATURE_CODES, STATUT_DEMANDE_ANNULATION_CODES, STATUT_REMBOURSEMENT_CODES, TYPE_ECRITURE_CODES } from '@/lib/encaissements/domaine';
import { user } from './auth';
import { client, document, dossier } from './dossiers';
import { devis, facture } from './devis';

export const natureEncaissementEnum = pgEnum('nature_encaissement', NATURE_CODES);
export const moyenPaiementEnum = pgEnum('moyen_paiement', MOYEN_CODES);
export const typeEcritureEnum = pgEnum('type_ecriture', TYPE_ECRITURE_CODES);
export const statutRemboursementEnum = pgEnum('statut_remboursement', STATUT_REMBOURSEMENT_CODES);
export const choixAjustementEnum = pgEnum('choix_ajustement', CHOIX_AJUSTEMENT_CODES);
export const statutDemandeAnnulationEnum = pgEnum('statut_demande_annulation', STATUT_DEMANDE_ANNULATION_CODES);

/**
 * Écritures d'encaissement (RG-01, RG-02, RG-11) — **immuables** (déclencheur en base, migration 0013).
 * - `encaissement` : paiement reçu, montant > 0, reçu REÇ-AAAA-NNNNN (RG-04) ;
 * - `annulation` : écriture inverse (montant opposé) liée par `annuleEncaissementId`, motif obligatoire ;
 * - `remboursement` : sortie d'argent effectuée (montant < 0), liée au remboursement validé.
 */
export const encaissement = pgTable(
  'encaissement',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    /** Devis accepté (ou envoyé, RG-06) auquel l'Encaissement se rattache. */
    devisId: integer('devis_id').references(() => devis.id),
    type: typeEcritureEnum('type').notNull().default('encaissement'),
    nature: natureEncaissementEnum('nature').notNull(),
    /** FCFA, signé (voir domaine.ts). */
    montant: integer('montant').notNull(),
    moyen: moyenPaiementEnum('moyen').notNull(),
    reference: text('reference'),
    /** RG-03 : référence normalisée (anti-doublon avec le moyen). */
    referenceNormalisee: text('reference_normalisee'),
    /** Date de réception (ou de sortie pour un remboursement). */
    recuLe: date('recu_le').notNull(),
    /** Justificatif (document de catégorie `justificatif`, interne : jamais montré au client). */
    justificatifDocumentId: integer('justificatif_document_id').references(() => document.id),
    commentaire: text('commentaire'),
    /** Annulation : Encaissement annulé, et motif. */
    annuleEncaissementId: integer('annule_encaissement_id'),
    motif: text('motif'),
    /** Remboursement effectué : remboursement d'origine. */
    remboursementId: integer('remboursement_id'),
    /** RG-04 : numéro du reçu (écritures `encaissement` uniquement). */
    recuNumero: text('recu_numero').unique(),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('encaissement_dossier_idx').on(t.dossierId),
    index('encaissement_reference_idx').on(t.moyen, t.referenceNormalisee),
    uniqueIndex('encaissement_annulation_uq').on(t.annuleEncaissementId),
  ],
);

/** PDF archivé d'un reçu (RG-04), produit après la transaction d'enregistrement. Ajout seul. */
export const recuPdf = pgTable('recu_pdf', {
  encaissementId: integer('encaissement_id')
    .primaryKey()
    .references(() => encaissement.id),
  documentId: integer('document_id')
    .notNull()
    .references(() => document.id),
  empreinte: text('empreinte').notNull(),
});

/** RG-02 : le référent demande l'annulation ; Finances ou Direction l'exécute (ou la refuse). */
export const demandeAnnulation = pgTable(
  'demande_annulation',
  {
    id: serial('id').primaryKey(),
    encaissementId: integer('encaissement_id')
      .notNull()
      .references(() => encaissement.id),
    motif: text('motif').notNull(),
    statut: statutDemandeAnnulationEnum('statut').notNull().default('en_attente'),
    demandeParId: text('demande_par_id').references(() => user.id),
    demandeLe: timestamp('demande_le', { withTimezone: true }).notNull().defaultNow(),
    traiteeParId: text('traitee_par_id').references(() => user.id),
    traiteeLe: timestamp('traitee_le', { withTimezone: true }),
    reponse: text('reponse'),
  },
  (t) => [index('demande_annulation_encaissement_idx').on(t.encaissementId)],
);

/** RG-10 : ajustement d'un trop-perçu, avec le choix du client. */
export const ajustement = pgTable(
  'ajustement',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    /** Montant du trop-perçu régularisé (> 0). */
    montant: integer('montant').notNull(),
    choix: choixAjustementEnum('choix').notNull(),
    /** Avoir émis sur la facture d'acompte (MVP2-04 RG-18), s'il y en a un. */
    avoirId: integer('avoir_id').references(() => facture.id),
    commentaire: text('commentaire'),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ajustement_dossier_idx').on(t.dossierId)],
);

/** RG-11 : remboursement `à valider` → `validé` (Direction) ou `refusé` (motif) → `effectué`. */
export const remboursement = pgTable(
  'remboursement',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    ajustementId: integer('ajustement_id').references(() => ajustement.id),
    montant: integer('montant').notNull(),
    statut: statutRemboursementEnum('statut').notNull().default('a_valider'),
    prepareParId: text('prepare_par_id').references(() => user.id),
    prepareLe: timestamp('prepare_le', { withTimezone: true }).notNull().defaultNow(),
    valideParId: text('valide_par_id').references(() => user.id),
    valideLe: timestamp('valide_le', { withTimezone: true }),
    motifRefus: text('motif_refus'),
    effectueParId: text('effectue_par_id').references(() => user.id),
    effectueLe: timestamp('effectue_le', { withTimezone: true }),
    /** Écriture négative créée à l'exécution. */
    encaissementId: integer('encaissement_id').references(() => encaissement.id),
  },
  (t) => [index('remboursement_dossier_idx').on(t.dossierId), index('remboursement_statut_idx').on(t.statut)],
);

/**
 * RG-12 : mouvements du crédit client (ajout seul). Crédit = montant > 0 (ajustement « crédit ») ;
 * utilisation = montant < 0 (déduction sur un devis / sa facture). Solde = somme des mouvements.
 */
export const mouvementCredit = pgTable(
  'mouvement_credit',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id),
    montant: integer('montant').notNull(),
    libelle: text('libelle').notNull(),
    dossierId: integer('dossier_id').references(() => dossier.id),
    ajustementId: integer('ajustement_id').references(() => ajustement.id),
    devisId: integer('devis_id').references(() => devis.id),
    factureId: integer('facture_id').references(() => facture.id),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mouvement_credit_client_idx').on(t.clientId)],
);
