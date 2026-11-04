// Service Back-Office des Propositions, Placements et de la clôture de la recherche
// (specs/MVP2-03, côté référent ; ADR 0010, 0011, 0015, 0017). Indépendant de Next.js : utilisé par
// les actions serveur, les routes de lecture des preuves, les tâches planifiées et les tests.
// Droits : référent du Dossier ou Direction (`peutTraiter`) ; pour proposer un candidat, accès au
// vivier en plus (`peutAccederVivier`). Les effets partagés avec l'espace candidat et la page de
// suivi (accord, confirmation) sont dans ./effets.ts.
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, notInArray, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, peutVoir, peutVoirSalaire, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { estFinal, STATUTS } from '@/lib/dossiers/statuts';
import { dateLocale } from '@/lib/dossiers/heures-ouvrees';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { lireParametre } from '@/lib/parametres';
import { declencherEnvoi, notifier } from '@/lib/notifications';
import { peutAccederVivier } from '@/lib/candidats/acces';
import { deriverStatutCandidat } from '@/lib/candidats/attribution';
import { pseudonyme } from '@/lib/candidats/domaine';
import { contexteCandidat } from '@/lib/candidats/fiche';
import { ACCENTS, SANS_ACCENTS, echapperLike, motsRecherche } from '@/lib/candidats/recherche';
import { contexteDossier } from '@/lib/modeles/service';
import { estModeleCandidat, estModeleProposition, rendreMessage, variablesDe, type ContexteMessage, type Variable } from '@/lib/modeles/variables';
import {
  compterPlacementsRetenus,
  compterPlacesLigne,
  dansLaGarantie,
  echeanceRecherche,
  alerteEcheanceDue,
  estTransmise,
  MESSAGE_STATUT_DOSSIER_PROPOSITION,
  nomAffichable,
  STATUTS_DOSSIER_PROPOSITION,
  STATUTS_EN_COURS,
  STATUTS_PLACEMENT,
  STATUTS_PROPOSITION,
  STATUTS_PROPOSITION_INACTIFS,
  DELAI_REPONSE_CANDIDAT_HEURES,
  VALIDITE_LIEN_PROFIL_JOURS,
  verifierCloture,
  verifierTransitionProposition,
  type StatutProposition,
  type VerdictCloture,
} from './domaine';
import { chargerProposition, confirmerPlacement, enregistrerAccord, evenementDossier, lienPropositionsDossier, notifierCandidat, type AuteurEffet, type Tx } from './effets';
import { cheminAcces, empreinteJeton, genererJetonAcces } from './jetons';
import { revoquerAccesNonPlaces, revoquerLiensProposition } from './revocation';

type Db = ReturnType<typeof getDb>;
type Lecteur = Pick<Db, 'select'>;

export interface ActeurProposition extends Demandeur {
  ip?: string | null;
}

export interface Fichier {
  nom: string;
  octets: Uint8Array;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

export const MESSAGE_VIVIER = 'Accès réservé aux référents recrutement et à la Direction.';
export const MESSAGE_DEJA_PROPOSE = 'Ce candidat a déjà une proposition en cours pour ce poste.';
const MESSAGE_PLACEMENT_EN_COURS = 'Un placement est déjà enregistré pour cette proposition.';

/** Lien vers l'onglet Propositions d'un Dossier (Back-Office). */
export const lienOngletPropositions = (dossierId: number) => `/admin/dossiers/${dossierId}?onglet=propositions#propositions`;

/** Lecture d'une preuve (capture d'accord, preuve de placement) depuis le Back-Office. */
export const lienPreuveAccord = (dossierId: number, propositionId: number) => `/admin/dossiers/${dossierId}/propositions/${propositionId}/preuve`;
export const lienPreuvePlacement = (dossierId: number, placementId: number) => `/admin/dossiers/${dossierId}/placements/${placementId}/preuve`;
/** Attestation de prise de poste (PDF, route du lot B, RG-15). */
export const lienAttestation = (dossierId: number, placementId: number) => `/admin/dossiers/${dossierId}/placements/${placementId}/attestation`;

// ─── Utilitaires ──────────────────────────────────────────────

const auteurDe = (a: ActeurProposition): AuteurEffet => ({ type: 'collaborateur', id: a.id, ip: a.ip ?? null });
const audit = (a: ActeurProposition) => ({ acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null });

/** Code SQLSTATE d'une erreur PostgreSQL (éventuellement enveloppée par Drizzle). */
function codeErreur(e: unknown): string | undefined {
  const x = e as { code?: unknown; cause?: { code?: unknown } } | null;
  const c = x?.code ?? x?.cause?.code;
  return typeof c === 'string' ? c : undefined;
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date AAAA-MM-JJ valide. */
function lireDate(v: string | null | undefined, libelle: string): string {
  const s = (v ?? '').trim();
  if (!RE_DATE.test(s) || Number.isNaN(Date.parse(s))) throw new ErreurMetier(`${libelle} : date invalide.`);
  return s;
}

/** Date du jour au fuseau de Douala (AAAA-MM-JJ). */
const aujourdhui = (maintenant = new Date()) => dateLocale(maintenant);

/** « AAAA-MM-JJTHH:MM » (champ datetime-local, heure de Douala) ou « AAAA-MM-JJ » → instant. */
function lireDateHeure(v: string | null | undefined): Date | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(s);
  const d = m ? new Date(`${m[1]}T${m[2] ?? '00:00'}:00+01:00`) : null;
  if (!d || Number.isNaN(d.getTime())) throw new ErreurMetier('Date de l’entretien invalide.');
  return d;
}

const texteCourt = (v: string | null | undefined, max: number) => {
  const s = (v ?? '').trim();
  if (s.length > max) throw new ErreurMetier(`Texte trop long (${max} caractères maximum).`);
  return s || null;
};

/** Horodatage lisible (Douala). */
export const formaterDateHeure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'full', timeStyle: 'short' }).format(d);
export const formaterJour = (jour: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(`${jour}T00:00:00Z`));

/** Preuve (capture d'accord, attestation signée…) : image ou PDF, contrôlée par signature binaire. */
function validerPreuve(f: Fichier | null | undefined, manquante: string) {
  if (!f || f.octets.byteLength === 0) throw new ErreurMetier(manquante);
  const v = validerFichier(f.nom, f.octets);
  if (!v.ok) throw new ErreurMetier(v.erreur);
  if (v.type === 'docx') throw new ErreurMetier('La preuve doit être une image (photo, capture d’écran) ou un PDF.');
  return { extension: v.type === 'jpeg' ? 'jpg' : v.type, mime: v.mime, nom: f.nom.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150) };
}

/** Dépose la preuve, exécute `fn` ; en cas d'échec le fichier est supprimé (pas d'orphelin). */
async function avecPreuve<T>(f: Fichier, prefixe: string, manquante: string, fn: (p: { cle: string; mime: string; nom: string }) => Promise<T>): Promise<T> {
  const v = validerPreuve(f, manquante);
  const cle = nouvelleCle(prefixe, v.extension);
  await getStockage().deposer(cle, f.octets);
  try {
    return await fn({ cle, mime: v.mime, nom: v.nom });
  } catch (e) {
    await getStockage().supprimer(cle);
    throw e;
  }
}

/** Dossier verrouillé ; référent du Dossier ou Direction ; dossier de recrutement. */
async function verrouillerDossier(tx: Tx, dossierId: number, a: ActeurProposition) {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
  if (d.type !== 'REC') throw new ErreurMetier('Les propositions ne concernent que les dossiers de recrutement.');
  return d;
}

/** Verrouille le Dossier puis la Proposition (ordre stable : Dossier → Proposition). */
async function propositionPourReferent(tx: Tx, propositionId: number, a: ActeurProposition) {
  const [x] = await tx.select({ dossierId: schema.proposition.dossierId }).from(schema.proposition).where(eq(schema.proposition.id, propositionId));
  if (!x) throw new ErreurMetier('Proposition introuvable.');
  const d = await verrouillerDossier(tx, x.dossierId, a);
  const p = await chargerProposition(tx, propositionId);
  return { d, p };
}

/** Verrouille le Dossier puis le Placement. */
async function placementPourReferent(tx: Tx, placementId: number, a: ActeurProposition) {
  const [x] = await tx.select({ dossierId: schema.placement.dossierId }).from(schema.placement).where(eq(schema.placement.id, placementId));
  if (!x) throw new ErreurMetier('Placement introuvable.');
  const d = await verrouillerDossier(tx, x.dossierId, a);
  const [pl] = await tx.select().from(schema.placement).where(eq(schema.placement.id, placementId)).for('update');
  const p = await chargerProposition(tx, pl!.propositionId);
  return { d, pl: pl!, p };
}

/** Contrôle des droits avant d'écrire un fichier sur le disque. */
async function verifierDroitsAvantDepot(table: 'proposition' | 'placement', id: number, a: ActeurProposition) {
  const t = table === 'proposition' ? schema.proposition : schema.placement;
  const [r] = await getDb()
    .select({ referentId: schema.dossier.referentId })
    .from(t)
    .innerJoin(schema.dossier, eq(schema.dossier.id, t.dossierId))
    .where(eq(t.id, id));
  if (!r) throw new ErreurMetier(table === 'proposition' ? 'Proposition introuvable.' : 'Placement introuvable.');
  if (!peutTraiter(a, r.referentId)) throw new ErreurAccesDossier();
}

// ─── Création (RG-02, RG-05) ──────────────────────────────────

