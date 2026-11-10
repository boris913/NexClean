// Rendez-vous commerciaux (specs/COM1-02 RG-01..03) : planification, suivi, agenda et rappels.
// Indépendant de Next.js : utilisé par les actions serveur, la tâche planifiée et les tests.
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { estFinal } from '@/lib/dossiers/statuts';
import { notifier } from '@/lib/notifications';
import { peut } from '@/lib/authz/permissions';
import {
  estACloturer,
  instantDouala,
  libelleDebut,
  libelleHeure,
  rappelsDus,
  RDV_STATUT_CODES,
  RDV_STATUTS,
  RDV_TYPE_CODES,
  RDV_TYPES,
  DELAI_A_CLOTURER_MS,
  type RdvStatut,
} from './domaine';

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export interface Acteur extends Demandeur {
  ip?: string | null;
}
export type RendezVous = typeof schema.rendezVous.$inferSelect;

const auteurAudit = (a: Acteur) => ({ acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null });

export const schemaRendezVous = z.object({
  type: z.enum(RDV_TYPE_CODES),
  jour: z.string(),
  heure: z.string(),
  dureeMinutes: z.coerce.number().int().min(15, 'Durée minimale : 15 min').max(600, 'Durée maximale : 10 h').default(60),
  lieu: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  participants: z.array(z.string().min(1)).max(10).default([]),
});
export type SaisieRendezVous = z.input<typeof schemaRendezVous>;

function lireSaisie(entree: SaisieRendezVous) {
  const s = schemaRendezVous.parse(entree);
  const debut = instantDouala(s.jour, s.heure);
  if (!debut) throw new ErreurMetier('Date ou heure invalide.');
  return { ...s, debut, participants: [...new Set(s.participants)] };
}

async function dossierPourEcriture(tx: Tx, dossierId: number, a: Acteur) {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
  return d;
}

async function rdvPourEcriture(tx: Tx, id: number, a: Acteur) {
  const [r] = await tx.select().from(schema.rendezVous).where(eq(schema.rendezVous.id, id)).for('update');
  if (!r) throw new ErreurMetier('Rendez-vous introuvable.');
  const d = await dossierPourEcriture(tx, r.dossierId, a);
  return { r, d };
}

async function verifierParticipants(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  const actifs = await tx.select({ id: schema.user.id }).from(schema.user).where(and(inArray(schema.user.id, ids), eq(schema.user.active, true)));
  if (actifs.length !== ids.length) throw new ErreurMetier('Participant inconnu ou inactif.');
}

async function evenement(tx: Tx, dossierId: number, a: Acteur, commentaire: string) {
  await tx.insert(schema.evenementDossier).values({ dossierId, auteurId: a.id, type: 'rendez_vous', commentaire });
  await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, dossierId));
}

const resume = (r: { type: keyof typeof RDV_TYPES; debut: Date; lieu: string | null }) => `${RDV_TYPES[r.type]} le ${libelleDebut(r.debut)}${r.lieu ? ` — ${r.lieu}` : ''}`;

/** RG-01 : nouveau rendez-vous sur un dossier ouvert. */
export async function planifierRendezVous(dossierId: number, entree: SaisieRendezVous, a: Acteur, maintenant = new Date()): Promise<number> {
  const s = lireSaisie(entree);
  if (s.debut <= maintenant) throw new ErreurMetier('Le rendez-vous doit être dans le futur.');
  return getDb().transaction(async (tx) => {
    const d = await dossierPourEcriture(tx, dossierId, a);
    if (estFinal(d.statut)) throw new ErreurMetier('Dossier clos : impossible de planifier un rendez-vous.');
    await verifierParticipants(tx, s.participants);
    const [r] = await tx
      .insert(schema.rendezVous)
      .values({ dossierId, type: s.type, debut: s.debut, planifieLe: maintenant, dureeMinutes: s.dureeMinutes, lieu: s.lieu, participants: s.participants, creePar: a.id })
      .returning({ id: schema.rendezVous.id });
    await evenement(tx, dossierId, a, `Rendez-vous planifié : ${resume(s)}`);
    await journaliser({ ...auteurAudit(a), action: 'rendez_vous.planifie', objetType: 'rendez_vous', objetId: r!.id, apres: { dossierId, type: s.type, debut: s.debut.toISOString() } }, tx);
    // Participants (hors auteur) prévenus.
    await notifier(
      {
        destinataires: [d.referentId, ...s.participants].filter((id) => id !== a.id),
        type: 'rendez_vous',
        dossierId,
        titre: `Rendez-vous : ${d.numero}`,
        texte: resume(s),
        lien: `/admin/dossiers/${dossierId}`,
        cle: `rdv:${r!.id}:planifie`,
      },
      tx,
    );
    return r!.id;
  });
}

