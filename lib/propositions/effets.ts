// Effets partagés des Propositions et Placements (specs/MVP2-03), appelés dans une transaction
// par le Back-Office (référent), l'espace candidat et la page de suivi client. Indépendant de Next.js.
// Les contrôles de droits sont faits par l'appelant.
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { deriverStatutCandidat } from '@/lib/candidats/attribution';
import { notifier } from '@/lib/notifications';
import { nomAffichable, STATUTS_PROPOSITION, type ModeAccord, type ModeConfirmation } from './domaine';

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const lienPropositionsDossier = (dossierId: number) => `/admin/dossiers/${dossierId}#propositions`;

/** Acteur d'un effet : collaborateur (Back-Office), candidat (espace) ou client (page de suivi). */
export type AuteurEffet = { type: 'collaborateur'; id: string; ip?: string | null } | { type: 'candidat'; candidatId: number; ip?: string | null } | { type: 'client'; ip?: string | null };

const auditDe = (a: AuteurEffet) =>
  a.type === 'collaborateur'
    ? { acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null }
    : a.type === 'candidat'
      ? { acteurType: 'candidat' as const, acteurId: String(a.candidatId), ip: a.ip ?? null }
      : { acteurType: 'client' as const, acteurId: null, ip: a.ip ?? null };

/** Entrée d'historique du Dossier (type `proposition` ou `placement`). */
export async function evenementDossier(tx: Tx, dossierId: number, type: 'proposition' | 'placement', commentaire: string, auteur: AuteurEffet, apres?: unknown): Promise<void> {
  await tx.insert(schema.evenementDossier).values({ dossierId, type, commentaire, auteurId: auteur.type === 'collaborateur' ? auteur.id : null, apres: apres ?? null });
  await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, dossierId));
}

/** Notification in-app du candidat, affichée dans son espace (dédoublonnée par `cle`). */
export async function notifierCandidat(tx: Tx, candidatId: number, n: { titre: string; texte: string; lien?: string | null; cle?: string | null }): Promise<void> {
  await tx
    .insert(schema.notificationCandidat)
    .values({ candidatId, titre: n.titre, texte: n.texte, lien: n.lien ?? null, cle: n.cle ?? null })
    .onConflictDoNothing();
}

/** Proposition verrouillée avec le libellé utile aux messages. */
export async function chargerProposition(tx: Tx, propositionId: number) {
  const [p] = await tx
    .select({
      id: schema.proposition.id,
      statut: schema.proposition.statut,
      dossierId: schema.proposition.dossierId,
      lignePosteId: schema.proposition.lignePosteId,
      candidatId: schema.proposition.candidatId,
      clientId: schema.proposition.clientId,
      remplacePlacementId: schema.proposition.remplacePlacementId,
    })
    .from(schema.proposition)
    .where(eq(schema.proposition.id, propositionId))
    .for('update');
  if (!p) throw new ErreurMetier('Proposition introuvable.');
  const [info] = await tx
    .select({
      numero: schema.dossier.numero,
      statutDossier: schema.dossier.statut,
      referentId: schema.dossier.referentId,
      intitule: schema.lignePoste.intitule,
      prenom: schema.candidat.prenom,
      nom: schema.candidat.nom,
      client: schema.client.nom,
    })
    .from(schema.dossier)
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, p.lignePosteId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, p.candidatId))
    .innerJoin(schema.client, eq(schema.client.id, p.clientId))
    .where(eq(schema.dossier.id, p.dossierId));
  return { ...p, ...info!, libelle: `${nomAffichable(info!.prenom, info!.nom)} — ${info!.intitule}` };
}

export interface Accord {
  mode: ModeAccord;
  /** Date de l'accord (saisie par le référent pour un accord WhatsApp). */
  le: Date;
  parId?: string | null;
  preuveCle?: string | null;
  preuveMime?: string | null;
  ip?: string | null;
  numeroCommunicable?: boolean;
}