export interface EntreeProposition {
  dossierId: number;
  lignePosteId: number;
  candidatId: number;
  /** MVP2-01 RG-13 : le salaire de la ligne est montré au candidat. */
  salaireCommunicable?: boolean;
  /** RG-18 : remplacement d'un Placement rompu pendant la garantie (même ligne). */
  remplacePlacementId?: number | null;
}

export interface ResultatProposition {
  propositionId: number;
  /** RG-05 : propositions actives chez d'autres Clients, candidat déjà placé. */
  avertissements: string[];
}

type DossierVerrouille = Awaited<ReturnType<typeof verrouillerDossier>>;

async function insererProposition(tx: Tx, d: DossierVerrouille, e: EntreeProposition, a: ActeurProposition): Promise<ResultatProposition> {
  if (e.remplacePlacementId) {
    const [pl] = await tx
      .select({ id: schema.placement.id, statut: schema.placement.statut, lignePosteId: schema.placement.lignePosteId })
      .from(schema.placement)
      .where(and(eq(schema.placement.id, e.remplacePlacementId), eq(schema.placement.dossierId, d.id)));
    if (!pl || pl.statut !== 'rompu_garantie') throw new ErreurMetier('Le placement à remplacer doit être « rompu pendant la garantie ».');
    if (pl.lignePosteId !== e.lignePosteId) throw new ErreurMetier('Le remplaçant est proposé sur le même poste que le placement rompu.');
    const [deja] = await tx
      .select({ id: schema.placement.id })
      .from(schema.placement)
      .where(and(eq(schema.placement.remplacePlacementId, pl.id), ne(schema.placement.statut, 'abandonne')));
    if (deja) throw new ErreurMetier('Ce placement a déjà un remplaçant.');
    // La garantie court au-delà de la clôture de la recherche : remplacement possible tant que le Dossier n'est pas fermé.
    if (estFinal(d.statut)) throw new ErreurMetier('Le dossier est fermé.');
  } else if (!(STATUTS_DOSSIER_PROPOSITION as readonly string[]).includes(d.statut)) {
    throw new ErreurMetier(`${MESSAGE_STATUT_DOSSIER_PROPOSITION} (statut actuel : ${STATUTS[d.statut]})`);
  }

  const [l] = await tx
    .select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule })
    .from(schema.lignePoste)
    .where(and(eq(schema.lignePoste.id, e.lignePosteId), eq(schema.lignePoste.dossierId, d.id)));
  if (!l) throw new ErreurMetier('Poste introuvable dans ce dossier.');

  const [c] = await tx
    .select({ id: schema.candidat.id, prenom: schema.candidat.prenom, nom: schema.candidat.nom, statut: schema.candidat.statut, supprimeLe: schema.candidat.supprimeLe, suppressionDemandeeLe: schema.candidat.suppressionDemandeeLe })
    .from(schema.candidat)
    .where(eq(schema.candidat.id, e.candidatId))
    .for('update');
  if (!c || c.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
  if (c.suppressionDemandeeLe) throw new ErreurMetier('La suppression des données de ce candidat est en cours.');
  if (c.statut === 'indisponible') throw new ErreurMetier('Ce candidat est indisponible : il ne peut pas être proposé.');

  const actives = await tx
    .select({ lignePosteId: schema.proposition.lignePosteId, clientId: schema.proposition.clientId, client: schema.client.nom })
    .from(schema.proposition)
    .innerJoin(schema.client, eq(schema.client.id, schema.proposition.clientId))
    .where(and(eq(schema.proposition.candidatId, c.id), notInArray(schema.proposition.statut, [...STATUTS_PROPOSITION_INACTIFS])));
  if (actives.some((x) => x.lignePosteId === l.id)) throw new ErreurMetier(MESSAGE_DEJA_PROPOSE);

  const avertissements: string[] = [];
  const autres = [...new Set(actives.filter((x) => x.clientId !== d.clientId).map((x) => x.client))];
  if (autres.length) avertissements.push(`Ce candidat a déjà des propositions en cours chez d’autres clients : ${autres.join(', ')}.`);
  if (c.statut === 'place') avertissements.push('Ce candidat est déjà placé.');

  const [p] = await tx
    .insert(schema.proposition)
    .values({
      dossierId: d.id,
      lignePosteId: l.id,
      candidatId: c.id,
      // L'accord du candidat porte sur ce Client (RG-03) : figé à la création.
      clientId: d.clientId,
      auteurId: a.id,
      salaireCommunicable: !!e.salaireCommunicable,
      remplacePlacementId: e.remplacePlacementId ?? null,
    })
    .returning({ id: schema.proposition.id });
  const propositionId = p!.id;
  const [cl] = await tx.select({ nom: schema.client.nom }).from(schema.client).where(eq(schema.client.id, d.clientId));
  const libelle = `${nomAffichable(c.prenom, c.nom)} — ${l.intitule}`;
  await evenementDossier(tx, d.id, 'proposition', `${libelle} : candidat proposé${e.remplacePlacementId ? ' en remplacement (garantie)' : ''}, en attente de son accord`, auteurDe(a), {
    propositionId,
    statut: 'en_attente_accord',
    remplacePlacementId: e.remplacePlacementId ?? null,
  });
  await journaliser(
    {
      ...audit(a),
      action: 'proposition.creee',
      objetType: 'proposition',
      objetId: propositionId,
      apres: { statut: 'en_attente_accord' },
      details: { dossierId: d.id, lignePosteId: l.id, candidatId: c.id, remplacePlacementId: e.remplacePlacementId ?? null, avertissements: avertissements.length ? avertissements : undefined },
    },
    tx,
  );
  // MVP2-01 RG-13 : la Proposition attend la réponse du candidat dans son espace.
  await notifierCandidat(tx, c.id, {
    titre: 'Nouvelle proposition de poste',
    texte: `NEXCLEAN souhaite présenter votre profil pour le poste « ${l.intitule} » chez ${cl?.nom ?? 'un client'}. Acceptez ou refusez dans votre espace.`,
    lien: '/candidat/espace',
    cle: `proposition:${propositionId}`,
  });
  return { propositionId, avertissements };
}

/**
 * RG-02, RG-05 : proposer un candidat sur une ligne de poste. Dossier « Recherche en cours » ou
 * « Candidats proposés » ; candidat visible au vivier, ni supprimé ni indisponible ; une seule
 * Proposition active par ligne (index unique en base) ; avertissements renvoyés.
 */
