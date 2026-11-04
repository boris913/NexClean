// Clôture financière, trop-perçu, remboursements, crédit client, impayés (specs/MVP2-05 §3, §4 ;
// RG-08..12). Indépendant de Next.js : utilisé par les actions serveur (onglet Finances), la clôture
// de la recherche, le passage « Sans suite » (lib/dossiers/service.ts), la tâche planifiée et les tests.
//
// Droits :
//  - préparer un ajustement (RG-10) : référent du Dossier ou Direction (`peutTraiter`) ;
//  - valider / refuser un remboursement (RG-11) : permission `remboursement.valider` (Direction) ;
//  - enregistrer la sortie d'un remboursement validé : Responsable finances ou Direction.
import { and, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peut } from '@/lib/authz/permissions';
import { peutTraiter, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { declencherEnvoi, idsDirection, notifier } from '@/lib/notifications';
import { lireParametre } from '@/lib/parametres';
import { auditDe, evenementDossier, type AuteurEffet, type Tx } from '@/lib/devis/effets';
import { formaterMontant } from '@/lib/devis/domaine';
import { devisAccepte } from '@/lib/devis/lignes';
import { facturerCloture, type ResultatFacturation } from '@/lib/devis/facturation';
import { compterPlacementsRetenus, STATUTS_EN_COURS } from '@/lib/propositions/domaine';
import { notifierCandidat } from '@/lib/propositions/effets';
import { appliquerGardeSolde, ecrituresDossier, versEcriture } from './effets';
import { situationFinanciere, tropPercuARegulariser } from './lecture';
import { CHOIX_AJUSTEMENT, dateDuJour, encaissementsNets, erreursSaisie, issueCloture, MOYENS_PAIEMENT, normaliserReference, relanceSoldeDue, type ChoixAjustement, type IssueCloture, type MoyenPaiement } from './domaine';

type Executeur = Pick<ReturnType<typeof getDb>, 'select'>;

export interface ActeurRegularisation extends Demandeur {
  ip?: string | null;
}

export interface Fichier {
  nom: string;
  octets: Uint8Array;
}

const auteurDe = (a: ActeurRegularisation): AuteurEffet => ({ type: 'collaborateur', id: a.id, ip: a.ip ?? null });

/** Onglet Finances d'un Dossier (Back-Office). */
export const lienOngletFinances = (dossierId: number) => `/admin/dossiers/${dossierId}?onglet=finances`;

export const MESSAGE_VALIDATION_REMBOURSEMENT = 'Seule la Direction peut valider ou refuser un remboursement.';
export const MESSAGE_EXECUTION_REMBOURSEMENT = 'Seuls le Responsable finances et la Direction enregistrent la sortie d’un remboursement.';

/** Refus d'accès (équivalent 403) : rôle insuffisant pour l'action demandée. */
export class ErreurAccesRegularisation extends ErreurMetier {}

/** Collaborateurs actifs ayant le rôle Responsable finances. */
export async function idsFinances(tx?: Executeur): Promise<string[]> {
  const r = await (tx ?? getDb())
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'finances')));
  return r.map((x) => x.id);
}

const libelleIssue = (i: IssueCloture) =>
  i.issue === 'solde_a_payer' ? `solde à payer : ${formaterMontant(i.montant)}` : i.issue === 'trop_percu' ? `trop-perçu de ${formaterMontant(i.montant)} : ajustement à préparer` : 'solde nul';

// ─── Clôture financière (RG-07, RG-08) ────────────────────────

/**
 * RG-08 : appelée **dans la transaction** de la clôture de la recherche (ou de la clôture anticipée
 * « Sans suite »), après `facturerCloture`. Fige `dossier.montantFinalTtc`, puis selon le solde
 * (montant final − encaissements nets) : solde > 0 → le Dossier reste « Placements confirmés »
 * (la facture de solde est déjà émise) ; solde = 0 → « Solde reçu » ; solde < 0 → trop-perçu, le
 * référent est notifié qu'un ajustement est à préparer (l'avoir est déjà émis par `facturerCloture`
 * quand l'acompte facturé dépasse le montant final). Sans devis accepté : rien (null).
 */