/**
 * RG-03, RG-06 : l'accord du candidat fait passer la Proposition de `en attente d'accord` à
 * `proposée` ; statut candidat dérivé (« proposé au client ») ; premier passage dans le Dossier
 * → « Candidats proposés » (transition automatique journalisée) ; référent notifié.
 */
export async function enregistrerAccord(tx: Tx, propositionId: number, accord: Accord, auteur: AuteurEffet): Promise<void> {
  if (accord.mode === 'whatsapp' && !accord.preuveCle) throw new ErreurMetier('Joignez la capture de l’accord WhatsApp.');
  const p = await chargerProposition(tx, propositionId);
  if (p.statut !== 'en_attente_accord') throw new ErreurMetier(`La proposition n’attend plus d’accord (statut : ${STATUTS_PROPOSITION[p.statut]}).`);
  const maintenant = new Date();
  await tx
    .update(schema.proposition)
    .set({
      statut: 'proposee',
      accordMode: accord.mode,
      accordLe: accord.le,
      accordParId: accord.parId ?? null,
      accordPreuveCle: accord.preuveCle ?? null,
      accordPreuveMime: accord.preuveMime ?? null,
      accordIp: accord.ip ?? null,
      numeroCommunicable: accord.numeroCommunicable ?? false,
      reponseLe: maintenant,
      majLe: maintenant,
    })
    .where(eq(schema.proposition.id, propositionId));
  await deriverStatutCandidat(tx, p.candidatId, 'propose', `proposition:${propositionId}`);
  await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : accord du candidat (${accord.mode === 'espace' ? 'espace candidat' : 'WhatsApp'}), profil transmis au client`, auteur, { propositionId, statut: 'proposee' });

  if (p.statutDossier === 'recherche_en_cours') {
    await tx.update(schema.dossier).set({ statut: 'candidats_proposes' }).where(eq(schema.dossier.id, p.dossierId));
    await tx.insert(schema.evenementDossier).values({ dossierId: p.dossierId, type: 'transition', deStatut: 'recherche_en_cours', versStatut: 'candidats_proposes', commentaire: 'Transition automatique : premier candidat proposé' });
    await journaliser({ acteurType: 'systeme', action: 'dossier.transition', objetType: 'dossier', objetId: p.dossierId, avant: 'recherche_en_cours', apres: 'candidats_proposes', details: { automatique: true, propositionId } }, tx);
  }
  await journaliser({ ...auditDe(auteur), action: 'proposition.accord', objetType: 'proposition', objetId: propositionId, apres: { statut: 'proposee', mode: accord.mode } }, tx);
  if (auteur.type !== 'collaborateur' && p.referentId) {
    await notifier({ destinataires: [p.referentId], type: 'proposition_accord', titre: 'Accord du candidat', texte: `${p.libelle} (${p.numero}) : le candidat accepte d’être présenté à ${p.client}.`, lien: lienPropositionsDossier(p.dossierId), dossierId: p.dossierId, cle: `proposition_accord:${propositionId}` }, tx);
  }
}

/** RG-04 : refus du candidat (espace candidat), définitif pour cette Proposition. */
export async function enregistrerRefusCandidat(tx: Tx, propositionId: number, motif: string | null, auteur: AuteurEffet): Promise<void> {
  const p = await chargerProposition(tx, propositionId);
  if (p.statut !== 'en_attente_accord') throw new ErreurMetier('Cette proposition n’attend plus de réponse.');
  const maintenant = new Date();
  await tx.update(schema.proposition).set({ statut: 'refusee_candidat', motif: motif?.trim() || null, reponseLe: maintenant, majLe: maintenant }).where(eq(schema.proposition.id, propositionId));
  await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : le candidat refuse d’être présenté${motif?.trim() ? ` (${motif.trim()})` : ''}`, auteur, { propositionId, statut: 'refusee_candidat' });
  await journaliser({ ...auditDe(auteur), action: 'proposition.refus_candidat', objetType: 'proposition', objetId: propositionId, details: motif ? { motif } : undefined }, tx);
  if (p.referentId) {
    await notifier({ destinataires: [p.referentId], type: 'proposition_refus', titre: 'Refus du candidat', texte: `${p.libelle} (${p.numero}) : le candidat refuse d’être présenté à ${p.client}.`, lien: lienPropositionsDossier(p.dossierId), dossierId: p.dossierId, cle: `proposition_refus:${propositionId}` }, tx);
  }
}