export async function creerProposition(e: EntreeProposition, a: ActeurProposition): Promise<ResultatProposition> {
  if (!(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier(MESSAGE_VIVIER);
  try {
    return await getDb().transaction(async (tx) => insererProposition(tx, await verrouillerDossier(tx, e.dossierId, a), e, a));
  } catch (err) {
    if (codeErreur(err) === '23505') throw new ErreurMetier(MESSAGE_DEJA_PROPOSE);
    throw err;
  }
}

// ─── Accord recueilli par WhatsApp (RG-03) ────────────────────

export interface AccordWhatsApp {
  /** Capture de l'accord (image ou PDF), obligatoire. */
  fichier: Fichier | null;
  /** Date de l'accord (AAAA-MM-JJ), saisie par le référent. */
  date: string;
  /** RG-08 : le candidat accepte que son numéro soit communiqué au client. */
  numeroCommunicable: boolean;
}

export async function enregistrerAccordWhatsApp(propositionId: number, accord: AccordWhatsApp, a: ActeurProposition, maintenant = new Date()): Promise<void> {
  const MANQUE = 'Joignez la capture de l’accord WhatsApp.';
  if (!accord.fichier || accord.fichier.octets.byteLength === 0) throw new ErreurMetier(MANQUE);
  const jour = lireDate(accord.date, 'Date de l’accord');
  if (jour > aujourdhui(maintenant)) throw new ErreurMetier('La date de l’accord ne peut pas être dans le futur.');
  await verifierDroitsAvantDepot('proposition', propositionId, a);
  await avecPreuve(accord.fichier, 'accords', MANQUE, (f) =>
    getDb().transaction(async (tx) => {
      await propositionPourReferent(tx, propositionId, a);
      await enregistrerAccord(
        tx,
        propositionId,
        { mode: 'whatsapp', le: new Date(`${jour}T12:00:00+01:00`), parId: a.id, preuveCle: f.cle, preuveMime: f.mime, ip: a.ip ?? null, numeroCommunicable: accord.numeroCommunicable },
        auteurDe(a),
      );
    }),
  );
}

// ─── Statut de la Proposition (RG-01, RG-04, RG-12, RG-13) ────

export interface OptionsStatut {
  /** Obligatoire pour un refus ou un retrait (RG-13). */
  motif?: string | null;
  /** RG-12 : date / heure (datetime-local, heure de Douala) et lieu de l'entretien, facultatifs. */
  entretienLe?: string | null;
  entretienLieu?: string | null;
}

export async function changerStatutProposition(propositionId: number, vers: StatutProposition, o: OptionsStatut, a: ActeurProposition): Promise<void> {
  if (!(vers in STATUTS_PROPOSITION)) throw new ErreurMetier('Statut inconnu.');
  const motif = texteCourt(o.motif, 500);
  const entretienLe = vers === 'entretien' ? lireDateHeure(o.entretienLe) : null;
  const entretienLieu = vers === 'entretien' ? texteCourt(o.entretienLieu, 200) : null;
  await getDb().transaction(async (tx) => {
    const { p } = await propositionPourReferent(tx, propositionId, a);
    const verdict = verifierTransitionProposition(p.statut, vers, motif);
    if (!verdict.ok) throw new ErreurMetier(verdict.erreur);
    const maintenant = new Date();
    await tx
      .update(schema.proposition)
      .set({
        statut: vers,
        majLe: maintenant,
        ...(vers === 'entretien' ? { entretienLe, entretienLieu } : {}),
        ...(vers === 'retenue' || vers === 'refusee' ? { decisionLe: maintenant } : {}),
        ...(vers === 'refusee' || vers === 'retiree' || (vers === 'retenue' && motif) ? { motif } : {}),
      })
      .where(eq(schema.proposition.id, propositionId));
    if (vers === 'entretien') await deriverStatutCandidat(tx, p.candidatId, 'entretien', `proposition:${propositionId}`);
    if (vers === 'retiree') {
      // Le profil retiré n'est plus accessible au client.
      await tx.update(schema.proposition).set({ accesRevoqueLe: maintenant }).where(and(eq(schema.proposition.id, propositionId), isNull(schema.proposition.accesRevoqueLe)));
      await revoquerLiensProposition(tx, propositionId, maintenant);
    }
    const detail =
      vers === 'entretien'
        ? [entretienLe ? formaterDateHeure(entretienLe) : null, entretienLieu].filter(Boolean).join(', ')
        : motif ?? '';
    await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : ${STATUTS_PROPOSITION[p.statut]} → ${STATUTS_PROPOSITION[vers]}${detail ? ` (${detail})` : ''}`, auteurDe(a), { propositionId, statut: vers });
    await journaliser({ ...audit(a), action: 'proposition.statut', objetType: 'proposition', objetId: propositionId, avant: { statut: p.statut }, apres: { statut: vers }, details: motif || entretienLe ? { motif: motif ?? undefined, entretienLe: entretienLe?.toISOString(), entretienLieu: entretienLieu ?? undefined } : undefined }, tx);
    if (vers === 'entretien') {
      await notifierCandidat(tx, p.candidatId, {
        titre: 'Entretien',
        texte: `${p.client} souhaite vous rencontrer pour le poste « ${p.intitule} »${detail ? ` : ${detail}` : ''}. Votre référent vous contacte pour confirmer.`,
        lien: '/candidat/espace',
        cle: `proposition_entretien:${propositionId}:${entretienLe?.toISOString() ?? ''}`,
      });
    }
    if (vers === 'retiree') {
      await notifierCandidat(tx, p.candidatId, { titre: 'Proposition retirée', texte: `La proposition pour le poste « ${p.intitule} » chez ${p.client} est retirée.`, lien: '/candidat/espace', cle: `proposition_retiree:${propositionId}` });
    }
  });
}

/** RG-12 : modifier la date / le lieu d'un entretien déjà prévu. */
export async function modifierEntretien(propositionId: number, o: Pick<OptionsStatut, 'entretienLe' | 'entretienLieu'>, a: ActeurProposition): Promise<void> {
  const entretienLe = lireDateHeure(o.entretienLe);
  const entretienLieu = texteCourt(o.entretienLieu, 200);
  await getDb().transaction(async (tx) => {
    const { p } = await propositionPourReferent(tx, propositionId, a);
    if (p.statut !== 'entretien') throw new ErreurMetier('La proposition n’est pas au statut « Entretien ».');
    await tx.update(schema.proposition).set({ entretienLe, entretienLieu, majLe: new Date() }).where(eq(schema.proposition.id, propositionId));
    const detail = [entretienLe ? formaterDateHeure(entretienLe) : null, entretienLieu].filter(Boolean).join(', ');
    await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : entretien modifié${detail ? ` (${detail})` : ''}`, auteurDe(a), { propositionId });
    await journaliser({ ...audit(a), action: 'proposition.entretien_modifie', objetType: 'proposition', objetId: propositionId, apres: { entretienLe: entretienLe?.toISOString() ?? null, entretienLieu } }, tx);
  });
}

// ─── Placements (RG-14..19) ───────────────────────────────────

export interface EntreePlacement {
  /** Date de prise de poste prévue (AAAA-MM-JJ). */
  datePrevue: string;
  /** Intitulé du poste (par défaut : celui de la ligne). */
  poste?: string | null;
  /** Salaire convenu : facultatif, confidentiel. */
  salaire?: string | null;
}

export interface ResultatPlacement {
  placementId: number;
  avertissements: string[];
}

/** Placements « actifs » de la ligne (hors abandons et remplacements) : contrôle de dépassement. */
async function avertissementDepassement(tx: Tx, lignePosteId: number): Promise<string[]> {
  const [l] = await tx.select({ nombre: schema.lignePoste.nombre, intitule: schema.lignePoste.intitule }).from(schema.lignePoste).where(eq(schema.lignePoste.id, lignePosteId));
  const [r] = await tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.placement)
    .where(and(eq(schema.placement.lignePosteId, lignePosteId), ne(schema.placement.statut, 'abandonne'), eq(schema.placement.remplacement, false)));
  const n = r?.n ?? 0;
  if (!l || n <= l.nombre) return [];
  return [`Plus de placements que de personnes demandées pour « ${l.intitule} » (${n} pour ${l.nombre}) : un avenant au devis sera nécessaire avant la clôture.`];
}

async function insererPlacement(tx: Tx, p: Awaited<ReturnType<typeof chargerProposition>>, e: EntreePlacement, a: ActeurProposition) {
  const datePrevue = lireDate(e.datePrevue, 'Date de prise de poste');
  const poste = texteCourt(e.poste, 120) ?? p.intitule;
  const salaire = texteCourt(e.salaire, 120);
  const [pl] = await tx
    .insert(schema.placement)
    .values({
      propositionId: p.id,
      dossierId: p.dossierId,
      lignePosteId: p.lignePosteId,
      candidatId: p.candidatId,
      datePrevue,
      poste,
      salaire,
      // RG-18 : le placement issu d'une Proposition de remplacement n'ajoute pas de commission.
      remplacement: p.remplacePlacementId !== null,
      remplacePlacementId: p.remplacePlacementId,
      auteurId: a.id,
    })
    .returning({ id: schema.placement.id });
  return { id: pl!.id, datePrevue, poste };
}

/** La recherche est close pour les placements ordinaires ; un remplacement (garantie) reste possible. */
function verifierRechercheOuverte(d: DossierVerrouille, p: { remplacePlacementId: number | null }) {
  if (estFinal(d.statut)) throw new ErreurMetier('Le dossier est fermé.');
  if (d.rechercheClotureLe && p.remplacePlacementId === null) throw new ErreurMetier('La recherche est clôturée.');
}

/** RG-14 : Placement « annoncé » depuis une Proposition « retenue ». */
export async function annoncerPlacement(propositionId: number, e: EntreePlacement, a: ActeurProposition): Promise<ResultatPlacement> {
  try {
    return await getDb().transaction(async (tx) => {
      const { d, p } = await propositionPourReferent(tx, propositionId, a);
      verifierRechercheOuverte(d, p);
      if (p.statut !== 'retenue') throw new ErreurMetier('Seule une proposition « Retenue » peut donner lieu à un placement.');
      const pl = await insererPlacement(tx, p, e, a);
      await evenementDossier(tx, p.dossierId, 'placement', `${p.libelle} : placement annoncé, prise de poste prévue le ${formaterJour(pl.datePrevue)}${p.remplacePlacementId ? ' (remplacement, sans commission)' : ''}`, auteurDe(a), { placementId: pl.id, statut: 'annonce' });
      await journaliser({ ...audit(a), action: 'placement.annonce', objetType: 'placement', objetId: pl.id, apres: { statut: 'annonce', datePrevue: pl.datePrevue, poste: pl.poste }, details: { propositionId, remplacement: p.remplacePlacementId !== null } }, tx);
      return { placementId: pl.id, avertissements: p.remplacePlacementId === null ? await avertissementDepassement(tx, p.lignePosteId) : [] };
    });
  } catch (err) {
    if (codeErreur(err) === '23505') throw new ErreurMetier(MESSAGE_PLACEMENT_EN_COURS);
    throw err;
  }
}

export interface PreuvePlacement {
  /** Attestation signée (photo / PDF) ou capture de confirmation WhatsApp, obligatoire. */
  fichier: Fichier | null;
  /** Date effective de prise de poste (AAAA-MM-JJ). */
  datePriseDePoste: string;
}

const MANQUE_PREUVE = 'Joignez la preuve (attestation signée ou capture de confirmation WhatsApp).';

/** RG-16, RG-17 : confirmation par le référent, preuve jointe. */
export async function confirmerPlacementParPreuve(placementId: number, c: PreuvePlacement, a: ActeurProposition, maintenant = new Date()): Promise<void> {
  if (!c.fichier || c.fichier.octets.byteLength === 0) throw new ErreurMetier(MANQUE_PREUVE);
  const jour = lireDate(c.datePriseDePoste, 'Date de prise de poste');
  if (jour > aujourdhui(maintenant)) throw new ErreurMetier('La prise de poste ne peut être confirmée qu’une fois effective.');
  await verifierDroitsAvantDepot('placement', placementId, a);
  await avecPreuve(c.fichier, 'placements', MANQUE_PREUVE, (f) =>
    getDb().transaction(async (tx) => {
      await placementPourReferent(tx, placementId, a);
      await confirmerPlacement(tx, placementId, { mode: 'preuve', datePriseDePoste: jour, confirmeParId: a.id, preuveCle: f.cle, preuveMime: f.mime, preuveNom: f.nom, ip: a.ip ?? null }, auteurDe(a));
    }),
  );
}