/** Replanifier ou modifier un rendez-vous encore prévu. Un changement d'heure réarme les rappels. */
export async function modifierRendezVous(id: number, entree: SaisieRendezVous, a: Acteur, maintenant = new Date()): Promise<void> {
  const s = lireSaisie(entree);
  await getDb().transaction(async (tx) => {
    const { r } = await rdvPourEcriture(tx, id, a);
    if (r.statut !== 'prevu') throw new ErreurMetier('Seul un rendez-vous prévu peut être modifié.');
    const replanifie = r.debut.getTime() !== s.debut.getTime();
    if (replanifie && s.debut <= maintenant) throw new ErreurMetier('Le rendez-vous doit être dans le futur.');
    await verifierParticipants(tx, s.participants);
    await tx
      .update(schema.rendezVous)
      .set({ type: s.type, debut: s.debut, dureeMinutes: s.dureeMinutes, lieu: s.lieu, participants: s.participants, modifieLe: maintenant, ...(replanifie ? { planifieLe: maintenant } : {}) })
      .where(eq(schema.rendezVous.id, id));
    await evenement(tx, r.dossierId, a, replanifie ? `Rendez-vous replanifié : ${resume(r)} → ${libelleDebut(s.debut)}` : `Rendez-vous modifié : ${resume(s)}`);
    await journaliser({ ...auteurAudit(a), action: 'rendez_vous.modifie', objetType: 'rendez_vous', objetId: id, avant: { type: r.type, debut: r.debut.toISOString(), lieu: r.lieu }, apres: { type: s.type, debut: s.debut.toISOString(), lieu: s.lieu } }, tx);
  });
}

/** Clôture : fait (compte rendu obligatoire), annulé ou non honoré. */
export async function cloturerRendezVous(id: number, statut: Exclude<RdvStatut, 'prevu'>, compteRendu: string | null, a: Acteur, maintenant = new Date()): Promise<void> {
  const vers = z.enum(RDV_STATUT_CODES).exclude(['prevu']).parse(statut);
  const cr = z.string().trim().max(3000).optional().nullable().parse(compteRendu) || null;
  if (vers === 'fait' && !cr) throw new ErreurMetier('Ajoutez un compte rendu.');
  await getDb().transaction(async (tx) => {
    const { r } = await rdvPourEcriture(tx, id, a);
    if (r.statut !== 'prevu') throw new ErreurMetier('Ce rendez-vous est déjà clôturé.');
    if (vers !== 'annule' && r.debut > maintenant) throw new ErreurMetier('Le rendez-vous n’a pas encore eu lieu.');
    await tx.update(schema.rendezVous).set({ statut: vers, compteRendu: cr, modifieLe: maintenant }).where(eq(schema.rendezVous.id, id));
    await evenement(tx, r.dossierId, a, `Rendez-vous ${RDV_STATUTS[vers].toLowerCase()} (${resume(r)})${cr ? ` : ${cr}` : ''}`);
    await journaliser({ ...auteurAudit(a), action: 'rendez_vous.cloture', objetType: 'rendez_vous', objetId: id, avant: { statut: r.statut }, apres: { statut: vers } }, tx);
  });
}

// ─── Lecture ──────────────────────────────────────────────────

const colonnesAgenda = {
  id: schema.rendezVous.id,
  dossierId: schema.rendezVous.dossierId,
  type: schema.rendezVous.type,
  debut: schema.rendezVous.debut,
  planifieLe: schema.rendezVous.planifieLe,
  dureeMinutes: schema.rendezVous.dureeMinutes,
  lieu: schema.rendezVous.lieu,
  participants: schema.rendezVous.participants,
  statut: schema.rendezVous.statut,
  compteRendu: schema.rendezVous.compteRendu,
  numero: schema.dossier.numero,
  referentId: schema.dossier.referentId,
  client: schema.client.nom,
  ville: sql<string | null>`coalesce(${schema.ville.nom}, ${schema.dossier.villeAutre})`,
};

/** Rendez-vous d'un dossier, du plus proche au plus lointain. */
export async function rendezVousDuDossier(dossierId: number) {
  return getDb().select().from(schema.rendezVous).where(eq(schema.rendezVous.dossierId, dossierId)).orderBy(asc(schema.rendezVous.debut));
}

