// Escalade du vivier (MVP2-02 RG-03), exécutée par les tâches planifiées (lib/taches.ts) :
// - candidats non attribués : relance de la Direction après 4 h ouvrées (paramètre
//   `delai_escalade_heures`), puis chaque jour ouvré à 8 h — comme les Dossiers (MVP1-05 RG-06) ;
// - « N nouveaux candidats non traités depuis 5 jours ouvrés » : alerte au référent, une fois par
//   candidat et par période de 5 jours ouvrés (`alerteNonTraiteLe`).
// Chaque tâche est idempotente : la date de relance est mise à jour dans la transaction de la
// notification, et la clé de notification empêche les doublons d'exécutions simultanées.
import { createHash } from 'node:crypto';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { lireParametre, type HeuresOuvrees } from '@/lib/parametres';
import { idsDirection, notifier } from '@/lib/notifications';
import { dateLocale, estApresHuitHeuresUnJourOuvre, prochaineEscalade } from '@/lib/dossiers/heures-ouvrees';

/** RG-03 : un candidat `nouveau` est « non traité » au-delà de ce nombre de jours ouvrés. */
export const JOURS_OUVRES_NON_TRAITE = 5;
/** Nombre de noms cités dans une notification groupée. */
const NOMS_CITES = 15;

const DECALAGE_MS = 60 * 60 * 1000; // Africa/Douala = UTC+1, sans heure d'été.
const JOUR_MS = 24 * 60 * 60 * 1000;
const jourSemaine = (t: number) => new Date(t + DECALAGE_MS).getUTCDay();

/**
 * Même heure, `jours` jours ouvrés plus tard (un jour est ouvré s'il a une plage dans
 * `heures_ouvrees`). Ex. : vendredi 10 h + 5 jours ouvrés (lundi–samedi) = jeudi 10 h.
 */
export function ajouterJoursOuvres(debut: Date, jours: number, horaires: HeuresOuvrees): Date {
  if (!horaires.some(Boolean)) throw new Error('Aucun jour ouvré configuré');
  let t = debut.getTime();
  for (let restant = jours, garde = 0; restant > 0; garde++) {
    if (garde > 400) throw new Error('Calcul de jours ouvrés interrompu');
    t += JOUR_MS;
    if (horaires[jourSemaine(t)]) restant--;
  }
  return new Date(t);
}

/** Échéance de la prochaine alerte « non traité » : 5 jours ouvrés après l'attribution, puis après chaque alerte. */
export function echeanceAlerteNonTraite(depuis: { attribueLe: Date | null; creeLe: Date; alerteNonTraiteLe: Date | null }, horaires: HeuresOuvrees): Date {
  return ajouterJoursOuvres(depuis.alerteNonTraiteLe ?? depuis.attribueLe ?? depuis.creeLe, JOURS_OUVRES_NON_TRAITE, horaires);
}

const empreinte = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const nomComplet = (x: { prenom: string; nom: string }) => `${x.prenom} ${x.nom}`;
const liste = (noms: string[]) => noms.slice(0, NOMS_CITES).map((n) => `- ${n}`).join('\n') + (noms.length > NOMS_CITES ? `\n… et ${noms.length - NOMS_CITES} autre(s)` : '');