/**
 * Cas limite : le client a recruté un candidat proposé sans le déclarer. Le référent crée
 * directement un Placement confirmé sur preuve (déclaration du candidat, capture), depuis une
 * Proposition transmise au client.
 */
export async function placementDirectSurPreuve(propositionId: number, e: Omit<EntreePlacement, 'datePrevue'> & PreuvePlacement, a: ActeurProposition, maintenant = new Date()): Promise<ResultatPlacement> {
  if (!e.fichier || e.fichier.octets.byteLength === 0) throw new ErreurMetier(MANQUE_PREUVE);
  const jour = lireDate(e.datePriseDePoste, 'Date de prise de poste');
  if (jour > aujourdhui(maintenant)) throw new ErreurMetier('La prise de poste ne peut être confirmée qu’une fois effective.');
  await verifierDroitsAvantDepot('proposition', propositionId, a);
  try {
    return await avecPreuve(e.fichier, 'placements', MANQUE_PREUVE, (f) =>
      getDb().transaction(async (tx) => {
        const { d, p } = await propositionPourReferent(tx, propositionId, a);
        verifierRechercheOuverte(d, p);
        if (!estTransmise(p.statut) || p.statut === 'placee') throw new ErreurMetier('Le placement direct n’est possible que pour un profil transmis au client (proposé, entretien ou retenu).');
        const pl = await insererPlacement(tx, p, { datePrevue: jour, poste: e.poste, salaire: e.salaire }, a);
        await journaliser({ ...audit(a), action: 'placement.annonce', objetType: 'placement', objetId: pl.id, apres: { statut: 'annonce', datePrevue: jour, poste: pl.poste }, details: { propositionId, direct: true } }, tx);
        await confirmerPlacement(tx, pl.id, { mode: 'preuve', datePriseDePoste: jour, confirmeParId: a.id, preuveCle: f.cle, preuveMime: f.mime, preuveNom: f.nom, ip: a.ip ?? null }, auteurDe(a));
        await evenementDossier(tx, p.dossierId, 'placement', `${p.libelle} : recrutement direct par le client déclaré sur preuve (non-contournement)`, auteurDe(a), { placementId: pl.id, direct: true });
        return { placementId: pl.id, avertissements: p.remplacePlacementId === null ? await avertissementDepassement(tx, p.lignePosteId) : [] };
      }),
    );
  } catch (err) {
    if (codeErreur(err) === '23505') throw new ErreurMetier(MESSAGE_PLACEMENT_EN_COURS);
    throw err;
  }
}

/** RG-21 : un Placement annoncé non concrétisé est abandonné (motif obligatoire). */
export async function abandonnerPlacement(placementId: number, motif: string, a: ActeurProposition, maintenant = new Date()): Promise<void> {
  const m = texteCourt(motif, 500);
  if (!m) throw new ErreurMetier('Indiquez le motif de l’abandon.');
  await getDb().transaction(async (tx) => {
    const { pl, p } = await placementPourReferent(tx, placementId, a);
    if (pl.statut !== 'annonce') throw new ErreurMetier('Seul un placement annoncé peut être abandonné.');
    await tx.update(schema.placement).set({ statut: 'abandonne', finLe: aujourdhui(maintenant), finMotif: m }).where(eq(schema.placement.id, placementId));
    await evenementDossier(tx, pl.dossierId, 'placement', `${p.libelle} : placement abandonné (${m})`, auteurDe(a), { placementId, statut: 'abandonne' });
    await journaliser({ ...audit(a), action: 'placement.abandonne', objetType: 'placement', objetId: placementId, avant: { statut: 'annonce' }, apres: { statut: 'abandonne' }, details: { motif: m } }, tx);
  });
}

export interface Rupture {
  /** Date de départ du candidat (AAAA-MM-JJ). */
  dateRupture: string;
  motif: string;
  /** Facultatif : candidat remplaçant proposé immédiatement (RG-18). */
  remplacantId?: number | null;
}

export interface ResultatRupture {
  statut: 'rompu_garantie' | 'termine';
  /** Proposition de remplacement créée (si un remplaçant a été choisi). */
  remplacement: ResultatProposition | null;
}

/**
 * RG-18 / RG-19 : départ du candidat. Pendant la garantie (paramètre `garantie_jours`, depuis la
 * prise de poste) → `rompu pendant garantie` (reste compté dans le montant final) et remplacement
 * sur la même ligne, sans commission ; après → `terminé`, pour information.
 */
export async function declarerRupture(placementId: number, r: Rupture, a: ActeurProposition, maintenant = new Date()): Promise<ResultatRupture> {
  const m = texteCourt(r.motif, 500);
  if (!m) throw new ErreurMetier('Indiquez le motif du départ.');
  const jour = lireDate(r.dateRupture, 'Date du départ');
  if (jour > aujourdhui(maintenant)) throw new ErreurMetier('La date du départ ne peut pas être dans le futur.');
  if (r.remplacantId && !(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier(MESSAGE_VIVIER);
  const garantie = await lireParametre('garantie_jours');
  try {
    return await getDb().transaction(async (tx) => {
      const { d, pl, p } = await placementPourReferent(tx, placementId, a);
      if (pl.statut !== 'confirme' || !pl.datePriseDePoste) throw new ErreurMetier('Seul un placement confirmé peut être rompu.');
      if (jour < pl.datePriseDePoste) throw new ErreurMetier('La date du départ précède la prise de poste.');
      const statut = dansLaGarantie(new Date(`${pl.datePriseDePoste}T00:00:00Z`), new Date(`${jour}T00:00:00Z`), garantie) ? ('rompu_garantie' as const) : ('termine' as const);
      await tx.update(schema.placement).set({ statut, finLe: jour, finMotif: m }).where(eq(schema.placement.id, placementId));
      await evenementDossier(
        tx,
        pl.dossierId,
        'placement',
        statut === 'rompu_garantie'
          ? `${p.libelle} : départ le ${formaterJour(jour)}, pendant la garantie de ${garantie} jours (${m}) — remplacement sans commission`
          : `${p.libelle} : départ le ${formaterJour(jour)}, après la garantie (${m}) — sans effet financier`,
        auteurDe(a),
        { placementId, statut },
      );
      await journaliser({ ...audit(a), action: statut === 'rompu_garantie' ? 'placement.rompu_garantie' : 'placement.termine', objetType: 'placement', objetId: placementId, avant: { statut: 'confirme' }, apres: { statut, finLe: jour }, details: { motif: m, garantieJours: garantie } }, tx);
      let remplacement: ResultatProposition | null = null;
      if (statut === 'rompu_garantie' && r.remplacantId) {
        remplacement = await insererProposition(tx, d, { dossierId: d.id, lignePosteId: pl.lignePosteId, candidatId: r.remplacantId, remplacePlacementId: placementId }, a);
      }
      return { statut, remplacement };
    });
  } catch (err) {
    if (codeErreur(err) === '23505') throw new ErreurMetier(MESSAGE_DEJA_PROPOSE);
    throw err;
  }
}

// ─── Liens d'accès temporaires (RG-10, RG-15) ─────────────────

export type ObjetLien = 'profil' | 'attestation';

export interface LienAcces {
  id: number;
  /** URL absolue à transmettre au client : le jeton clair n'est stocké nulle part. */
  url: string;
  expireLe: Date;
}

/** Le texte noté au journal ne contient jamais un lien d'accès utilisable. */
export const masquerLienAcces = (texte: string) => texte.replace(/(\/profil\/)[A-Za-z0-9_-]+/g, '$1[lien masqué]');

async function insererLien(tx: Tx, p: Awaited<ReturnType<typeof chargerProposition>> & { accesRevoqueLe?: Date | null }, objet: ObjetLien, a: ActeurProposition, maintenant: Date): Promise<LienAcces> {
  if (!estTransmise(p.statut)) throw new ErreurMetier('Le profil n’est transmis au client qu’après l’accord du candidat.');
  const [etat] = await tx.select({ accesRevoqueLe: schema.proposition.accesRevoqueLe }).from(schema.proposition).where(eq(schema.proposition.id, p.id));
  if (etat?.accesRevoqueLe) throw new ErreurMetier('L’accès du client à ce profil est révoqué.');
  if (objet === 'attestation') {
    const [pl] = await tx
      .select({ id: schema.placement.id })
      .from(schema.placement)
      .where(and(eq(schema.placement.propositionId, p.id), inArray(schema.placement.statut, ['annonce', 'confirme'])));
    if (!pl) throw new ErreurMetier('Annoncez d’abord le placement.');
  }
  const jeton = genererJetonAcces();
  const expireLe = new Date(maintenant.getTime() + VALIDITE_LIEN_PROFIL_JOURS * JOUR_MS);
  const [l] = await tx.insert(schema.accesProfil).values({ propositionId: p.id, empreinte: empreinteJeton(jeton), objet, expireLe, auteurId: a.id, creeLe: maintenant }).returning({ id: schema.accesProfil.id });
  const quoi = objet === 'profil' ? 'au profil' : 'à l’attestation de prise de poste';
  await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : lien d’accès temporaire ${quoi} créé (valable ${VALIDITE_LIEN_PROFIL_JOURS} jours)`, auteurDe(a), { propositionId: p.id, accesId: l!.id });
  await journaliser({ ...audit(a), action: 'proposition.lien_cree', objetType: 'proposition', objetId: p.id, details: { accesId: l!.id, objet, expireLe: expireLe.toISOString() } }, tx);
  return { id: l!.id, url: `${env().BETTER_AUTH_URL}${cheminAcces(jeton)}`, expireLe };
}

/** RG-10 / RG-15 : lien d'accès temporaire (7 jours, révocable) à un profil transmis ou à son attestation. */
export async function creerLienAcces(propositionId: number, objet: ObjetLien, a: ActeurProposition, maintenant = new Date()): Promise<LienAcces> {
  if (objet !== 'profil' && objet !== 'attestation') throw new ErreurMetier('Objet du lien inconnu.');
  return getDb().transaction(async (tx) => {
    const { p } = await propositionPourReferent(tx, propositionId, a);
    return insererLien(tx, p, objet, a, maintenant);
  });
}

export async function revoquerLienAcces(accesId: number, a: ActeurProposition, maintenant = new Date()): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [l] = await tx.select().from(schema.accesProfil).where(eq(schema.accesProfil.id, accesId));
    if (!l) throw new ErreurMetier('Lien introuvable.');
    const { p } = await propositionPourReferent(tx, l.propositionId, a);
    if (l.revoqueLe) return;
    await tx.update(schema.accesProfil).set({ revoqueLe: maintenant }).where(eq(schema.accesProfil.id, accesId));
    await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : lien d’accès temporaire révoqué`, auteurDe(a), { propositionId: p.id, accesId });
    await journaliser({ ...audit(a), action: 'proposition.lien_revoque', objetType: 'proposition', objetId: p.id, details: { accesId } }, tx);
  });
}

