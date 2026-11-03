// Attribution des candidats et statut candidat (MVP2-02 RG-01..05).
// Réutilise l'algorithme des Dossiers (MVP1-05) avec le service « Recrutement » (REC) et la ville
// du candidat ; la continuité ne s'applique pas.
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { choisirReferent, evaluerCandidats } from '@/lib/dossiers/attribution';
import { idsDirection, notifier } from '@/lib/notifications';
import { STATUTS_CANDIDAT, type StatutCandidat } from './domaine';
import { peutAccederVivier, type DemandeurVivier } from './acces';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const lienFicheCandidat = (id: number) => `/admin/candidats/${id}`;

/** Ordre de progression, pour les dérivations « si le statut était inférieur » (RG-05). */
const RANG: Record<StatutCandidat, number> = { nouveau: 0, a_contacter: 1, preselectionne: 2, entretien: 3, propose: 4, place: 5, indisponible: -1 };
export const estInferieur = (a: StatutCandidat, b: StatutCandidat) => RANG[a] < RANG[b];

/** Statuts qu'un référent fixe depuis la file Nouveaux candidats (RG-02). */
export const STATUTS_TRAITEMENT_FILE: StatutCandidat[] = ['nouveau', 'a_contacter', 'preselectionne', 'indisponible'];

export type ResultatAttributionCandidat = { referentId: string } | { referentId: null; raison: string };

/**
 * RG-01 : à appeler dans la transaction qui crée le candidat (inscription en ligne ou assistée,
 * compte léger créé par une candidature). Sans référent éligible : file « Non attribués » et
 * Direction prévenue (RG-03).
 */
export async function attribuerCandidat(tx: Tx, candidatId: number, maintenant = new Date()): Promise<ResultatAttributionCandidat> {
  const [c] = await tx
    .select({ id: schema.candidat.id, referentId: schema.candidat.referentId, villeId: schema.candidat.villeId, nom: schema.candidat.nom, prenom: schema.candidat.prenom, enFileDepuis: schema.candidat.enFileDepuis, villeAutre: schema.candidat.villeAutre })
    .from(schema.candidat)
    .where(eq(schema.candidat.id, candidatId))
    .for('update');
  if (!c) throw new ErreurMetier('Candidat introuvable.');
  if (c.referentId) return { referentId: c.referentId };

  const [v] = c.villeId ? await tx.select({ nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.id, c.villeId)) : [];
  const ligne = `${c.prenom} ${c.nom} — ${v?.nom ?? c.villeAutre ?? 'ville non précisée'}`;
  const lien = lienFicheCandidat(candidatId);
  const choix = choisirReferent(await evaluerCandidats(tx, { type: 'REC', villeId: c.villeId }, maintenant), null);

  if (choix) {
    await tx.update(schema.candidat).set({ referentId: choix.id, attribueLe: maintenant, enFileDepuis: null, derniereRelanceLe: null, alerteNonTraiteLe: null }).where(eq(schema.candidat.id, candidatId));
    await tx
      .insert(schema.collaborateurProfil)
      .values({ userId: choix.id, derniereAttributionLe: maintenant })
      .onConflictDoUpdate({ target: schema.collaborateurProfil.userId, set: { derniereAttributionLe: maintenant } });
    await notifier({ destinataires: [choix.id], type: 'candidat_attribue', titre: 'Nouveau candidat', texte: `Un nouveau candidat vous a été attribué (${choix.regle}) :\n${ligne}`, lien, cle: `candidat_attribue:${candidatId}:${choix.id}` }, tx);
    await journaliser({ acteurType: 'systeme', action: 'candidat.attribue', objetType: 'candidat', objetId: candidatId, apres: { referentId: choix.id, regle: choix.regle } }, tx);
    return { referentId: choix.id };
  }

  const raison = 'aucun référent recrutement éligible';
  const depuis = c.enFileDepuis ?? maintenant;
  await tx.update(schema.candidat).set({ enFileDepuis: depuis }).where(eq(schema.candidat.id, candidatId));
  await notifier(
    { destinataires: await idsDirection(tx), type: 'candidat_non_attribue', titre: 'Candidat non attribué', texte: `Aucun référent recrutement n’a pu prendre ce candidat (${raison}) :\n${ligne}`, lien, cle: `candidat_non_attribue:${candidatId}:${depuis.toISOString()}` },
    tx,
  );
  await journaliser({ acteurType: 'systeme', action: 'candidat.non_attribue', objetType: 'candidat', objetId: candidatId, details: { raison } }, tx);
  return { referentId: null, raison };
}

export interface ActeurVivier extends DemandeurVivier {
  ip?: string | null;
}

/**
 * Changement manuel du statut (RG-02 ; RG-05 « le référent peut corriger manuellement »),
 * journalisé. Un Référent ne traite que ses candidats ; la Direction tous.
 */
export async function changerStatutCandidat(candidatId: number, vers: StatutCandidat, a: ActeurVivier, motif?: string | null): Promise<void> {
  if (!(vers in STATUTS_CANDIDAT)) throw new ErreurMetier('Statut inconnu.');
  if (!(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier('Accès réservé aux référents recrutement et à la Direction.');
  await getDb().transaction(async (tx) => {
    const [c] = await tx.select({ statut: schema.candidat.statut, referentId: schema.candidat.referentId, supprimeLe: schema.candidat.supprimeLe }).from(schema.candidat).where(eq(schema.candidat.id, candidatId)).for('update');
    if (!c || c.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
    if (!a.roles.includes('direction') && c.referentId !== a.id) throw new ErreurMetier('Ce candidat est suivi par un autre référent.');
    if (c.statut === vers) return;
    await tx
      .update(schema.candidat)
      .set({ statut: vers, statutAvantIndisponible: vers === 'indisponible' ? c.statut : null })
      .where(eq(schema.candidat.id, candidatId));
    await journaliser(
      { acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.statut_modifie', objetType: 'candidat', objetId: candidatId, avant: { statut: c.statut }, apres: { statut: vers }, details: motif ? { motif } : undefined },
      tx,
    );
  });
}

/**
 * Dérivation automatique (RG-05) : n'élève le statut que s'il était inférieur (`placé` toujours
 * appliqué). Pour MVP2-03 (Propositions, Placements).
 */
export async function deriverStatutCandidat(tx: Tx, candidatId: number, vers: Extract<StatutCandidat, 'entretien' | 'propose' | 'place'>, origine: string): Promise<void> {
  const [c] = await tx.select({ statut: schema.candidat.statut }).from(schema.candidat).where(eq(schema.candidat.id, candidatId)).for('update');
  if (!c || c.statut === vers) return;
  if (vers !== 'place' && !estInferieur(c.statut, vers)) return;
  await tx.update(schema.candidat).set({ statut: vers, statutAvantIndisponible: null }).where(eq(schema.candidat.id, candidatId));
  await journaliser({ acteurType: 'systeme', action: 'candidat.statut_derive', objetType: 'candidat', objetId: candidatId, avant: { statut: c.statut }, apres: { statut: vers }, details: { origine } }, tx);
}
