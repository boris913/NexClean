// Conservation des profils candidats (ADR 0017 §4, specs/POST-04 RG-01..08), exécutée par les
// tâches planifiées (lib/taches.ts) : relance à 24 mois d'inactivité (e-mail, notification dans
// l'espace, alerte au référent pour un message WhatsApp), annulation de la relance dès que le
// candidat se manifeste, anonymisation 30 jours après une relance restée sans réponse.
// Les règles sont dans ./donnees.ts (pur) ; ce module lit l'état en base et applique la décision.
// Idempotent : chaque effet est conditionné par l'état en base (relance posée une fois, annulée
// une fois, effacement sous verrou après revérification).
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { envoyerEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { idsDirection, notifier } from '@/lib/notifications';
import { STATUTS_EN_COURS } from '@/lib/propositions/domaine';
import { notifierCandidat, type Tx } from '@/lib/propositions/effets';
import { peutAccederVivier } from './acces';
import { lienFicheCandidat, type ActeurVivier } from './attribution';
import { anonymisationPrevueLe, decisionConservation, limiteInactivite, MODELE_RELANCE_INACTIVITE, TEXTES_CONSERVATION, type EtatConservation } from './donnees';
import { effacerDonneesCandidat, texteVersHtml } from './service';

/** Nombre maximal de candidats examinés par passage (la tâche tourne toutes les 15 minutes). */
const LOT = 200;

const c = schema.candidat;
const p = schema.proposition;
const pl = schema.placement;
const k = schema.candidature;

/**
 * Identifiant du candidat de la requête externe, toujours qualifié. Dans une sélection sur une
 * seule table, Drizzle réécrit les colonnes en noms non qualifiés : `${c.id}` deviendrait `"id"`,
 * qui, dans une sous-requête sur `proposition`, désignerait `proposition.id` (corrélation perdue).
 */
const idCandidat = sql`${sql.identifier('candidat')}.${sql.identifier('id')}`;

/** RG-01 : dernière activité, calculée en base (greatest ignore les valeurs nulles). */
const activite = sql<Date>`greatest(
  ${c.creeLe}, ${c.profilMisAJourLe}, ${c.derniereConnexionLe}, ${c.conservationConfirmeeLe},
  (select max(${k.creeLe}) from ${k} where ${k.candidatId} = ${idCandidat}),
  (select max(${p.reponseLe}) from ${p} where ${p.candidatId} = ${idCandidat}),
  (select max(${pl.confirmeLe}) from ${pl} where ${pl.candidatId} = ${idCandidat})
)`.mapWith(c.creeLe);

/** RG-06 : Proposition en cours ou Placement annoncé non encore confirmé. */
const processusActif = sql<boolean>`(
  exists (select 1 from ${p} where ${p.candidatId} = ${idCandidat} and ${inArray(p.statut, [...STATUTS_EN_COURS])})
  or exists (select 1 from ${pl} where ${pl.candidatId} = ${idCandidat} and ${eq(pl.statut, 'annonce')})
)`.mapWith(Boolean);

const colonnes = {
  id: c.id,
  prenom: c.prenom,
  nom: c.nom,
  email: c.email,
  referentId: c.referentId,
  relanceLe: c.relanceInactiviteLe,
  suppressionDemandeeLe: c.suppressionDemandeeLe,
  supprimeLe: c.supprimeLe,
  derniereActivite: activite,
  processusActif,
};

type LigneEtat = { relanceLe: Date | null; suppressionDemandeeLe: Date | null; supprimeLe: Date | null; derniereActivite: Date; processusActif: boolean };
const versEtat = (l: LigneEtat): EtatConservation => ({
  derniereActivite: l.derniereActivite,
  relanceLe: l.relanceLe,
  processusActif: l.processusActif,
  suppressionDemandee: !!l.suppressionDemandeeLe,
  supprime: !!l.supprimeLe,
});

/** Destinataires de l'alerte : le référent s'il est actif, sinon la Direction. */
async function destinatairesAlerte(tx: Tx, referentId: string | null): Promise<string[]> {
  if (referentId) {
    const [u] = await tx.select({ active: schema.user.active }).from(schema.user).where(eq(schema.user.id, referentId));
    if (u?.active) return [referentId];
  }
  return idsDirection(tx);
}

const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long' }).format(d);

type Candidat = { id: number; prenom: string; nom: string; email: string | null; referentId: string | null; derniereActivite: Date };

/** RG-03 : relance (posée une seule fois grâce à la condition `relance_inactivite_le is null`). */
async function relancer(x: Candidat, maintenant: Date): Promise<boolean> {
  const fait = await getDb().transaction(async (tx) => {
    const [posee] = await tx
      .update(c)
      .set({ relanceInactiviteLe: maintenant })
      .where(and(eq(c.id, x.id), isNull(c.relanceInactiviteLe), isNull(c.supprimeLe), isNull(c.suppressionDemandeeLe)))
      .returning({ id: c.id });
    if (!posee) return false;
    const echeance = anonymisationPrevueLe(maintenant);
    await notifierCandidat(tx, x.id, { ...TEXTES_CONSERVATION.notificationRelance(maintenant), lien: '/candidat/espace/profil', cle: `relance_inactivite:${maintenant.toISOString()}` });
    await notifier(
      {
        destinataires: await destinatairesAlerte(tx, x.referentId),
        type: 'relance_inactivite_candidat',
        titre: `Profil inactif depuis 2 ans : ${x.prenom} ${x.nom}`,
        texte: `${x.prenom} ${x.nom} ne s'est pas connecté(e) et n'a pas mis son profil à jour depuis le ${dateCourte(x.derniereActivite)}.\nEnvoyez-lui le message WhatsApp « ${MODELE_RELANCE_INACTIVITE.nom} » depuis sa fiche${x.email ? ' (un e-mail lui a aussi été envoyé)' : ''}.\nS'il vous répond, cliquez « Le candidat a répondu » sur sa fiche. Sans réponse ni connexion d'ici le ${dateCourte(echeance)}, ses données seront anonymisées automatiquement.`,
        lien: lienFicheCandidat(x.id),
        cle: `relance_inactivite:${x.id}:${maintenant.toISOString()}`,
        email: true,
      },
      tx,
    );
    await journaliser(
      { acteurType: 'systeme', action: 'candidat.relance_inactivite', objetType: 'candidat', objetId: x.id, details: { derniereActivite: x.derniereActivite.toISOString(), anonymisationPrevueLe: echeance.toISOString(), email: !!x.email } },
      tx,
    );
    return true;
  });
  if (fait && x.email) {
    const contenu = TEXTES_CONSERVATION.emailRelance(x.prenom, maintenant, `${env().BETTER_AUTH_URL}/candidat/connexion`);
    await envoyerEmail({ to: x.email, ...contenu, html: texteVersHtml(contenu.text) }).catch((e) => console.error('[conservation] e-mail de relance', e));
  }
  return fait;
}

/** RG-04, RG-06 : annulation (une seule fois : la relance lue doit être celle en base). */
async function annulerRelance(x: { id: number }, relanceLe: Date, raison: 'activite' | 'processus_actif'): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [annulee] = await tx
      .update(c)
      .set({ relanceInactiviteLe: null })
      .where(and(eq(c.id, x.id), eq(c.relanceInactiviteLe, relanceLe)))
      .returning({ id: c.id });
    if (!annulee) return false;
    await journaliser({ acteurType: 'systeme', action: 'candidat.relance_inactivite_annulee', objetType: 'candidat', objetId: x.id, details: { raison, relanceLe: relanceLe.toISOString() } }, tx);
    return true;
  });
}