// ─── Modèles WhatsApp des Propositions ────────────────────────

export type DestinataireModele = 'candidat' | 'client';

export const MODELE_PROPOSITION_POSTE = 'Proposition de poste';
export const MODELE_CONVOCATION_ENTRETIEN = 'Convocation entretien';
export const MODELE_PROFIL_CANDIDAT = 'Profil candidat';
export const MODELE_ATTESTATION = 'Attestation de prise de poste';

/**
 * Modèles par défaut (insérés par migration à la fusion du lot ; proposés tant qu'ils ne sont pas
 * en base). Au candidat : variables `candidat.*` ; au client : lien d'accès temporaire généré à l'envoi.
 */
export const MODELES_PROPOSITION_PAR_DEFAUT: { nom: string; texte: string }[] = [
  {
    nom: MODELE_PROPOSITION_POSTE,
    texte:
      'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Nous aimerions présenter votre profil pour le poste de {{poste.intitule}} chez {{proposition.client}}.\n\nDonnez votre réponse (accepter ou refuser) dans votre espace candidat : {{candidat.lien_espace}}\n\nSi vous acceptez, votre profil et votre CV (tel quel) seront transmis à ce client. Votre numéro ne lui sera pas communiqué sans votre accord.\n\n{{referent.prenom}}, NEXCLEAN',
  },
  {
    nom: MODELE_CONVOCATION_ENTRETIEN,
    texte:
      'Bonjour {{candidat.prenom}}, bonne nouvelle : {{proposition.client}} souhaite vous rencontrer pour le poste de {{poste.intitule}}.\n\nDate : {{entretien.date}}\nLieu : {{entretien.lieu}}\n\nMerci de me confirmer votre présence.\n\n{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}',
  },
  {
    nom: MODELE_PROFIL_CANDIDAT,
    texte:
      'Bonjour {{client.contact}}, voici le profil de {{proposition.candidat}} pour le poste de {{poste.intitule}} (dossier {{dossier.numero}}) : {{proposition.lien_profil}}\n\nCe lien est personnel et valable 7 jours. Pour organiser un entretien, répondez-moi directement ici.\n\n{{referent.prenom}}, NEXCLEAN',
  },
  {
    nom: MODELE_ATTESTATION,
    texte:
      'Bonjour {{client.contact}}, voici l’attestation de prise de poste de {{proposition.candidat}} ({{poste.intitule}}, dossier {{dossier.numero}}, prise de poste prévue le {{placement.date}}) : {{placement.lien_attestation}}\n\nMerci de confirmer la prise de poste en ligne, ou de nous renvoyer l’attestation signée. Lien valable 7 jours.\n\n{{referent.prenom}}, NEXCLEAN',
  },
];

export const destinataireModele = (texte: string): DestinataireModele => (estModeleCandidat(texte) ? 'candidat' : 'client');
const utiliseVariable = (texte: string, v: Variable) => variablesDe(texte).includes(v);
/** Le modèle a besoin d'un lien d'accès temporaire généré à l'envoi. */
export const lienRequis = (texte: string): ObjetLien | null =>
  utiliseVariable(texte, 'placement.lien_attestation') ? 'attestation' : utiliseVariable(texte, 'proposition.lien_profil') ? 'profil' : null;

/** Modèles de proposition actifs (+ modèles par défaut jamais créés en base). */
export async function listerModelesProposition(): Promise<{ nom: string; texte: string; destinataire: DestinataireModele }[]> {
  const tous = await getDb().select().from(schema.modeleMessage).orderBy(asc(schema.modeleMessage.nom));
  const enBase = tous.filter((m) => m.actif && estModeleProposition(m.texte)).map((m) => ({ nom: m.nom, texte: m.texte }));
  const manquants = MODELES_PROPOSITION_PAR_DEFAUT.filter((d) => !tous.some((m) => m.nom === d.nom));
  return [...enBase, ...manquants].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((m) => ({ ...m, destinataire: destinataireModele(m.texte) }));
}

/** Valeurs des variables pour une Proposition (dossier, candidat, poste, entretien, placement, liens). */
export async function contexteProposition(propositionId: number, utilisateur: { id: string; nom: string }, liens: Partial<Record<ObjetLien, string>> = {}): Promise<ContexteMessage> {
  const db = getDb();
  const [p] = await db
    .select({
      dossierId: schema.proposition.dossierId,
      entretienLe: schema.proposition.entretienLe,
      entretienLieu: schema.proposition.entretienLieu,
      intitule: schema.lignePoste.intitule,
      client: schema.client.nom,
      prenom: schema.candidat.prenom,
      nom: schema.candidat.nom,
      referentId: schema.candidat.referentId,
    })
    .from(schema.proposition)
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, schema.proposition.lignePosteId))
    .innerJoin(schema.client, eq(schema.client.id, schema.proposition.clientId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .where(eq(schema.proposition.id, propositionId));
  if (!p) throw new ErreurMetier('Proposition introuvable.');
  const [pl] = await db
    .select({ datePrevue: schema.placement.datePrevue })
    .from(schema.placement)
    .where(and(eq(schema.placement.propositionId, propositionId), ne(schema.placement.statut, 'abandonne')))
    .orderBy(desc(schema.placement.id))
    .limit(1);
  const dossier = await contexteDossier(p.dossierId, utilisateur);
  const candidat = await contexteCandidat({ prenom: p.prenom, nom: p.nom, referentId: p.referentId }, utilisateur);
  return {
    ...candidat,
    // Le référent est celui du Dossier (pas forcément celui du candidat).
    ...dossier,
    'poste.intitule': p.intitule,
    'proposition.client': p.client,
    'proposition.candidat': nomAffichable(p.prenom, p.nom),
    'proposition.lien_profil': liens.profil ?? '',
    'entretien.date': p.entretienLe ? formaterDateHeure(p.entretienLe) : 'à préciser',
    'entretien.lieu': p.entretienLieu ?? 'à préciser',
    'placement.date': pl ? formaterJour(pl.datePrevue) : '',
    'placement.lien_attestation': liens.attestation ?? '',
  };
}

export interface MessagePrepare {
  texte: string;
  /** Numéro WhatsApp du destinataire (E.164). */
  numero: string | null;
  /** Lien d'accès généré pour ce message (modèles client). */
  lien: LienAcces | null;
}

/**
 * Prépare un message WhatsApp à partir d'un modèle de proposition. Pour un modèle client utilisant
 * un lien (profil, attestation), le lien d'accès temporaire est généré à ce moment (RG-10, RG-15).
 */
export async function preparerMessageProposition(propositionId: number, nomModele: string, a: ActeurProposition & { nom: string }): Promise<MessagePrepare> {
  const modele = (await listerModelesProposition()).find((m) => m.nom === nomModele);
  if (!modele) throw new ErreurMetier('Modèle introuvable.');
  const objet = lienRequis(modele.texte);
  const lien = objet ? await creerLienAcces(propositionId, objet, a) : null;
  const [x] = await getDb()
    .select({ referentId: schema.dossier.referentId, clientWhatsapp: schema.client.whatsapp, telephone: schema.candidat.telephone, whatsapp: schema.candidat.whatsapp })
    .from(schema.proposition)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.proposition.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.proposition.clientId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .where(eq(schema.proposition.id, propositionId));
  if (!x) throw new ErreurMetier('Proposition introuvable.');
  if (!peutTraiter(a, x.referentId)) throw new ErreurAccesDossier();
  const ctx = await contexteProposition(propositionId, a, lien && objet ? { [objet]: lien.url } : {});
  return { texte: rendreMessage(modele.texte, ctx), numero: modele.destinataire === 'client' ? x.clientWhatsapp : (x.whatsapp ?? x.telephone), lien };
}

/** MVP1-05 RG-17 : trace du message préparé dans l'historique du Dossier (lien d'accès masqué). */
export async function noterWhatsAppProposition(propositionId: number, nomModele: string, texte: string, a: ActeurProposition): Promise<void> {
  const nom = texteCourt(nomModele, 80);
  const t = texteCourt(texte, 4000);
  if (!nom || !t) throw new ErreurMetier('Message vide.');
  await getDb().transaction(async (tx) => {
    const { p } = await propositionPourReferent(tx, propositionId, a);
    await tx.insert(schema.evenementDossier).values({ dossierId: p.dossierId, auteurId: a.id, type: 'whatsapp', commentaire: `Message WhatsApp préparé : ${nom} (${p.libelle})`, apres: { texte: masquerLienAcces(t), propositionId } });
    await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, p.dossierId));
  });
}

