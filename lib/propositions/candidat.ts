// Propositions vues et traitées depuis l'espace candidat (MVP2-01 RG-13, RG-14 ; MVP2-03 RG-03,
// RG-04, RG-08) et notifications in-app du candidat. Indépendant de Next.js : la session est
// contrôlée par l'appelant (app/(site)/candidat/propositions.ts).
// N'expose jamais au candidat : les retours du client (RG-11), les motifs saisis par le référent,
// le salaire non autorisé, l'état des accès client.
import { and, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { FUSEAU } from '@/lib/domain/referentiels';
import type { StatutProposition } from './domaine';
import { enregistrerAccord, enregistrerRefusCandidat } from './effets';

export const MOTIF_MAX = 500;

/** Libellés adaptés au candidat (le libellé interne n'est jamais montré). */
export const STATUTS_PROPOSITION_CANDIDAT: Record<StatutProposition, string> = {
  en_attente_accord: 'En attente de votre réponse',
  proposee: 'Présenté(e) au client',
  entretien: 'Entretien prévu',
  retenue: 'Retenu(e)',
  refusee: 'Non retenu(e)',
  placee: 'Placé(e)',
  refusee_candidat: 'Vous avez refusé',
  retiree: 'Retirée',
};

const formatEntretien = (d: Date) => {
  const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const heure = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(d).replace(':', ' h ');
  return `${jour} à ${heure}`;
};

/** « Entretien prévu le mardi 10 novembre à 09 h 30 » quand la date est connue. */
export function libelleStatutCandidat(statut: StatutProposition, entretienLe: Date | null): string {
  if (statut === 'entretien' && entretienLe) return `Entretien prévu le ${formatEntretien(entretienLe)}`;
  return STATUTS_PROPOSITION_CANDIDAT[statut];
}

export interface PropositionCandidat {
  id: number;
  statut: StatutProposition;
  libelleStatut: string;
  poste: string;
  client: string;
  secteur: string | null;
  ville: string | null;
  quartier: string | null;
  typeContrat: string | null;
  duree: string | null;
  horaires: string | null;
  /** Uniquement si le client a autorisé sa communication (MVP2-01 RG-13). */
  salaire: string | null;
  creeLe: Date;
  reponseLe: Date | null;
  numeroCommunicable: boolean;
  entretienLe: Date | null;
  entretienLieu: string | null;
  /** Date de prise de poste confirmée (Placement confirmé). */
  priseDePosteLe: string | null;
}

/** Propositions du candidat : en attente de sa réponse d'abord, puis l'historique. */
export async function listerPropositionsCandidat(candidatId: number): Promise<{ enAttente: PropositionCandidat[]; historique: PropositionCandidat[] }> {
  const db = getDb();
  const p = schema.proposition;
  const lignes = await db
    .select({
      id: p.id,
      statut: p.statut,
      salaireCommunicable: p.salaireCommunicable,
      creeLe: p.creeLe,
      majLe: p.majLe,
      reponseLe: p.reponseLe,
      numeroCommunicable: p.numeroCommunicable,
      entretienLe: p.entretienLe,
      entretienLieu: p.entretienLieu,
      poste: schema.lignePoste.intitule,
      typeContrat: schema.lignePoste.typeContrat,
      duree: schema.lignePoste.duree,
      horaires: schema.lignePoste.horaires,
      salaire: schema.lignePoste.salaire,
      client: schema.client.nom,
      secteur: schema.dossier.secteur,
      ville: schema.ville.nom,
      villeAutre: schema.dossier.villeAutre,
      quartier: schema.quartier.nom,
      quartierAutre: schema.dossier.quartierAutre,
    })
    .from(p)
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, p.lignePosteId))
    .innerJoin(schema.dossier, eq(schema.dossier.id, p.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, p.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .leftJoin(schema.quartier, eq(schema.quartier.id, schema.dossier.quartierId))
    .where(eq(p.candidatId, candidatId))
    .orderBy(desc(p.majLe), desc(p.id));

  const ids = lignes.map((l) => l.id);
  const placements = ids.length
    ? await db
        .select({ propositionId: schema.placement.propositionId, datePriseDePoste: schema.placement.datePriseDePoste })
        .from(schema.placement)
        .where(and(inArray(schema.placement.propositionId, ids), eq(schema.placement.candidatId, candidatId), ne(schema.placement.statut, 'abandonne')))
    : [];
  const priseDePoste = new Map(placements.map((x) => [x.propositionId, x.datePriseDePoste]));

  const vues: PropositionCandidat[] = lignes.map((l) => ({
    id: l.id,
    statut: l.statut,
    libelleStatut: libelleStatutCandidat(l.statut, l.entretienLe),
    poste: l.poste,
    client: l.client,
    secteur: l.secteur,
    ville: l.ville ?? l.villeAutre,
    quartier: l.quartier ?? l.quartierAutre,
    typeContrat: l.typeContrat,
    duree: l.duree,
    horaires: l.horaires,
    salaire: l.salaireCommunicable ? l.salaire : null,
    creeLe: l.creeLe,
    reponseLe: l.reponseLe,
    numeroCommunicable: l.numeroCommunicable,
    entretienLe: l.statut === 'entretien' ? l.entretienLe : null,
    entretienLieu: l.statut === 'entretien' ? l.entretienLieu : null,
    priseDePosteLe: priseDePoste.get(l.id) ?? null,
  }));
  return {
    enAttente: vues.filter((v) => v.statut === 'en_attente_accord').sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime()),
    historique: vues.filter((v) => v.statut !== 'en_attente_accord'),
  };
}