export interface Confirmation {
  mode: ModeConfirmation;
  /** Date effective de prise de poste (AAAA-MM-JJ). */
  datePriseDePoste: string;
  signataireNom?: string | null;
  signataireFonction?: string | null;
  ip?: string | null;
  confirmeParId?: string | null;
  preuveCle?: string | null;
  preuveMime?: string | null;
  preuveNom?: string | null;
}

/**
 * RG-16, RG-17 : confirmation du Placement (par le client sur la page de suivi, ou preuve jointe
 * par le référent) → Placement `confirmé`, Proposition `placée`, candidat `placé`, notification
 * au candidat et au référent.
 */
export async function confirmerPlacement(tx: Tx, placementId: number, c: Confirmation, auteur: AuteurEffet): Promise<void> {
  if (c.mode === 'client' && (!c.signataireNom?.trim() || !c.signataireFonction?.trim())) throw new ErreurMetier('Indiquez le nom et la fonction du signataire.');
  if (c.mode === 'preuve' && !c.preuveCle) throw new ErreurMetier('Joignez la preuve (attestation signée ou capture WhatsApp).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.datePriseDePoste)) throw new ErreurMetier('Date de prise de poste invalide.');
  const [pl] = await tx.select().from(schema.placement).where(eq(schema.placement.id, placementId)).for('update');
  if (!pl) throw new ErreurMetier('Placement introuvable.');
  if (pl.statut !== 'annonce') throw new ErreurMetier('Ce placement n’est plus à confirmer.');
  const p = await chargerProposition(tx, pl.propositionId);
  const maintenant = new Date();
  await tx
    .update(schema.placement)
    .set({
      statut: 'confirme',
      confirmeLe: maintenant,
      confirmationMode: c.mode,
      datePriseDePoste: c.datePriseDePoste,
      signataireNom: c.signataireNom?.trim() || null,
      signataireFonction: c.signataireFonction?.trim() || null,
      confirmationIp: c.ip ?? null,
      confirmeParId: c.confirmeParId ?? null,
      preuveCle: c.preuveCle ?? null,
      preuveMime: c.preuveMime ?? null,
      preuveNom: c.preuveNom ?? null,
    })
    .where(eq(schema.placement.id, placementId));
  await tx.update(schema.proposition).set({ statut: 'placee', majLe: maintenant }).where(and(eq(schema.proposition.id, pl.propositionId)));
  await deriverStatutCandidat(tx, pl.candidatId, 'place', `placement:${placementId}`);
  await evenementDossier(tx, pl.dossierId, 'placement', `${p.libelle} : prise de poste confirmée le ${c.datePriseDePoste} (${c.mode === 'client' ? `par le client — ${c.signataireNom?.trim()}, ${c.signataireFonction?.trim()}` : 'preuve jointe'})`, auteur, { placementId, statut: 'confirme' });
  await journaliser({ ...auditDe(auteur), action: 'placement.confirme', objetType: 'placement', objetId: placementId, apres: { statut: 'confirme', mode: c.mode, datePriseDePoste: c.datePriseDePoste } }, tx);
  await notifierCandidat(tx, pl.candidatId, { titre: 'Prise de poste confirmée', texte: `Votre prise de poste (${p.intitule}) est confirmée. Félicitations !`, lien: '/candidat/espace', cle: `placement_confirme:${placementId}` });
  if (auteur.type !== 'collaborateur' && p.referentId) {
    await notifier({ destinataires: [p.referentId], type: 'placement_confirme', titre: 'Prise de poste confirmée', texte: `${p.libelle} (${p.numero}) : le client confirme la prise de poste.`, lien: lienPropositionsDossier(pl.dossierId), dossierId: pl.dossierId, cle: `placement_confirme:${placementId}` }, tx);
  }
}