// ─── Preuves (lecture journalisée) ────────────────────────────

export interface FichierLu {
  nom: string;
  mime: string;
  octets: Uint8Array;
}

/** Capture de l'accord WhatsApp : référent du Dossier ou Direction ; refus et lectures journalisés. */
export async function lirePreuveAccord(dossierId: number, propositionId: number, a: ActeurProposition): Promise<FichierLu | null> {
  const [r] = await getDb()
    .select({ cle: schema.proposition.accordPreuveCle, mime: schema.proposition.accordPreuveMime, referentId: schema.dossier.referentId })
    .from(schema.proposition)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.proposition.dossierId))
    .where(and(eq(schema.proposition.id, propositionId), eq(schema.proposition.dossierId, dossierId)));
  if (!r) return null;
  if (!peutTraiter(a, r.referentId)) {
    await journaliser({ ...audit(a), action: 'acces.refuse', objetType: 'proposition', objetId: propositionId, details: { preuve: 'accord' } });
    throw new ErreurAccesDossier();
  }
  if (!r.cle) return null;
  const octets = await getStockage().lire(r.cle);
  await journaliser({ ...audit(a), action: 'proposition.preuve_consultee', objetType: 'proposition', objetId: propositionId, details: { dossierId } });
  const ext = r.mime === 'application/pdf' ? 'pdf' : (r.mime ?? 'image/jpeg').split('/')[1];
  return { nom: `accord-proposition-${propositionId}.${ext}`, mime: r.mime ?? 'application/octet-stream', octets };
}

/** Preuve de prise de poste jointe par le référent (RG-16). */
export async function lirePreuvePlacement(dossierId: number, placementId: number, a: ActeurProposition): Promise<FichierLu | null> {
  const [r] = await getDb()
    .select({ cle: schema.placement.preuveCle, mime: schema.placement.preuveMime, nom: schema.placement.preuveNom, referentId: schema.dossier.referentId })
    .from(schema.placement)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.placement.dossierId))
    .where(and(eq(schema.placement.id, placementId), eq(schema.placement.dossierId, dossierId)));
  if (!r) return null;
  if (!peutTraiter(a, r.referentId)) {
    await journaliser({ ...audit(a), action: 'acces.refuse', objetType: 'placement', objetId: placementId, details: { preuve: 'placement' } });
    throw new ErreurAccesDossier();
  }
  if (!r.cle) return null;
  const octets = await getStockage().lire(r.cle);
  await journaliser({ ...audit(a), action: 'placement.preuve_consultee', objetType: 'placement', objetId: placementId, details: { dossierId } });
  return { nom: r.nom ?? `preuve-placement-${placementId}`, mime: r.mime ?? 'application/octet-stream', octets };
}

// ─── Clôture de la recherche (RG-20..23) ──────────────────────

export interface LigneRecherche {
  id: number;
  intitule: string;
  nombre: number;
  /** RG-17 : placés (confirmés, en poste ou terminés). */
  places: number;
  depassement: boolean;
}

export interface EtatRecherche {
  /** Dernière transition vers « Acompte reçu » (historique du Dossier). */
  acompteLe: Date | null;
  delaiJours: number;
  echeance: Date | null;
  echue: boolean;
  lignes: LigneRecherche[];
  tousPourvus: boolean;
  /** RG-21 : placements encore annoncés (bloquent la clôture). */
  annonces: { id: number; libelle: string }[];
  /** RG-18, RG-22 : placements retenus pour le montant final (hors remplacements). */
  retenus: number;
  /** Le Dossier est à un statut de recherche (« Recherche en cours » / « Candidats proposés »). */
  enRecherche: boolean;
  clotureLe: Date | null;
  clotureMotif: string | null;
  /** Nombre figé à la clôture. */
  placementsRetenus: number | null;
  /** Verdict sans motif (avant l'échéance, un motif sera demandé si tout n'est pas pourvu). */
  verdict: VerdictCloture;
  avertissements: string[];
}

async function dateAcompte(db: Lecteur, dossierId: number): Promise<Date | null> {
  const ev = schema.evenementDossier;
  const [r] = await db
    .select({ le: sql<Date | null>`max(${ev.horodatage})`.mapWith(ev.horodatage) })
    .from(ev)
    .where(and(eq(ev.dossierId, dossierId), eq(ev.type, 'transition'), eq(ev.versStatut, 'acompte_recu')));
  return r?.le ?? null;
}

type DossierRecherche = Pick<typeof schema.dossier.$inferSelect, 'id' | 'statut' | 'delaiRechercheJours' | 'rechercheClotureLe' | 'rechercheClotureMotif' | 'placementsRetenus'>;

async function calculerEtat(db: Lecteur, d: DossierRecherche, maintenant: Date, delaiParDefaut?: number): Promise<EtatRecherche> {
  const delaiJours = d.delaiRechercheJours ?? delaiParDefaut ?? (await lireParametre('delai_recherche_jours'));
  const acompteLe = await dateAcompte(db, d.id);
  const echeance = acompteLe ? echeanceRecherche(acompteLe, delaiJours) : null;
  const lignes = await db.select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, d.id)).orderBy(asc(schema.lignePoste.ordre));
  const placements = await db
    .select({ id: schema.placement.id, statut: schema.placement.statut, remplacement: schema.placement.remplacement, lignePosteId: schema.placement.lignePosteId, poste: schema.placement.poste, prenom: schema.candidat.prenom, nom: schema.candidat.nom, supprimeLe: schema.candidat.supprimeLe, candidatId: schema.candidat.id })
    .from(schema.placement)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.placement.candidatId))
    .where(eq(schema.placement.dossierId, d.id))
    .orderBy(asc(schema.placement.id));
  const vueLignes = lignes.map((l) => {
    const places = compterPlacesLigne(placements.filter((p) => p.lignePosteId === l.id));
    return { ...l, places, depassement: places > l.nombre };
  });
  const annonces = placements
    .filter((p) => p.statut === 'annonce')
    .map((p) => ({ id: p.id, libelle: `${p.supprimeLe ? pseudonyme(p.candidatId) : nomAffichable(p.prenom, p.nom)} — ${p.poste}` }));
  const tousPourvus = vueLignes.length > 0 && vueLignes.every((l) => l.places >= l.nombre);
  const echue = echeance !== null && maintenant.getTime() >= echeance.getTime();
  const avertissements = vueLignes
    .filter((l) => l.depassement)
    .map((l) => `« ${l.intitule} » : ${l.places} placés pour ${l.nombre} demandés — un avenant au devis est exigé avant la clôture (MVP2-04).`);
  return {
    acompteLe,
    delaiJours,
    echeance,
    echue,
    lignes: vueLignes,
    tousPourvus,
    annonces,
    retenus: compterPlacementsRetenus(placements),
    enRecherche: (STATUTS_DOSSIER_PROPOSITION as readonly string[]).includes(d.statut),
    clotureLe: d.rechercheClotureLe,
    clotureMotif: d.rechercheClotureMotif,
    placementsRetenus: d.placementsRetenus,
    verdict: verifierCloture({ tousPourvus, echeance, maintenant, annonces }),
    avertissements,
  };
}

/** État de la recherche d'un Dossier REC (lecture : droits de consultation du Dossier). */
export async function etatRecherche(dossierId: number, a: Demandeur, maintenant = new Date()): Promise<EtatRecherche | null> {
  const [d] = await getDb().select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d || d.type !== 'REC') return null;
  if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
  return calculerEtat(getDb(), d, maintenant);
}

export class ErreurCloture extends ErreurMetier {
  constructor(
    message: string,
    readonly annonces: readonly { id: number; libelle: string }[] = [],
  ) {
    super(annonces.length ? `${message} Placements concernés : ${annonces.map((x) => x.libelle).join(' ; ')}.` : message);
  }
}

export interface ResultatCloture {
  placementsRetenus: number;
  propositionsRetirees: number;
  avertissements: string[];
}

/**
 * RG-21..23 : clôture de la recherche. Possible si tous les postes sont pourvus, à l'échéance, ou
 * avant avec motif ; bloquée tant que des placements sont annoncés. Fige le nombre de placements
 * retenus (hors remplacements), fait passer le Dossier à « Placements confirmés », retire les
 * Propositions en cours (candidats notifiés) et révoque l'accès client aux profils non placés.
 */