export interface ReponseOptions {
  motif?: string | null;
  /** RG-08 : le candidat accepte que son numéro soit communiqué au client. */
  numeroCommunicable?: boolean;
  ip?: string | null;
}

/**
 * MVP2-01 RG-13, RG-14 ; MVP2-03 RG-03, RG-04 : réponse du candidat, horodatée et journalisée
 * (par les effets). L'accord vaut pour ce Client et ce poste ; le refus est définitif.
 */
export async function repondreProposition(candidatId: number, propositionId: number, reponse: 'accepte' | 'refuse', o: ReponseOptions = {}): Promise<void> {
  if (reponse !== 'accepte' && reponse !== 'refuse') throw new ErreurMetier('Réponse invalide.');
  if (!Number.isInteger(propositionId)) throw new ErreurMetier('Proposition introuvable.');
  const motif = typeof o.motif === 'string' ? o.motif.trim().slice(0, MOTIF_MAX) || null : null;
  const auteur = { type: 'candidat' as const, candidatId, ip: o.ip ?? null };
  await getDb().transaction(async (tx) => {
    const [p] = await tx.select({ candidatId: schema.proposition.candidatId, statut: schema.proposition.statut }).from(schema.proposition).where(eq(schema.proposition.id, propositionId)).for('update');
    // Même message qu'une proposition inexistante : rien n'est révélé sur celles des autres.
    if (!p || p.candidatId !== candidatId) throw new ErreurMetier('Proposition introuvable.');
    if (p.statut !== 'en_attente_accord') {
      throw new ErreurMetier(p.statut === 'refusee_candidat' ? 'Vous avez déjà refusé cette proposition.' : `Cette proposition n’attend plus de réponse (${STATUTS_PROPOSITION_CANDIDAT[p.statut].toLowerCase()}).`);
    }
    if (reponse === 'accepte') {
      await enregistrerAccord(tx, propositionId, { mode: 'espace', le: new Date(), ip: o.ip ?? null, numeroCommunicable: !!o.numeroCommunicable }, auteur);
    } else {
      await enregistrerRefusCandidat(tx, propositionId, motif, auteur);
    }
  });
}

// ─── Notifications in-app du candidat (MVP2-03 RG-17, RG-22) ──────────────

export async function listerNotificationsCandidat(candidatId: number, limite = 20) {
  const n = schema.notificationCandidat;
  return getDb()
    .select({ id: n.id, titre: n.titre, texte: n.texte, lien: n.lien, creeLe: n.creeLe, luLe: n.luLe })
    .from(n)
    .where(eq(n.candidatId, candidatId))
    .orderBy(desc(n.creeLe), desc(n.id))
    .limit(limite);
}

export async function compterNonLuesCandidat(candidatId: number): Promise<number> {
  const n = schema.notificationCandidat;
  const [r] = await getDb().select({ n: count() }).from(n).where(and(eq(n.candidatId, candidatId), isNull(n.luLe)));
  return r?.n ?? 0;
}

/** Marque comme lues les notifications indiquées (toutes si `ids` est absent) du seul candidat. */
export async function marquerLuesCandidat(candidatId: number, ids?: number[]): Promise<number> {
  const n = schema.notificationCandidat;
  const valides = ids?.filter((i) => Number.isInteger(i));
  if (valides && !valides.length) return 0;
  const filtreIds = valides ? inArray(n.id, valides) : undefined;
  const r = await getDb()
    .update(n)
    .set({ luLe: new Date() })
    .where(and(eq(n.candidatId, candidatId), isNull(n.luLe), filtreIds))
    .returning({ id: n.id });
  return r.length;
}
