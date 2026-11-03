// Tâches planifiées (MVP1-05) : escalade des dossiers non attribués (RG-06), récapitulatif
// quotidien des dossiers sans action (RG-11), reprise des e-mails en attente (RG-13).
// Exécution toutes les 15 minutes ; chaque tâche est idempotente (clés de notification).
import { and, eq, isNotNull, isNull, lt, notInArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { lireParametre } from '@/lib/parametres';
import { envoyerNotificationsEnAttente, idsDirection, notifier } from '@/lib/notifications';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { dateLocale, estApresHuitHeuresUnJourOuvre, prochaineEscalade } from '@/lib/dossiers/heures-ouvrees';
import { STATUTS_FINAUX } from '@/lib/dossiers/statuts';
import { executerSuppressionsDues } from '@/lib/candidats/service';

const JOUR_MS = 24 * 60 * 60 * 1000;

export async function escaladerNonAttribues(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const [horaires, delai] = await Promise.all([lireParametre('heures_ouvrees'), lireParametre('delai_escalade_heures')]);
  const enFile = await db
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, type: schema.dossier.type, enFileDepuis: schema.dossier.enFileDepuis, derniereRelanceLe: schema.dossier.derniereRelanceLe, client: schema.client.nom, villeNom: schema.ville.nom, villeAutre: schema.dossier.villeAutre })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(and(isNull(schema.dossier.referentId), isNotNull(schema.dossier.enFileDepuis), notInArray(schema.dossier.statut, [...STATUTS_FINAUX])));
  const direction = enFile.length ? await idsDirection() : [];
  let n = 0;
  for (const d of enFile) {
    const echeance = prochaineEscalade(d.enFileDepuis!, d.derniereRelanceLe, delai, horaires);
    if (maintenant < echeance) continue;
    await db.transaction(async (tx) => {
      await notifier(
        {
          destinataires: direction,
          type: 'escalade',
          dossierId: d.id,
          titre: `Toujours non attribué : ${d.numero}`,
          texte: `Ce dossier attend un référent depuis le ${d.enFileDepuis!.toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'short', timeStyle: 'short' })} :\n${d.numero} — ${DOSSIER_TYPES[d.type]} — ${d.villeNom ?? d.villeAutre ?? 'ville non précisée'} — ${d.client}`,
          lien: `/admin/attribution`,
          cle: `escalade:${d.id}:${echeance.toISOString()}`,
          email: true,
          inApp: false,
        },
        tx,
      );
      await tx.update(schema.dossier).set({ derniereRelanceLe: maintenant }).where(eq(schema.dossier.id, d.id));
    });
    n++;
  }
  return n;
}

export async function signalerSansAction(maintenant = new Date()): Promise<number> {
  const [horaires, jours] = await Promise.all([lireParametre('heures_ouvrees'), lireParametre('jours_sans_action')]);
  if (!estApresHuitHeuresUnJourOuvre(maintenant, horaires)) return 0;
  const db = getDb();
  const jour = dateLocale(maintenant);
  const dossiers = await db
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, referentId: schema.dossier.referentId, derniereActionLe: schema.dossier.derniereActionLe, client: schema.client.nom })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .innerJoin(schema.user, eq(schema.user.id, schema.dossier.referentId))
    .where(and(isNotNull(schema.dossier.referentId), eq(schema.user.active, true), notInArray(schema.dossier.statut, [...STATUTS_FINAUX]), lt(schema.dossier.derniereActionLe, new Date(maintenant.getTime() - jours * JOUR_MS))));
  const parReferent = new Map<string, typeof dossiers>();
  for (const d of dossiers) parReferent.set(d.referentId!, [...(parReferent.get(d.referentId!) ?? []), d]);
  for (const [referentId, liste] of parReferent) {
    await db.transaction(async (tx) => {
      for (const d of liste) {
        const n = Math.floor((maintenant.getTime() - d.derniereActionLe.getTime()) / JOUR_MS);
        await notifier({ destinataires: [referentId], type: 'sans_action', dossierId: d.id, titre: `Sans action depuis ${n} jours : ${d.numero}`, texte: `${d.numero} — ${d.client}`, lien: `/admin/dossiers/${d.id}`, cle: `sans_action:${d.id}:${jour}` }, tx);
      }
      await notifier(
        {
          destinataires: [referentId],
          type: 'recap_sans_action',
          titre: `${liste.length} dossier(s) sans action depuis ${jours} jours ou plus`,
          texte: `Dossiers à relancer :\n${liste.map((d) => `- ${d.numero} — ${d.client}`).join('\n')}`,
          lien: '/admin/dossiers',
          cle: `recap:${jour}`,
          email: true,
          inApp: false,
        },
        tx,
      );
    });
  }
  return dossiers.length;
}

export async function executerTaches(maintenant = new Date()) {
  const escalades = await escaladerNonAttribues(maintenant);
  const sansAction = await signalerSansAction(maintenant);
  // MVP2-01 RG-16 : suppressions de comptes candidats arrivées à échéance.
  const suppressionsCandidats = await executerSuppressionsDues(maintenant);
  const emails = await envoyerNotificationsEnAttente(200);
  return { escalades, sansAction, suppressionsCandidats, emails };
}