export async function cloturerRecherche(dossierId: number, motif: string | null, a: ActeurProposition, maintenant = new Date()): Promise<ResultatCloture> {
  const m = texteCourt(motif, 500);
  const delaiParDefaut = await lireParametre('delai_recherche_jours');
  const resultat = await getDb().transaction(async (tx) => {
    const d = await verrouillerDossier(tx, dossierId, a);
    if (d.rechercheClotureLe) throw new ErreurMetier('La recherche est déjà clôturée.');
    if (!(STATUTS_DOSSIER_PROPOSITION as readonly string[]).includes(d.statut)) throw new ErreurMetier(`La recherche ne peut être clôturée qu’au statut « Recherche en cours » ou « Candidats proposés » (statut actuel : ${STATUTS[d.statut]}).`);
    const etat = await calculerEtat(tx, d, maintenant, delaiParDefaut);
    const verdict = verifierCloture({ tousPourvus: etat.tousPourvus, echeance: etat.echeance, maintenant, motif: m, annonces: etat.annonces });
    if (!verdict.ok) throw new ErreurCloture(verdict.erreur, verdict.annonces);

    // RG-22 : nombre figé. Le calcul du montant final (commission figée × placements retenus,
    // ADR 0010) sera déclenché ici par MVP2-05 (non disponible à ce jalon).
    const retenus = etat.retenus;
    await tx
      .update(schema.dossier)
      .set({ statut: 'placements_confirmes', rechercheClotureLe: maintenant, rechercheClotureMotif: m, placementsRetenus: retenus, derniereActionLe: maintenant })
      .where(eq(schema.dossier.id, dossierId));
    const raison = etat.tousPourvus ? 'tous les postes sont pourvus' : etat.echue ? 'échéance atteinte' : `avant l’échéance : ${m}`;
    await tx.insert(schema.evenementDossier).values({
      dossierId,
      auteurId: a.id,
      type: 'transition',
      deStatut: d.statut,
      versStatut: 'placements_confirmes',
      commentaire: `Clôture de la recherche (${raison}) : ${retenus} placement(s) retenu(s) pour le montant final`,
      apres: { placementsRetenus: retenus, motif: m },
    });
    await journaliser({ ...audit(a), action: 'dossier.transition', objetType: 'dossier', objetId: dossierId, avant: d.statut, apres: 'placements_confirmes', details: { clotureRecherche: true } }, tx);
    await journaliser({ ...audit(a), action: 'dossier.recherche_cloturee', objetType: 'dossier', objetId: dossierId, apres: { placementsRetenus: retenus }, details: { motif: m, raison, echeance: etat.echeance?.toISOString() ?? null, avertissements: etat.avertissements } }, tx);

    // Les Propositions encore en cours sont retirées (les Propositions de remplacement, liées à la
    // garantie qui court au-delà de la clôture, sont conservées).
    const retirees = await tx
      .update(schema.proposition)
      .set({ statut: 'retiree', motif: 'Clôture de la recherche', majLe: maintenant })
      .where(and(eq(schema.proposition.dossierId, dossierId), inArray(schema.proposition.statut, [...STATUTS_EN_COURS]), isNull(schema.proposition.remplacePlacementId)))
      .returning({ id: schema.proposition.id, candidatId: schema.proposition.candidatId, lignePosteId: schema.proposition.lignePosteId });
    const intitules = new Map(etat.lignes.map((l) => [l.id, l.intitule]));
    const [cl] = await tx.select({ nom: schema.client.nom }).from(schema.client).where(eq(schema.client.id, d.clientId));
    for (const r of retirees) {
      await notifierCandidat(tx, r.candidatId, {
        titre: 'Recherche terminée',
        texte: `La recherche pour le poste « ${intitules.get(r.lignePosteId) ?? ''} » chez ${cl?.nom ?? 'ce client'} est terminée : la proposition est retirée. Merci pour votre disponibilité.`,
        lien: '/candidat/espace',
        cle: `proposition_retiree:${r.id}`,
      });
    }
    if (retirees.length) {
      await journaliser({ acteurType: 'systeme', action: 'proposition.retiree', objetType: 'dossier', objetId: dossierId, details: { motif: 'clôture de la recherche', propositions: retirees.map((r) => r.id) } }, tx);
    }
    // RG-23 : accès client révoqué pour les candidats non placés (sauf remplacements en cours).
    await revoquerAccesNonPlacesHorsRemplacements(tx, dossierId, maintenant);
    return { placementsRetenus: retenus, propositionsRetirees: retirees.length, avertissements: etat.avertissements };
  });
  declencherEnvoi();
  return resultat;
}

/** RG-23 à la clôture : comme revoquerAccesNonPlaces, en épargnant les remplacements en cours. */
async function revoquerAccesNonPlacesHorsRemplacements(tx: Tx, dossierId: number, maintenant: Date) {
  const enCours = await tx
    .select({ id: schema.proposition.id })
    .from(schema.proposition)
    .where(and(eq(schema.proposition.dossierId, dossierId), isNotNull(schema.proposition.remplacePlacementId), inArray(schema.proposition.statut, [...STATUTS_EN_COURS])));
  if (!enCours.length) return revoquerAccesNonPlaces(tx, dossierId, maintenant);
  const ids = enCours.map((x) => x.id);
  const p = schema.proposition;
  await tx
    .update(p)
    .set({ accesRevoqueLe: maintenant })
    .where(and(eq(p.dossierId, dossierId), ne(p.statut, 'placee'), isNull(p.accesRevoqueLe), notInArray(p.id, ids)));
  const nonPlacees = await tx
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.dossierId, dossierId), ne(p.statut, 'placee'), notInArray(p.id, ids)));
  if (nonPlacees.length) {
    await tx
      .update(schema.accesProfil)
      .set({ revoqueLe: maintenant })
      .where(and(inArray(schema.accesProfil.propositionId, nonPlacees.map((x) => x.id)), isNull(schema.accesProfil.revoqueLe)));
  }
  return nonPlacees.length;
}

// ─── Lectures pour le Back-Office ─────────────────────────────

/** Section « Propositions » d'un Dossier : par ligne de poste, propositions, placements, liens actifs. */
export async function lirePropositionsDossier(dossierId: number, a: Demandeur, maintenant = new Date()) {
  const db = getDb();
  const [d] = await db.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d || d.type !== 'REC') return null;
  if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
  const voirSalaire = peutVoirSalaire(a, d.referentId);
  const props = await db
    .select({ p: schema.proposition, prenom: schema.candidat.prenom, nom: schema.candidat.nom, telephone: schema.candidat.telephone, whatsapp: schema.candidat.whatsapp, supprimeLe: schema.candidat.supprimeLe })
    .from(schema.proposition)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .where(eq(schema.proposition.dossierId, dossierId))
    .orderBy(asc(schema.proposition.creeLe), asc(schema.proposition.id));
  const placements = await db.select().from(schema.placement).where(eq(schema.placement.dossierId, dossierId)).orderBy(asc(schema.placement.id));
  const ids = props.map((x) => x.p.id);
  const liens = ids.length
    ? await db
        .select({ id: schema.accesProfil.id, propositionId: schema.accesProfil.propositionId, objet: schema.accesProfil.objet, expireLe: schema.accesProfil.expireLe, creeLe: schema.accesProfil.creeLe })
        .from(schema.accesProfil)
        .where(and(inArray(schema.accesProfil.propositionId, ids), isNull(schema.accesProfil.revoqueLe), sql`${schema.accesProfil.expireLe} > ${maintenant}`))
        .orderBy(desc(schema.accesProfil.creeLe))
    : [];
  const etat = await calculerEtat(db, d, maintenant);
  const vuePlacement = (pl: (typeof placements)[number]) => ({
    id: pl.id,
    statut: pl.statut,
    libelleStatut: STATUTS_PLACEMENT[pl.statut],
    datePrevue: pl.datePrevue,
    poste: pl.poste,
    salaire: voirSalaire ? pl.salaire : null,
    remplacement: pl.remplacement,
    remplacePlacementId: pl.remplacePlacementId,
    confirmeLe: pl.confirmeLe,
    confirmationMode: pl.confirmationMode,
    datePriseDePoste: pl.datePriseDePoste,
    signataire: pl.signataireNom ? `${pl.signataireNom}${pl.signataireFonction ? `, ${pl.signataireFonction}` : ''}` : null,
    preuve: !!pl.preuveCle,
    finLe: pl.finLe,
    finMotif: pl.finMotif,
  });
  const vues = props.map(({ p, prenom, nom, telephone, whatsapp, supprimeLe }) => ({
    id: p.id,
    lignePosteId: p.lignePosteId,
    candidatId: p.candidatId,
    candidat: supprimeLe ? pseudonyme(p.candidatId) : `${prenom} ${nom}`,
    candidatSupprime: !!supprimeLe,
    numeroCandidat: supprimeLe ? null : (whatsapp ?? telephone),
    statut: p.statut,
    libelleStatut: STATUTS_PROPOSITION[p.statut],
    creeLe: p.creeLe,
    accordMode: p.accordMode,
    accordLe: p.accordLe,
    accordPreuve: !!p.accordPreuveCle,
    numeroCommunicable: p.numeroCommunicable,
    salaireCommunicable: p.salaireCommunicable,
    motif: p.motif,
    reponseLe: p.reponseLe,
    relanceAccordLe: p.relanceAccordLe,
    entretienLe: p.entretienLe,
    entretienLieu: p.entretienLieu,
    retourClient: p.retourClient,
    retourClientMotif: p.retourClientMotif,
    retourClientLe: p.retourClientLe,
    accesRevoqueLe: p.accesRevoqueLe,
    remplacePlacementId: p.remplacePlacementId,
    placements: placements.filter((pl) => pl.propositionId === p.id).map(vuePlacement),
    liens: liens.filter((l) => l.propositionId === p.id),
  }));
  // RG-18 : placements rompus pendant la garantie sans remplaçant (ni proposition de remplacement active).
  const remplacementsAPourvoir = placements
    .filter((pl) => pl.statut === 'rompu_garantie')
    .filter((pl) => !placements.some((x) => x.remplacePlacementId === pl.id && x.statut !== 'abandonne'))
    .filter((pl) => !props.some((x) => x.p.remplacePlacementId === pl.id && !STATUTS_PROPOSITION_INACTIFS.includes(x.p.statut)))
    .map((pl) => {
      const v = vues.find((x) => x.id === pl.propositionId);
      return { placementId: pl.id, lignePosteId: pl.lignePosteId, libelle: `${v?.candidat ?? ''} — ${pl.poste}` };
    });
  return {
    dossier: { id: d.id, numero: d.numero, statut: d.statut, referentId: d.referentId, clientId: d.clientId },
    voirSalaire,
    lignes: etat.lignes.map((l) => ({ ...l, propositions: vues.filter((v) => v.lignePosteId === l.id) })),
    remplacementsAPourvoir,
    etat,
  };
}