export async function appliquerClotureFinanciere(tx: Tx, dossierId: number, facturation: ResultatFacturation, auteur: AuteurEffet): Promise<IssueCloture | null> {
  if (!facturation.montantFinal || facturation.sansDevis) return null;
  const montantFinalTtc = facturation.montantFinal.totalTtc;
  await tx.update(schema.dossier).set({ montantFinalTtc }).where(eq(schema.dossier.id, dossierId));
  const nets = encaissementsNets((await ecrituresDossier(tx, dossierId)).map(versEcriture));
  const issue = issueCloture(montantFinalTtc, nets);
  await evenementDossier(tx, dossierId, `Montant final ${formaterMontant(montantFinalTtc)}, encaissé ${formaterMontant(nets)} : ${libelleIssue(issue)}`, auteur, 'modification', { montantFinalTtc, nets, issue });
  if (issue.issue === 'solde_nul') {
    await appliquerGardeSolde(tx, dossierId);
  } else if (issue.issue === 'trop_percu') {
    const [d] = await tx.select({ numero: schema.dossier.numero, referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
    await notifier(
      {
        destinataires: d?.referentId ? [d.referentId] : await idsDirection(tx),
        type: 'trop_percu',
        dossierId,
        titre: `Trop-perçu à régulariser : ${d?.numero ?? ''}`,
        texte: `${d?.numero ?? 'Dossier'} : montant final ${formaterMontant(montantFinalTtc)} pour ${formaterMontant(nets)} encaissés, soit un trop-perçu de ${formaterMontant(issue.montant)}. Préparez l’ajustement (remboursement ou crédit sur un prochain dossier) selon le choix du client.`,
        lien: lienOngletFinances(dossierId),
        cle: `trop_percu:${dossierId}`,
      },
      tx,
    );
  }
  return issue;
}

/**
 * Cas limite « Dossier Sans suite après acompte » : traité comme une clôture de recherche
 * anticipée avec motif. Appelé **dans la transaction** de `changerStatut` avant le passage à
 * « Sans suite » d'un Dossier REC. Sans devis accepté, sans encaissement, ou si la recherche est
 * déjà clôturée : sans effet (null).
 *
 * Effets : montant final (placements retenus × commission figée, `facturerCloture` : facture de
 * solde si des placements confirmés sont dus au-delà de l'acompte, avoir sinon), `montantFinalTtc`,
 * `rechercheClotureLe` / motif / `placementsRetenus`, Propositions en cours retirées (candidats
 * notifiés ; l'accès client aux profils non placés est révoqué par `changerStatut` au passage à un
 * statut final). Le reste suit RG-10 (trop-perçu : ajustement à préparer, référent notifié).
 * L'appelant archive le PDF de la facture émise **après** la transaction (`archiverPdfFactureSansEchec`).
 */
export async function regulariserSansSuite(tx: Tx, dossierId: number, motif: string, auteur: AuteurEffet): Promise<{ factureId: number | null; issue: IssueCloture | null } | null> {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d || d.type !== 'REC' || d.rechercheClotureLe) return null;
  if (!(await devisAccepte(dossierId, tx))) return null;
  if (!(await ecrituresDossier(tx, dossierId)).length) return null;
  const maintenant = new Date();
  const placements = await tx
    .select({ statut: schema.placement.statut, remplacement: schema.placement.remplacement })
    .from(schema.placement)
    .where(eq(schema.placement.dossierId, dossierId));
  const retenus = compterPlacementsRetenus(placements);
  const m = `Sans suite : ${motif.trim() || 'abandon du client'}`.slice(0, 500);
  await tx.update(schema.dossier).set({ rechercheClotureLe: maintenant, rechercheClotureMotif: m, placementsRetenus: retenus }).where(eq(schema.dossier.id, dossierId));
  await evenementDossier(tx, dossierId, `Clôture anticipée de la recherche (${m}) : ${retenus} placement(s) retenu(s) pour le montant final`, auteur, 'modification', { placementsRetenus: retenus, motif: m });
  await journaliser({ ...auditDe(auteur), action: 'dossier.recherche_cloturee', objetType: 'dossier', objetId: dossierId, apres: { placementsRetenus: retenus }, details: { motif: m, sansSuite: true } }, tx);

  const retirees = await tx
    .update(schema.proposition)
    .set({ statut: 'retiree', motif: 'Dossier sans suite', majLe: maintenant })
    .where(and(eq(schema.proposition.dossierId, dossierId), inArray(schema.proposition.statut, [...STATUTS_EN_COURS]), isNull(schema.proposition.remplacePlacementId)))
    .returning({ id: schema.proposition.id, candidatId: schema.proposition.candidatId });
  for (const r of retirees) {
    await notifierCandidat(tx, r.candidatId, { titre: 'Recherche terminée', texte: 'La recherche pour laquelle vous avez été proposé(e) est terminée : la proposition est retirée. Merci pour votre disponibilité.', lien: '/candidat/espace', cle: `proposition_retiree:${r.id}` });
  }
  if (retirees.length) await journaliser({ acteurType: 'systeme', action: 'proposition.retiree', objetType: 'dossier', objetId: dossierId, details: { motif: 'dossier sans suite', propositions: retirees.map((r) => r.id) } }, tx);

  const facturation = await facturerCloture(tx, dossierId, auteur);
  const issue = await appliquerClotureFinanciere(tx, dossierId, facturation, auteur);
  return { factureId: facturation.facture?.id ?? null, issue };
}

// ─── Ajustement d'un trop-perçu (RG-10, RG-12) ────────────────

export interface EntreeAjustement {
  choix: ChoixAjustement;
  /** Par défaut : le trop-perçu restant à régulariser ; jamais au-delà. */
  montant?: number | null;
  commentaire?: string | null;
}

export interface ResultatAjustement {
  ajustementId: number;
  montant: number;
  remboursementId: number | null;
  /** Le Dossier est passé à « Solde reçu » (crédit client). */
  soldeRecu: boolean;
}

/**
 * RG-10 : le référent (ou la Direction) enregistre le choix du client pour un trop-perçu.
 * - `remboursement` : remboursement `à valider`, Direction notifiée (RG-11) ;
 * - `credit` : écriture `credit` négative (nature `autre`) sur le Dossier, mouvement de crédit
 *   positif pour le Client (RG-12), puis garde « Solde reçu ».
 */
export async function preparerAjustement(dossierId: number, e: EntreeAjustement, a: ActeurRegularisation, maintenant = new Date()): Promise<ResultatAjustement> {
  if (!(e.choix in CHOIX_AJUSTEMENT)) throw new ErreurMetier('Indiquez le choix du client.');
  const commentaire = e.commentaire?.trim().slice(0, 1000) || null;
  const r = await getDb().transaction(async (tx) => {
    const [d] = await tx.select({ id: schema.dossier.id, numero: schema.dossier.numero, referentId: schema.dossier.referentId, clientId: schema.dossier.clientId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
    if (!d) throw new ErreurMetier('Dossier introuvable.');
    if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
    const s = (await situationFinanciere(dossierId, tx))!;
    const dispo = tropPercuARegulariser(s);
    if (dispo <= 0) throw new ErreurMetier('Aucun trop-perçu à régulariser sur ce dossier.');
    const montant = e.montant ?? dispo;
    if (!Number.isInteger(montant) || montant <= 0) throw new ErreurMetier('Le montant doit être un nombre entier de FCFA supérieur à 0.');
    if (montant > dispo) throw new ErreurMetier(`Le montant ne peut pas dépasser le trop-perçu à régulariser (${formaterMontant(dispo)}).`);
    const [avoir] = await tx
      .select({ id: schema.facture.id })
      .from(schema.facture)
      .where(and(eq(schema.facture.dossierId, dossierId), eq(schema.facture.type, 'avoir')))
      .orderBy(desc(schema.facture.id))
      .limit(1);
    const [aj] = await tx.insert(schema.ajustement).values({ dossierId, montant, choix: e.choix, avoirId: avoir?.id ?? null, commentaire, auteurId: a.id }).returning({ id: schema.ajustement.id });
    const ajustementId = aj!.id;
    let remboursementId: number | null = null;
    let soldeRecu = false;
    if (e.choix === 'remboursement') {
      const [rb] = await tx.insert(schema.remboursement).values({ dossierId, ajustementId, montant, statut: 'a_valider', prepareParId: a.id, prepareLe: maintenant }).returning({ id: schema.remboursement.id });
      remboursementId = rb!.id;
      await notifier(
        {
          destinataires: (await idsDirection(tx)).filter((id) => id !== a.id),
          type: 'remboursement_a_valider',
          dossierId,
          titre: `Remboursement à valider : ${d.numero}`,
          texte: `${d.numero} : remboursement d’un trop-perçu de ${formaterMontant(montant)} à valider${commentaire ? ` (${commentaire})` : ''}.`,
          lien: lienOngletFinances(dossierId),
          cle: `remboursement_a_valider:${remboursementId}`,
          email: true,
        },
        tx,
      );
    } else {
      const [ecriture] = await tx
        .insert(schema.encaissement)
        .values({ dossierId, devisId: s.devis?.id ?? null, type: 'credit', nature: 'autre', montant: -montant, moyen: 'credit_client', recuLe: dateDuJour(maintenant), commentaire: `Trop-perçu versé au crédit du client${commentaire ? ` — ${commentaire}` : ''}`, auteurId: a.id })
        .returning({ id: schema.encaissement.id });
      await tx.insert(schema.mouvementCredit).values({ clientId: d.clientId, montant, libelle: `Trop-perçu du dossier ${d.numero}`, dossierId, ajustementId, auteurId: a.id });
      await journaliser({ ...auditDe(auteurDe(a)), action: 'credit_client.credite', objetType: 'client', objetId: d.clientId, apres: { montant, dossierId, ajustementId, encaissementId: ecriture!.id } }, tx);
      soldeRecu = await appliquerGardeSolde(tx, dossierId);
    }
    await evenementDossier(tx, dossierId, `Ajustement du trop-perçu préparé : ${CHOIX_AJUSTEMENT[e.choix].toLowerCase()} de ${formaterMontant(montant)}${e.choix === 'remboursement' ? ' (à valider par la Direction)' : ''}`, auteurDe(a), 'modification', { ajustementId, choix: e.choix, montant });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'ajustement.prepare', objetType: 'dossier', objetId: dossierId, apres: { ajustementId, choix: e.choix, montant, remboursementId }, details: commentaire ? { commentaire } : undefined }, tx);
    return { ajustementId, montant, remboursementId, soldeRecu };
  });
  declencherEnvoi();
  return r;
}

// ─── Remboursements (RG-11) ───────────────────────────────────

async function verrouillerRemboursement(tx: Tx, id: number) {
  const [r] = await tx.select().from(schema.remboursement).where(eq(schema.remboursement.id, id)).for('update');
  if (!r) throw new ErreurMetier('Remboursement introuvable.');
  const [d] = await tx.select({ numero: schema.dossier.numero, referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
  return { r, d: d! };
}

async function exigerValidation(a: ActeurRegularisation, remboursementId: number) {
  if (peut(a.roles, 'remboursement.valider')) return;
  await journaliser({ ...auditDe(auteurDe(a)), action: 'acces.refuse', objetType: 'remboursement', objetId: remboursementId, details: { permission: 'remboursement.valider' } });
  throw new ErreurAccesRegularisation(MESSAGE_VALIDATION_REMBOURSEMENT);
}

/** RG-11 : la Direction valide un remboursement `à valider` ; les Responsables finances sont notifiés. */
export async function validerRemboursement(id: number, a: ActeurRegularisation, maintenant = new Date()): Promise<void> {
  await exigerValidation(a, id);
  await getDb().transaction(async (tx) => {
    const { r, d } = await verrouillerRemboursement(tx, id);
    if (r.statut !== 'a_valider') throw new ErreurMetier('Ce remboursement n’est pas à valider.');
    await tx.update(schema.remboursement).set({ statut: 'valide', valideParId: a.id, valideLe: maintenant }).where(eq(schema.remboursement.id, id));
    await evenementDossier(tx, r.dossierId, `Remboursement de ${formaterMontant(r.montant)} validé par la Direction`, auteurDe(a), 'modification', { remboursementId: id, statut: 'valide' });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'remboursement.valide', objetType: 'remboursement', objetId: id, avant: 'a_valider', apres: 'valide', details: { dossierId: r.dossierId, montant: r.montant } }, tx);
    await notifier(
      {
        destinataires: (await idsFinances(tx)).filter((x) => x !== a.id),
        type: 'remboursement_valide',
        dossierId: r.dossierId,
        titre: `Remboursement validé : ${d.numero}`,
        texte: `${d.numero} : remboursement de ${formaterMontant(r.montant)} validé par la Direction. Enregistrez la sortie (moyen, référence, date, justificatif) une fois effectuée.`,
        lien: lienOngletFinances(r.dossierId),
        cle: `remboursement_valide:${id}`,
        email: true,
      },
      tx,
    );
    if (d.referentId && d.referentId !== a.id) {
      await notifier({ destinataires: [d.referentId], type: 'remboursement_valide', dossierId: r.dossierId, titre: `Remboursement validé : ${d.numero}`, texte: `${d.numero} : le remboursement de ${formaterMontant(r.montant)} est validé ; le Responsable finances va l’effectuer.`, lien: lienOngletFinances(r.dossierId), cle: `remboursement_valide:${id}` }, tx);
    }
  });
  declencherEnvoi();
}

/** RG-11 : la Direction refuse un remboursement `à valider` (motif obligatoire) ; le montant redevient à régulariser. */
export async function refuserRemboursement(id: number, motif: string, a: ActeurRegularisation, maintenant = new Date()): Promise<void> {
  await exigerValidation(a, id);
  const m = motif?.trim().slice(0, 1000);
  if (!m) throw new ErreurMetier('Indiquez le motif du refus.');
  await getDb().transaction(async (tx) => {
    const { r, d } = await verrouillerRemboursement(tx, id);
    if (r.statut !== 'a_valider') throw new ErreurMetier('Ce remboursement n’est pas à valider.');
    await tx.update(schema.remboursement).set({ statut: 'refuse', valideParId: a.id, valideLe: maintenant, motifRefus: m }).where(eq(schema.remboursement.id, id));
    await evenementDossier(tx, r.dossierId, `Remboursement de ${formaterMontant(r.montant)} refusé par la Direction : ${m}`, auteurDe(a), 'modification', { remboursementId: id, statut: 'refuse', motif: m });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'remboursement.refuse', objetType: 'remboursement', objetId: id, avant: 'a_valider', apres: 'refuse', details: { dossierId: r.dossierId, motif: m } }, tx);
    const destinataires = [d.referentId, r.prepareParId].filter((x): x is string => !!x && x !== a.id);
    await notifier({ destinataires, type: 'remboursement_refuse', dossierId: r.dossierId, titre: `Remboursement refusé : ${d.numero}`, texte: `${d.numero} : le remboursement de ${formaterMontant(r.montant)} est refusé (${m}). Le trop-perçu reste à régulariser : préparez un nouvel ajustement.`, lien: lienOngletFinances(r.dossierId), cle: `remboursement_refuse:${id}` }, tx);
  });
}