/** Candidats en file « Non attribués » depuis le délai d'escalade : un e-mail groupé à la Direction. */
export async function escaladerCandidatsNonAttribues(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const [horaires, delai] = await Promise.all([lireParametre('heures_ouvrees'), lireParametre('delai_escalade_heures')]);
  const enFile = await db
    .select({ id: schema.candidat.id, nom: schema.candidat.nom, prenom: schema.candidat.prenom, enFileDepuis: schema.candidat.enFileDepuis, derniereRelanceLe: schema.candidat.derniereRelanceLe, villeNom: schema.ville.nom, villeAutre: schema.candidat.villeAutre })
    .from(schema.candidat)
    .leftJoin(schema.ville, eq(schema.ville.id, schema.candidat.villeId))
    .where(and(isNull(schema.candidat.referentId), isNotNull(schema.candidat.enFileDepuis), isNull(schema.candidat.supprimeLe)));
  const dus = enFile
    .map((x) => ({ ...x, echeance: prochaineEscalade(x.enFileDepuis!, x.derniereRelanceLe, delai, horaires) }))
    .filter((x) => maintenant >= x.echeance)
    .sort((a, b) => a.enFileDepuis!.getTime() - b.enFileDepuis!.getTime() || a.id - b.id);
  if (!dus.length) return 0;
  const direction = await idsDirection();
  await db.transaction(async (tx) => {
    await notifier(
      {
        destinataires: direction,
        type: 'escalade_candidats',
        titre: `${dus.length} candidat(s) toujours non attribué(s)`,
        texte: `Ces candidats attendent un référent recrutement :\n${liste(dus.map((x) => `${nomComplet(x)} — ${x.villeNom ?? x.villeAutre ?? 'ville non précisée'} — en file depuis le ${x.enFileDepuis!.toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'short' })}`))}`,
        lien: '/admin/candidats?onglet=non_attribues',
        cle: `escalade_candidats:${empreinte(dus.map((x) => `${x.id}@${x.echeance.toISOString()}`).join(','))}`,
        email: true,
        inApp: false,
      },
      tx,
    );
    for (const x of dus) await tx.update(schema.candidat).set({ derniereRelanceLe: maintenant }).where(eq(schema.candidat.id, x.id));
  });
  return dus.length;
}

/**
 * « N nouveaux candidats non traités depuis 5 jours ouvrés » : une notification par référent
 * (in-app + e-mail), chaque jour ouvré à partir de 8 h, pour les candidats dont l'échéance est passée.
 */
export async function alerterCandidatsNonTraites(maintenant = new Date()): Promise<number> {
  const horaires = await lireParametre('heures_ouvrees');
  if (!estApresHuitHeuresUnJourOuvre(maintenant, horaires)) return 0;
  const db = getDb();
  const candidats = await db
    .select({ id: schema.candidat.id, nom: schema.candidat.nom, prenom: schema.candidat.prenom, referentId: schema.candidat.referentId, attribueLe: schema.candidat.attribueLe, creeLe: schema.candidat.creeLe, alerteNonTraiteLe: schema.candidat.alerteNonTraiteLe })
    .from(schema.candidat)
    .innerJoin(schema.user, eq(schema.user.id, schema.candidat.referentId))
    .where(and(eq(schema.candidat.statut, 'nouveau'), isNull(schema.candidat.supprimeLe), eq(schema.user.active, true)));
  const parReferent = new Map<string, typeof candidats>();
  for (const x of candidats) {
    if (maintenant < echeanceAlerteNonTraite(x, horaires)) continue;
    parReferent.set(x.referentId!, [...(parReferent.get(x.referentId!) ?? []), x]);
  }
  let n = 0;
  const jour = dateLocale(maintenant);
  for (const [referentId, dus] of parReferent) {
    dus.sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime() || a.id - b.id);
    await db.transaction(async (tx) => {
      await notifier(
        {
          destinataires: [referentId],
          type: 'candidats_non_traites',
          titre: `${dus.length} nouveau(x) candidat(s) non traité(s) depuis ${JOURS_OUVRES_NON_TRAITE} jours ouvrés`,
          texte: `Ces candidats attendent toujours un premier traitement (statut « Nouveau ») :\n${liste(dus.map(nomComplet))}`,
          lien: '/admin/candidats',
          cle: `candidats_non_traites:${jour}:${empreinte(dus.map((x) => x.id).join(','))}`,
          email: true,
        },
        tx,
      );
      for (const x of dus) await tx.update(schema.candidat).set({ alerteNonTraiteLe: maintenant }).where(eq(schema.candidat.id, x.id));
    });
    n += dus.length;
  }
  return n;
}
