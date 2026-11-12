// Rapport commercial hebdomadaire (specs/COM1-02 RG-09..11) : génération le lundi à 7 h par la
// tâche planifiée, envoi aux collaborateurs, consultation dans le Back-Office.
// Destinataires : la Direction reçoit le rapport global ; chaque référent reçoit celui de ses
// dossiers (même périmètre que le tableau de bord, RG-05). Idempotent : un rapport par semaine et
// par périmètre (contrainte d'unicité), envoyé une seule fois (clé de notification).
import { and, asc, desc, eq, inArray, lt, notInArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { lireParametre } from '@/lib/parametres';
import { idsDirection, notifier } from '@/lib/notifications';
import type { Demandeur } from '@/lib/dossiers/acces';
import { STATUTS_OUVERTS } from '@/lib/dossiers/attribution';
import { agenda, rendezVousACloturer } from '@/lib/rendezvous/service';
import { partiesDouala } from '@/lib/rendezvous/domaine';
import { demandesEnAttente, totaux, ventiler } from './indicateurs';
import { lignesCommerciales } from './service';
import { iaActive } from '@/lib/ia/client';
import { commentaireRapport } from '@/lib/ia/copilote';
import { indicateursVeille, requetesImproductives } from '@/lib/veille/indicateurs';

/** COM4-01 RG-12 : veille de la semaine (null s'il n'y a eu aucune piste). */
async function veilleDuRapport(s: SemaineRapport, maintenant: Date): Promise<ContenuRapport['veille']> {
  const [i, improductives] = await Promise.all([indicateursVeille({ du: s.du, au: s.au }), requetesImproductives(maintenant)]);
  if (!i.total.trouvees && !i.total.converties && !improductives.length) return null;
  const { trouvees, retenues, contactees, converties, ca } = i.total;
  return { trouvees, retenues, contactees, converties, ca, parSource: i.parSource.slice(0, 8).map((x) => ({ libelle: x.libelle, trouvees: x.trouvees, converties: x.converties })), improductives: improductives.map((r) => `${r.source} — « ${r.requete} »`) };
}
import { semaineDue, texteRapport, titreRapport, topSources, type ContenuRapport, type SemaineRapport } from './rapport';

const JOUR_MS = 24 * 60 * 60 * 1000;
export const PORTEE_DIRECTION = 'direction';

/** Périmètre du rapport consultable par un collaborateur. */
export const porteeDe = (a: Demandeur) => (a.roles.includes('direction') ? PORTEE_DIRECTION : a.id);

async function dossiersSansAction(dem: Demandeur, jours: number, maintenant: Date) {
  const d = schema.dossier;
  const lignes = await getDb()
    .select({ dossierId: d.id, numero: d.numero, derniereActionLe: d.derniereActionLe })
    .from(d)
    .where(and(inArray(d.statut, STATUTS_OUVERTS), lt(d.derniereActionLe, new Date(maintenant.getTime() - jours * JOUR_MS)), dem.roles.includes('direction') ? undefined : eq(d.referentId, dem.id)))
    .orderBy(asc(d.derniereActionLe));
  return lignes.map((l) => ({ dossierId: l.dossierId, numero: l.numero, jours: Math.floor((maintenant.getTime() - l.derniereActionLe.getTime()) / JOUR_MS) }));
}

/** Contenu figé du rapport d'une semaine pour un périmètre. */
export async function construireRapport(s: SemaineRapport, dem: Demandeur, maintenant: Date): Promise<ContenuRapport> {
  const [lignes, lignesPrec, joursSansAction] = await Promise.all([lignesCommerciales(s, dem), lignesCommerciales(s.precedente, dem), lireParametre('jours_sans_action')]);
  const ctx = { du: s.du, au: s.au, maintenant };
  const [sansAction, aCloturer, aVenir] = await Promise.all([dossiersSansAction(dem, joursSansAction, maintenant), rendezVousACloturer(dem, maintenant), agenda(s.suivante, dem)]);
  return {
    semaine: s.semaine,
    fin: partiesDouala(new Date(s.au.getTime() - JOUR_MS)).jour,
    portee: dem.roles.includes('direction') ? 'direction' : 'referent',
    actuel: totaux(lignes, ctx),
    precedent: totaux(lignesPrec, { ...s.precedente, maintenant: s.du }),
    topSources: topSources(ventiler(lignes, 'source', ctx)),
    enSouffrance: demandesEnAttente(lignes, maintenant)
      .filter((x) => x.sansReponse)
      .map((x) => ({ dossierId: x.id, numero: x.numero, ancienneteH: x.ancienneteH })),
    sansAction,
    joursSansAction,
    aCloturer: aCloturer.map((r) => ({ dossierId: r.dossierId, numero: r.numero, type: r.type, debut: r.debut.toISOString() })),
    aVenir: aVenir.filter((r) => r.statut === 'prevu').map((r) => ({ dossierId: r.dossierId, numero: r.numero, type: r.type, debut: r.debut.toISOString(), ville: r.ville })),
  };
}

/** Référents actifs qui ne sont pas aussi Direction (la Direction reçoit la vue globale). */
async function referentsActifs(direction: string[]): Promise<string[]> {
  const r = await getDb()
    .selectDistinct({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'referent'), direction.length ? notInArray(schema.user.id, direction) : undefined));
  return r.map((x) => x.id);
}