/** RG-05 : anonymisation, après revérification de la décision sous verrou (connexion de dernière minute). */
async function anonymiser(x: Candidat, maintenant: Date): Promise<boolean> {
  return effacerDonneesCandidat(x, maintenant, 'inactivite', async (tx) => {
    const [l] = await tx.select(colonnes).from(c).where(eq(c.id, x.id));
    return !!l && decisionConservation(versEtat(l), maintenant) === 'anonymiser';
  });
}

export interface BilanConservation {
  relances: number;
  annulations: number;
  anonymisations: number;
}

/** Tâche planifiée (RG-02..07). */
export async function appliquerConservation(maintenant = new Date()): Promise<BilanConservation> {
  const limite = limiteInactivite(maintenant);
  const lignes = await getDb()
    .select(colonnes)
    .from(c)
    .where(and(isNull(c.supprimeLe), isNull(c.suppressionDemandeeLe), or(isNotNull(c.relanceInactiviteLe), sql`${activite} <= ${limite.toISOString()}::timestamptz`)))
    .orderBy(c.id)
    .limit(LOT);
  const bilan: BilanConservation = { relances: 0, annulations: 0, anonymisations: 0 };
  for (const l of lignes) {
    const decision = decisionConservation(versEtat(l), maintenant);
    try {
      if (decision === 'relancer' && (await relancer(l, maintenant))) bilan.relances++;
      else if (decision === 'annuler_relance' && (await annulerRelance(l, l.relanceLe!, l.processusActif && l.derniereActivite <= l.relanceLe! ? 'processus_actif' : 'activite'))) bilan.annulations++;
      else if (decision === 'anonymiser' && (await anonymiser(l, maintenant))) bilan.anonymisations++;
    } catch (e) {
      // Un candidat en erreur ne bloque pas les autres ; il est repris au passage suivant.
      console.error(`[conservation] candidat ${l.id}`, e);
    }
  }
  return bilan;
}

/**
 * RG-04 : le candidat a répondu à la relance par WhatsApp. Le référent (ou la Direction) le note
 * sur la fiche ; cela vaut activité et annule la relance au passage suivant de la tâche.
 */
export async function confirmerConservation(candidatId: number, a: ActeurVivier, maintenant = new Date()): Promise<void> {
  if (!(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier('Accès réservé aux référents recrutement et à la Direction.');
  await getDb().transaction(async (tx) => {
    const [x] = await tx.select({ relanceLe: c.relanceInactiviteLe, supprimeLe: c.supprimeLe, suppression: c.suppressionDemandeeLe }).from(c).where(eq(c.id, candidatId)).for('update');
    if (!x || x.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
    if (x.suppression) throw new ErreurMetier('La suppression de ce compte est en cours.');
    if (!x.relanceLe) throw new ErreurMetier('Aucune relance d’inactivité en cours pour ce candidat.');
    await tx.update(c).set({ conservationConfirmeeLe: maintenant }).where(eq(c.id, candidatId));
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.conservation_confirmee', objetType: 'candidat', objetId: candidatId, details: { relanceLe: x.relanceLe.toISOString() } }, tx);
  });
}