export type PropositionsDossier = NonNullable<Awaited<ReturnType<typeof lirePropositionsDossier>>>;
export type VueProposition = PropositionsDossier['lignes'][number]['propositions'][number];

/** Propositions et placements d'un candidat (fiche candidat ; accès au vivier vérifié par l'appelant). */
export async function propositionsDuCandidat(candidatId: number, a: Demandeur) {
  const db = getDb();
  const lignes = await db
    .select({
      id: schema.proposition.id,
      statut: schema.proposition.statut,
      creeLe: schema.proposition.creeLe,
      accordMode: schema.proposition.accordMode,
      dossierId: schema.dossier.id,
      numero: schema.dossier.numero,
      referentId: schema.dossier.referentId,
      client: schema.client.nom,
      intitule: schema.lignePoste.intitule,
    })
    .from(schema.proposition)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.proposition.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.proposition.clientId))
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, schema.proposition.lignePosteId))
    .where(eq(schema.proposition.candidatId, candidatId))
    .orderBy(desc(schema.proposition.creeLe));
  const placements = lignes.length
    ? await db
        .select({ propositionId: schema.placement.propositionId, statut: schema.placement.statut, datePrevue: schema.placement.datePrevue, datePriseDePoste: schema.placement.datePriseDePoste, remplacement: schema.placement.remplacement })
        .from(schema.placement)
        .where(eq(schema.placement.candidatId, candidatId))
    : [];
  return lignes.map(({ referentId, ...l }) => ({
    ...l,
    libelleStatut: STATUTS_PROPOSITION[l.statut],
    voirDossier: peutVoir(a, referentId),
    placements: placements.filter((p) => p.propositionId === l.id).map((p) => ({ ...p, libelleStatut: STATUTS_PLACEMENT[p.statut] })),
  }));
}

/** Dossiers REC où l'utilisateur peut proposer un candidat (statut RG-02), avec leurs lignes. */
export async function dossiersPourProposition(a: Demandeur) {
  const db = getDb();
  const direction = a.roles.includes('direction');
  const dossiers = await db
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, referentId: schema.dossier.referentId, client: schema.client.nom })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .where(and(eq(schema.dossier.type, 'REC'), inArray(schema.dossier.statut, [...STATUTS_DOSSIER_PROPOSITION]), direction ? undefined : eq(schema.dossier.referentId, a.id)))
    .orderBy(desc(schema.dossier.creeLe))
    .limit(200);
  const traitables = dossiers.filter((d) => peutTraiter(a, d.referentId));
  if (!traitables.length) return [];
  const lignes = await db
    .select({ id: schema.lignePoste.id, dossierId: schema.lignePoste.dossierId, intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre })
    .from(schema.lignePoste)
    .where(inArray(schema.lignePoste.dossierId, traitables.map((d) => d.id)))
    .orderBy(asc(schema.lignePoste.ordre));
  return traitables.map(({ referentId: _r, ...d }) => ({ ...d, lignes: lignes.filter((l) => l.dossierId === d.id).map(({ dossierId: _d, ...l }) => l) }));
}

/**
 * « Proposer un candidat » depuis un Dossier : recherche simple dans le vivier par nom, téléphone ou
 * métier (normalisation de lib/candidats/recherche.ts). Ni supprimés, ni indisponibles.
 */
export async function chercherCandidatsAProposer(q: string, a: ActeurProposition, limite = 20) {
  if (!(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier(MESSAGE_VIVIER);
  const mots = motsRecherche(q);
  if (!mots.length) return [];
  const c = schema.candidat;
  const texte = sql`translate(lower(concat_ws(' ', ${c.prenom}, ${c.nom}, ${c.telephone}, array_to_string(${c.metiers}, ' '))), ${ACCENTS}, ${SANS_ACCENTS})`;
  return getDb()
    .select({ id: c.id, prenom: c.prenom, nom: c.nom, statut: c.statut, metiers: c.metiers, ville: schema.ville.nom, villeAutre: c.villeAutre })
    .from(c)
    .leftJoin(schema.ville, eq(schema.ville.id, c.villeId))
    .where(and(isNull(c.supprimeLe), isNull(c.suppressionDemandeeLe), ne(c.statut, 'indisponible'), ...mots.map((m) => sql`${texte} like ${`%${echapperLike(m)}%`}`)))
    .orderBy(desc(c.profilMisAJourLe), desc(c.id))
    .limit(limite);
}

// ─── Tâches planifiées ────────────────────────────────────────

/**
 * MVP2-01 RG-14 : Proposition « en attente d'accord » sans réponse du candidat depuis 72 h →
 * notification au référent du Dossier, une seule fois (`relanceAccordLe`).
 */
export async function signalerAccordsSansReponse(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const limite = new Date(maintenant.getTime() - DELAI_REPONSE_CANDIDAT_HEURES * 60 * 60 * 1000);
  const enAttente = await db
    .select({ id: schema.proposition.id })
    .from(schema.proposition)
    .where(and(eq(schema.proposition.statut, 'en_attente_accord'), isNull(schema.proposition.relanceAccordLe), lt(schema.proposition.creeLe, limite)));
  let n = 0;
  for (const { id } of enAttente) {
    await db.transaction(async (tx) => {
      const p = await chargerProposition(tx, id);
      if (p.statut !== 'en_attente_accord') return;
      const [r] = await tx.select({ relance: schema.proposition.relanceAccordLe }).from(schema.proposition).where(eq(schema.proposition.id, id));
      if (r?.relance) return;
      await tx.update(schema.proposition).set({ relanceAccordLe: maintenant }).where(eq(schema.proposition.id, id));
      await notifier(
        {
          destinataires: [p.referentId],
          type: 'proposition_sans_reponse',
          dossierId: p.dossierId,
          titre: 'Proposition sans réponse du candidat',
          texte: `${p.libelle} (${p.numero}, ${p.client}) : pas de réponse du candidat depuis ${DELAI_REPONSE_CANDIDAT_HEURES} h. Relancez-le (modèle « ${MODELE_PROPOSITION_POSTE} ») ou enregistrez son accord WhatsApp.`,
          lien: lienPropositionsDossier(p.dossierId),
          cle: `proposition_sans_reponse:${id}`,
        },
        tx,
      );
      n++;
    });
  }
  return n;
}

/**
 * RG-20 : alerte au référent 5 jours avant l'échéance du délai de recherche, une seule fois
 * (`alerteEcheanceLe`). Dossiers REC en recherche, non clôturés, acompte encaissé.
 */
export async function alerterEcheancesRecherche(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const delaiParDefaut = await lireParametre('delai_recherche_jours');
  const dossiers = await db
    .select()
    .from(schema.dossier)
    .where(and(eq(schema.dossier.type, 'REC'), inArray(schema.dossier.statut, [...STATUTS_DOSSIER_PROPOSITION]), isNull(schema.dossier.alerteEcheanceLe), isNull(schema.dossier.rechercheClotureLe), isNotNull(schema.dossier.referentId)));
  let n = 0;
  for (const d of dossiers) {
    const etat = await calculerEtat(db, d, maintenant, delaiParDefaut);
    if (!etat.echeance || !alerteEcheanceDue(etat.echeance, maintenant)) continue;
    const jours = Math.ceil((etat.echeance.getTime() - maintenant.getTime()) / JOUR_MS);
    const places = etat.lignes.reduce((s, l) => s + Math.min(l.places, l.nombre), 0);
    const demandes = etat.lignes.reduce((s, l) => s + l.nombre, 0);
    const quand = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long' }).format(etat.echeance);
    await db.transaction(async (tx) => {
      const [x] = await tx.select({ alerte: schema.dossier.alerteEcheanceLe }).from(schema.dossier).where(eq(schema.dossier.id, d.id)).for('update');
      if (x?.alerte) return;
      await tx.update(schema.dossier).set({ alerteEcheanceLe: maintenant }).where(eq(schema.dossier.id, d.id));
      await notifier(
        {
          destinataires: [d.referentId],
          type: 'echeance_recherche',
          dossierId: d.id,
          titre: `Échéance de la recherche : ${d.numero}`,
          texte: `${jours > 0 ? `La recherche arrive à échéance le ${quand} (dans ${jours} jour${jours > 1 ? 's' : ''})` : `La recherche est arrivée à échéance le ${quand}`} : ${places} placé(s) sur ${demandes} demandé(s)${etat.annonces.length ? `, ${etat.annonces.length} placement(s) encore annoncé(s)` : ''}. Pensez à clôturer la recherche.`,
          lien: lienOngletPropositions(d.id),
          cle: `echeance_recherche:${d.id}`,
          email: true,
        },
        tx,
      );
      n++;
    });
  }
  return n;
}