export interface SortieRemboursement {
  moyen: MoyenPaiement;
  reference?: string | null;
  /** Date de sortie AAAA-MM-JJ (≤ aujourd'hui). */
  date: string;
  justificatif?: Fichier | null;
  commentaire?: string | null;
}

/**
 * RG-11 : le Responsable finances (ou la Direction) enregistre la sortie d'un remboursement
 * `validé` : écriture `remboursement` négative (moyen, référence, date, justificatif archivé dans
 * les Documents du Dossier), statut `effectué`, puis garde « Solde reçu ».
 */
export async function effectuerRemboursement(id: number, e: SortieRemboursement, a: ActeurRegularisation, maintenant = new Date()): Promise<{ encaissementId: number; soldeRecu: boolean }> {
  if (!a.roles.includes('finances') && !a.roles.includes('direction')) {
    await journaliser({ ...auditDe(auteurDe(a)), action: 'acces.refuse', objetType: 'remboursement', objetId: id, details: { action: 'effectuer' } });
    throw new ErreurAccesRegularisation(MESSAGE_EXECUTION_REMBOURSEMENT);
  }
  if (!(e.moyen in MOYENS_PAIEMENT)) throw new ErreurMetier('Moyen de paiement invalide.');
  const fichier = e.justificatif && e.justificatif.octets.byteLength > 0 ? e.justificatif : null;
  const [prealable] = await getDb().select({ montant: schema.remboursement.montant }).from(schema.remboursement).where(eq(schema.remboursement.id, id));
  if (!prealable) throw new ErreurMetier('Remboursement introuvable.');
  const erreurs = erreursSaisie({ nature: 'autre', montant: prealable.montant, moyen: e.moyen, reference: e.reference, recuLe: e.date, aUnJustificatif: !!fichier, commentaire: e.commentaire }, dateDuJour(maintenant));
  if (erreurs.length) throw new ErreurMetier(erreurs.join(' '));
  let depot: { cle: string; mime: string; nom: string; taille: number } | null = null;
  if (fichier) {
    const v = validerFichier(fichier.nom, fichier.octets);
    if (!v.ok) throw new ErreurMetier(v.erreur);
    if (v.type === 'docx') throw new ErreurMetier('Le justificatif doit être une image (photo, capture d’écran) ou un PDF.');
    const cle = nouvelleCle('dossiers', v.type === 'jpeg' ? 'jpg' : v.type);
    await getStockage().deposer(cle, fichier.octets);
    depot = { cle, mime: v.mime, nom: fichier.nom.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150), taille: fichier.octets.byteLength };
  }
  try {
    return await getDb().transaction(async (tx) => {
      const { r } = await verrouillerRemboursement(tx, id);
      if (r.statut !== 'valide') throw new ErreurMetier(r.statut === 'effectue' ? 'Ce remboursement est déjà effectué.' : 'Le remboursement doit être validé par la Direction avant d’être effectué.');
      let justificatifDocumentId: number | null = null;
      if (depot) {
        const [doc] = await tx.insert(schema.document).values({ dossierId: r.dossierId, cle: depot.cle, nomOrigine: depot.nom, mime: depot.mime, taille: depot.taille, categorie: 'justificatif', auteurId: a.id }).returning({ id: schema.document.id });
        justificatifDocumentId = doc!.id;
      }
      const reference = e.reference?.trim().slice(0, 100) || null;
      const [ecriture] = await tx
        .insert(schema.encaissement)
        .values({
          dossierId: r.dossierId,
          type: 'remboursement',
          nature: 'autre',
          montant: -r.montant,
          moyen: e.moyen,
          reference,
          referenceNormalisee: reference ? normaliserReference(reference) : null,
          recuLe: e.date,
          justificatifDocumentId,
          commentaire: e.commentaire?.trim().slice(0, 1000) || null,
          remboursementId: id,
          auteurId: a.id,
        })
        .returning({ id: schema.encaissement.id });
      await tx.update(schema.remboursement).set({ statut: 'effectue', effectueParId: a.id, effectueLe: maintenant, encaissementId: ecriture!.id }).where(eq(schema.remboursement.id, id));
      await evenementDossier(tx, r.dossierId, `Remboursement de ${formaterMontant(r.montant)} effectué (${MOYENS_PAIEMENT[e.moyen]}${reference ? `, réf. ${reference}` : ''}, le ${e.date})`, auteurDe(a), 'modification', { remboursementId: id, encaissementId: ecriture!.id });
      await journaliser({ ...auditDe(auteurDe(a)), action: 'remboursement.effectue', objetType: 'remboursement', objetId: id, avant: 'valide', apres: 'effectue', details: { dossierId: r.dossierId, montant: r.montant, moyen: e.moyen, reference, date: e.date, encaissementId: ecriture!.id } }, tx);
      const soldeRecu = await appliquerGardeSolde(tx, r.dossierId);
      return { encaissementId: ecriture!.id, soldeRecu };
    });
  } catch (err) {
    if (depot) await getStockage().supprimer(depot.cle);
    throw err;
  }
}

