// Propositions, Placements, accès client aux profils (ADR 0011, 0014, 0015, 0017 ; specs/MVP2-03).
import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { MODES_ACCORD, MODES_CONFIRMATION, STATUT_PLACEMENT_CODES, STATUT_PROPOSITION_CODES, type ModeAccord, type ModeConfirmation } from '@/lib/propositions/domaine';
import { user } from './auth';
import { candidat } from './candidats';
import { client, dossier, lignePoste } from './dossiers';

export const statutPropositionEnum = pgEnum('statut_proposition', STATUT_PROPOSITION_CODES);
export const modeAccordEnum = pgEnum('mode_accord', Object.keys(MODES_ACCORD) as [ModeAccord, ...ModeAccord[]]);
export const statutPlacementEnum = pgEnum('statut_placement', STATUT_PLACEMENT_CODES);
export const modeConfirmationEnum = pgEnum('mode_confirmation', Object.keys(MODES_CONFIRMATION) as [ModeConfirmation, ...ModeConfirmation[]]);
export const retourClientEnum = pgEnum('retour_client', ['rencontrer', 'ne_correspond_pas']);

/**
 * Proposition = Candidat ↔ Ligne de poste d'un Dossier (ADR 0015). `clientId` est figé à la
 * création : l'accord du candidat porte sur ce Client et ce poste (RG-03).
 * Les lignes de poste ne sont jamais supprimées tant qu'elles portent des Propositions
 * (lib/dossiers/service.ts remplacerLignes).
 */
export const proposition = pgTable(
  'proposition',
  {
    id: serial('id').primaryKey(),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    lignePosteId: integer('ligne_poste_id')
      .notNull()
      .references(() => lignePoste.id),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id),
    clientId: integer('client_id')
      .notNull()
      .references(() => client.id),
    statut: statutPropositionEnum('statut').notNull().default('en_attente_accord'),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    majLe: timestamp('maj_le', { withTimezone: true }).notNull().defaultNow(),
    /** MVP2-01 RG-13 : le salaire n'est montré au candidat que si le client l'a autorisé. */
    salaireCommunicable: boolean('salaire_communicable').notNull().default(false),
    // Accord du candidat (RG-03, ADR 0017)
    accordMode: modeAccordEnum('accord_mode'),
    accordLe: timestamp('accord_le', { withTimezone: true }),
    /** Référent qui a enregistré un accord WhatsApp. */
    accordParId: text('accord_par_id').references(() => user.id),
    /** Capture de l'accord WhatsApp (clé de stockage), obligatoire en mode `whatsapp`. */
    accordPreuveCle: text('accord_preuve_cle'),
    accordPreuveMime: text('accord_preuve_mime'),
    accordIp: text('accord_ip'),
    /** Refus du candidat (motif facultatif) ou motif de retrait / de refus saisi par le référent. */
    motif: text('motif'),
    reponseLe: timestamp('reponse_le', { withTimezone: true }),
    /** MVP2-01 RG-14 : signalement « sans réponse sous 72 h » déjà envoyé. */
    relanceAccordLe: timestamp('relance_accord_le', { withTimezone: true }),
    /** RG-08 : le candidat accepte que son numéro soit communiqué au client. */
    numeroCommunicable: boolean('numero_communicable').notNull().default(false),
    // Entretien (RG-12)
    entretienLe: timestamp('entretien_le', { withTimezone: true }),
    entretienLieu: text('entretien_lieu'),
    // Décision (RG-13)
    decisionLe: timestamp('decision_le', { withTimezone: true }),
    // Retour du client sur la page de suivi (RG-11)
    retourClient: retourClientEnum('retour_client'),
    retourClientMotif: text('retour_client_motif'),
    retourClientLe: timestamp('retour_client_le', { withTimezone: true }),
    /** RG-23 : accès client révoqué (clôture, fermeture du Dossier). */
    accesRevoqueLe: timestamp('acces_revoque_le', { withTimezone: true }),
    /** RG-18 : Proposition de remplacement d'un Placement rompu pendant la garantie. */
    remplacePlacementId: integer('remplace_placement_id'),
  },
  (t) => [
    index('proposition_dossier_idx').on(t.dossierId),
    index('proposition_candidat_idx').on(t.candidatId),
    index('proposition_statut_idx').on(t.statut),
    // RG-05 : une seule Proposition active par candidat et par ligne de poste.
    uniqueIndex('proposition_active_uq')
      .on(t.lignePosteId, t.candidatId)
      .where(sql`${t.statut} NOT IN ('refusee', 'refusee_candidat', 'retiree')`),
  ],
);