/** RG-09 : génère et envoie les rapports dus. Renvoie le nombre de rapports générés. */
export async function genererRapportsHebdomadaires(maintenant = new Date()): Promise<number> {
  const s = semaineDue(maintenant);
  if (!s) return 0;
  const direction = await idsDirection();
  const portees: { portee: string; dem: Demandeur; destinataires: string[] }[] = [
    ...(direction.length ? [{ portee: PORTEE_DIRECTION, dem: { id: PORTEE_DIRECTION, roles: ['direction'] } as Demandeur, destinataires: direction }] : []),
    ...(await referentsActifs(direction)).map((id) => ({ portee: id, dem: { id, roles: ['referent'] } as Demandeur, destinataires: [id] })),
  ];
  const deja = new Set((await getDb().select({ portee: schema.rapportHebdomadaire.portee }).from(schema.rapportHebdomadaire).where(eq(schema.rapportHebdomadaire.semaine, s.semaine))).map((r) => r.portee));
  let n = 0;
  for (const p of portees) {
    if (deja.has(p.portee)) continue;
    const contenu = await construireRapport(s, p.dem, maintenant);
    if (p.portee === PORTEE_DIRECTION) contenu.veille = await veilleDuRapport(s, maintenant).catch(() => null);
    // COM3-01 RG-11 : commentaire IA, en complément des chiffres ; rejeté s'il cite un nombre inventé.
    if (iaActive()) contenu.commentaire = await commentaireRapport(contenu).catch(() => null);
    const genere = await getDb().transaction(async (tx) => {
      const [r] = await tx.insert(schema.rapportHebdomadaire).values({ semaine: s.semaine, portee: p.portee, contenu, genereLe: maintenant }).onConflictDoNothing().returning({ id: schema.rapportHebdomadaire.id });
      if (!r) return false;
      await notifier(
        {
          destinataires: p.destinataires,
          type: 'rapport_hebdomadaire',
          titre: titreRapport(contenu),
          texte: texteRapport(contenu),
          lien: `/admin/commercial/rapports/${s.semaine}`,
          cle: `rapport:${s.semaine}:${p.portee}`,
          email: true,
        },
        tx,
      );
      return true;
    });
    if (genere) n++;
  }
  return n;
}

// ─── Consultation ─────────────────────────────────────────────

export async function listerRapports(a: Demandeur, limite = 26) {
  return getDb()
    .select({ semaine: schema.rapportHebdomadaire.semaine, contenu: schema.rapportHebdomadaire.contenu, genereLe: schema.rapportHebdomadaire.genereLe })
    .from(schema.rapportHebdomadaire)
    .where(eq(schema.rapportHebdomadaire.portee, porteeDe(a)))
    .orderBy(desc(schema.rapportHebdomadaire.semaine))
    .limit(limite);
}

export async function lireRapport(semaine: string, a: Demandeur) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semaine)) return null;
  const [r] = await getDb()
    .select()
    .from(schema.rapportHebdomadaire)
    .where(and(eq(schema.rapportHebdomadaire.semaine, semaine), eq(schema.rapportHebdomadaire.portee, porteeDe(a))));
  return r ?? null;
}