// ─── Impayés (RG-09) ──────────────────────────────────────────

/** Période des relances après la première (RG-09). */
export const PERIODE_RELANCE_SOLDE_JOURS = 7;

/**
 * RG-09 : facture de solde non réglée `delai_relance_solde_jours` (15) jours après émission →
 * alerte au référent et aux Responsables finances, puis tous les 7 jours (`derniereRelanceSoldeLe`).
 * Appelée par la tâche planifiée ; idempotente (clé de notification par jour).
 */
export async function relancerSoldesImpayes(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const delaiJours = await lireParametre('delai_relance_solde_jours');
  const factures = await db
    .select({ id: schema.facture.id, numero: schema.facture.numero, emiseLe: schema.facture.emiseLe, dossierId: schema.facture.dossierId, dossierNumero: schema.dossier.numero, referentId: schema.dossier.referentId, montantFinalTtc: schema.dossier.montantFinalTtc, derniereRelanceSoldeLe: schema.dossier.derniereRelanceSoldeLe })
    .from(schema.facture)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.facture.dossierId))
    .where(and(eq(schema.facture.type, 'solde'), isNotNull(schema.dossier.montantFinalTtc), ne(schema.dossier.statut, 'cloture')))
    .orderBy(desc(schema.facture.emiseLe), desc(schema.facture.id));
  // Dernière facture de solde de chaque Dossier.
  const parDossier = new Map<number, (typeof factures)[number]>();
  for (const f of factures) if (!parDossier.has(f.dossierId)) parDossier.set(f.dossierId, f);
  const finances = parDossier.size ? await idsFinances() : [];
  const jour = dateDuJour(maintenant);
  let n = 0;
  for (const f of parDossier.values()) {
    if (!relanceSoldeDue({ emiseLe: f.emiseLe, derniereRelanceLe: f.derniereRelanceSoldeLe, maintenant, delaiJours, periodeJours: PERIODE_RELANCE_SOLDE_JOURS })) continue;
    const reste = f.montantFinalTtc! - encaissementsNets((await ecrituresDossier(db, f.dossierId)).map(versEcriture));
    if (reste <= 0) continue;
    await db.transaction(async (tx) => {
      await notifier(
        {
          destinataires: [f.referentId, ...finances],
          type: 'solde_impaye',
          dossierId: f.dossierId,
          titre: `Solde impayé : ${f.dossierNumero}`,
          texte: `${f.dossierNumero} : la facture de solde ${f.numero} du ${new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long' }).format(f.emiseLe)} n’est pas réglée (reste ${formaterMontant(reste)}). Relancez le client (modèle WhatsApp « Relance solde »).`,
          lien: lienOngletFinances(f.dossierId),
          cle: `solde_impaye:${f.dossierId}:${jour}`,
          email: true,
        },
        tx,
      );
      await tx.update(schema.dossier).set({ derniereRelanceSoldeLe: maintenant }).where(eq(schema.dossier.id, f.dossierId));
      await journaliser({ acteurType: 'systeme', action: 'dossier.relance_solde', objetType: 'dossier', objetId: f.dossierId, details: { facture: f.numero, reste } }, tx);
    });
    n++;
  }
  return n;
}