/** Placement (ADR 0011) : annoncé → confirmé → (rompu pendant garantie | terminé), ou abandonné. */
export const placement = pgTable(
  'placement',
  {
    id: serial('id').primaryKey(),
    propositionId: integer('proposition_id')
      .notNull()
      .references(() => proposition.id),
    dossierId: integer('dossier_id')
      .notNull()
      .references(() => dossier.id),
    lignePosteId: integer('ligne_poste_id')
      .notNull()
      .references(() => lignePoste.id),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id),
    statut: statutPlacementEnum('statut').notNull().default('annonce'),
    /** RG-14 */
    datePrevue: date('date_prevue', { mode: 'string' }).notNull(),
    poste: text('poste').notNull(),
    /** Salaire convenu : confidentiel (ligne_poste.voir_salaire). */
    salaire: text('salaire'),
    /** RG-18 : remplacement d'un placement rompu pendant la garantie, sans commission. */
    remplacement: boolean('remplacement').notNull().default(false),
    remplacePlacementId: integer('remplace_placement_id'),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    // Confirmation (RG-16)
    confirmeLe: timestamp('confirme_le', { withTimezone: true }),
    confirmationMode: modeConfirmationEnum('confirmation_mode'),
    /** Date effective de prise de poste (point de départ de la garantie). */
    datePriseDePoste: date('date_prise_de_poste', { mode: 'string' }),
    signataireNom: text('signataire_nom'),
    signataireFonction: text('signataire_fonction'),
    confirmationIp: text('confirmation_ip'),
    confirmeParId: text('confirme_par_id').references(() => user.id),
    preuveCle: text('preuve_cle'),
    preuveMime: text('preuve_mime'),
    preuveNom: text('preuve_nom'),
    // Fin (RG-18, RG-19) ou abandon (RG-21)
    finLe: date('fin_le', { mode: 'string' }),
    finMotif: text('fin_motif'),
  },
  (t) => [
    index('placement_dossier_idx').on(t.dossierId),
    index('placement_ligne_idx').on(t.lignePosteId),
    index('placement_candidat_idx').on(t.candidatId),
    // Un seul placement non abandonné par Proposition.
    uniqueIndex('placement_proposition_uq').on(t.propositionId).where(sql`${t.statut} <> 'abandonne'`),
  ],
);

/** RG-10 : lien d'accès temporaire à un profil (7 jours, révocable). Seule l'empreinte est stockée. */
export const accesProfil = pgTable(
  'acces_profil',
  {
    id: serial('id').primaryKey(),
    propositionId: integer('proposition_id')
      .notNull()
      .references(() => proposition.id),
    empreinte: text('empreinte').notNull().unique(),
    /** Objet du lien : le profil, ou l'attestation de prise de poste (RG-15). */
    objet: text('objet').notNull().default('profil'),
    expireLe: timestamp('expire_le', { withTimezone: true }).notNull(),
    revoqueLe: timestamp('revoque_le', { withTimezone: true }),
    auteurId: text('auteur_id').references(() => user.id),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('acces_profil_proposition_idx').on(t.propositionId)],
);

/**
 * RG-07 : vérification des 4 derniers chiffres (page de suivi, liens temporaires) — 5 essais
 * puis blocage 30 min. `cle` = « dossier:<id> » ou « acces:<id> ».
 */
export const verificationClient = pgTable('verification_client', {
  cle: text('cle').primaryKey(),
  echecs: integer('echecs').notNull().default(0),
  premierEchecLe: timestamp('premier_echec_le', { withTimezone: true }),
  bloqueJusquA: timestamp('bloque_jusqu_a', { withTimezone: true }),
});

/** Notifications in-app du candidat (RG-17, RG-22), affichées dans son espace. */
export const notificationCandidat = pgTable(
  'notification_candidat',
  {
    id: serial('id').primaryKey(),
    candidatId: integer('candidat_id')
      .notNull()
      .references(() => candidat.id, { onDelete: 'cascade' }),
    titre: text('titre').notNull(),
    texte: text('texte').notNull(),
    lien: text('lien'),
    cle: text('cle'),
    creeLe: timestamp('cree_le', { withTimezone: true }).notNull().defaultNow(),
    luLe: timestamp('lu_le', { withTimezone: true }),
  },
  (t) => [index('notification_candidat_idx').on(t.candidatId, t.luLe), uniqueIndex('notification_candidat_cle_uq').on(t.candidatId, t.cle)],
);