/** Un référent ne voit que ses dossiers et les rendez-vous où il est participant ; Direction et Finances voient tout. */
function filtreVisibilite(a: Demandeur) {
  if (peut(a.roles, 'dossier.voir_tous')) return undefined;
  return sql`(${schema.dossier.referentId} = ${a.id} or ${a.id} = any(${schema.rendezVous.participants}))`;
}

/** RG-03 : agenda sur [du, au[, filtrable par référent et par ville. */
export async function agenda(f: { du: Date; au: Date; referentId?: string | null; villeId?: number | null }, a: Demandeur) {
  return getDb()
    .select(colonnesAgenda)
    .from(schema.rendezVous)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.rendezVous.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(
      and(
        gte(schema.rendezVous.debut, f.du),
        lt(schema.rendezVous.debut, f.au),
        filtreVisibilite(a),
        f.referentId ? eq(schema.dossier.referentId, f.referentId) : undefined,
        f.villeId ? eq(schema.dossier.villeId, f.villeId) : undefined,
      ),
    )
    .orderBy(asc(schema.rendezVous.debut));
}

/** RG-02 : rendez-vous passés restés « prévus » plus de 24 h après leur fin (« À relancer »). */
export async function rendezVousACloturer(a: Demandeur, maintenant = new Date()) {
  return getDb()
    .select(colonnesAgenda)
    .from(schema.rendezVous)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.rendezVous.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(
      and(
        eq(schema.rendezVous.statut, 'prevu'),
        sql`${schema.rendezVous.debut} + make_interval(mins => ${schema.rendezVous.dureeMinutes}) <= ${new Date(maintenant.getTime() - DELAI_A_CLOTURER_MS)}`,
        filtreVisibilite(a),
      ),
    )
    .orderBy(asc(schema.rendezVous.debut));
}

// ─── Tâche planifiée (RG-02) ──────────────────────────────────

/**
 * Rappels la veille à 18 h et 1 h avant (in-app + e-mail) au référent et aux participants,
 * puis signalement des rendez-vous à clôturer. Idempotent : clés de notification, dont l'heure
 * du rendez-vous (une replanification réarme les rappels).
 */
export async function rappelerRendezVous(maintenant = new Date()): Promise<{ rappels: number; aCloturer: number }> {
  const db = getDb();
  const lignes = await db
    .select(colonnesAgenda)
    .from(schema.rendezVous)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.rendezVous.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(and(eq(schema.rendezVous.statut, 'prevu'), gte(schema.rendezVous.debut, new Date(maintenant.getTime() - 3 * DELAI_A_CLOTURER_MS)), lt(schema.rendezVous.debut, new Date(maintenant.getTime() + 2 * DELAI_A_CLOTURER_MS))));
  let rappels = 0;
  let aCloturer = 0;
  for (const r of lignes) {
    const destinataires = [r.referentId, ...r.participants];
    for (const cle of rappelsDus(r, maintenant)) {
      const quand = cle === 'veille' ? `Demain à ${libelleHeure(r.debut)}` : `Dans 1 h (${libelleHeure(r.debut)})`;
      await notifier({
        destinataires,
        type: 'rappel_rendez_vous',
        dossierId: r.dossierId,
        titre: `${quand} : ${RDV_TYPES[r.type].toLowerCase()} ${r.numero}`,
        texte: `${RDV_TYPES[r.type]} — ${r.client}${r.ville ? ` (${r.ville})` : ''}\n${libelleDebut(r.debut)}${r.lieu ? `\nLieu : ${r.lieu}` : ''}`,
        lien: `/admin/dossiers/${r.dossierId}`,
        cle: `rdv:${r.id}:${cle}:${r.debut.toISOString()}`,
        email: true,
      });
      rappels++;
    }
    if (estACloturer(r, maintenant)) {
      await notifier({
        destinataires: [r.referentId],
        type: 'rendez_vous_a_cloturer',
        dossierId: r.dossierId,
        titre: `Rendez-vous à clôturer : ${r.numero}`,
        texte: `${resume(r)} est toujours « prévu ». Indiquez s'il a eu lieu et ajoutez le compte rendu.`,
        lien: `/admin/dossiers/${r.dossierId}`,
        cle: `rdv:${r.id}:a_cloturer`,
      });
      aCloturer++;
    }
  }
  return { rappels, aCloturer };
}

/** Collaborateurs pouvant participer à un rendez-vous ou filtrer l'agenda (référents et Direction actifs). */
export async function collaborateursCommerciaux(): Promise<{ id: string; nom: string }[]> {
  return getDb()
    .selectDistinct({ id: schema.user.id, nom: schema.user.name })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), inArray(schema.collaborateurRole.role, ['referent', 'direction'])))
    .orderBy(asc(schema.user.name));
}
