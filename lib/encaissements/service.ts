// Service Back-Office des Encaissements (specs/MVP2-05 RG-01..06, RG-14 ; ADR 0018, 0020).
// Indépendant de Next.js : utilisé par les actions serveur de l'onglet Finances et les tests.
//
// Droits (ADR 0018) :
//  - enregistrer : permission `encaissement.enregistrer` ET (Responsable finances / Direction :
//    tout Dossier ; Référent : uniquement ses Dossiers) ;
//  - demander l'annulation : mêmes personnes ; annuler (ou refuser une demande) : Finances ou Direction ;
//  - lire l'onglet Finances : `peutVoir` (référent du Dossier, Finances, Direction).
//
// Choix documentés (lot A) :
//  - Dossiers REC uniquement, ouverts, avec un devis de référence (accepté, ou envoyé — RG-06).
//  - Cas limite « tout payé au départ » : un Encaissement `acompte` est plafonné au reste d'acompte
//    dû ; l'excédent devient une écriture `autre` **séparée**, avec **son propre reçu** (une écriture
//    = un reçu, numérotation REÇ sans trou ; les deux écritures partagent référence et justificatif).
//  - RG-03 : doublon = même moyen + même référence normalisée sur une écriture `encaissement` non
//    annulée (tous Dossiers confondus). Verrou consultatif transactionnel sur (moyen, référence)
//    contre deux saisies simultanées.
//  - RG-02 : l'annulation crée l'écriture inverse (montant opposé, même nature et moyen, sans reçu) ;
//    le reçu d'origine est « annulé » par dérivation. Elle ne fait jamais reculer le statut du
//    Dossier : un avertissement est renvoyé si l'acompte (ou le solde) n'est plus couvert.
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peut } from '@/lib/authz/permissions';
import { peutVoir, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { estFinal, STATUTS, type Statut } from '@/lib/dossiers/statuts';
import { auditDe, evenementDossier, type AuteurEffet, type Tx } from '@/lib/devis/effets';
import { formaterMontant } from '@/lib/devis/domaine';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { declencherEnvoi, notifier } from '@/lib/notifications';
import { acompteDu, appliquerGardeAcompte, appliquerGardeSolde, archiverPdfRecuSansEchec, devisDeReference, ecrituresDossier, prochainNumeroRecu, versEcriture } from './effets';
import {
  acompteEncaisse,
  dateDuJour,
  encaissementsNets,
  erreursSaisie,
  idsAnnules,
  libelleAcomptePartiel,
  MOYENS_PAIEMENT,
  MOYENS_SAISIE,
  NATURE_CODES,
  NATURES_ENCAISSEMENT,
  normaliserReference,
  repartirAcompte,
  type MoyenPaiement,
  type NatureEncaissement,
} from './domaine';

export interface ActeurEncaissement extends Demandeur {
  ip?: string | null;
}

export interface FichierJustificatif {
  nom: string;
  octets: Uint8Array;
}

const auteurDe = (a: ActeurEncaissement): AuteurEffet => ({ type: 'collaborateur', id: a.id, ip: a.ip ?? null });

/** Onglet Finances d'un Dossier. */
export const lienFinancesDossier = (dossierId: number) => `/admin/dossiers/${dossierId}?onglet=finances`;
/** Lien vers un Encaissement précis (ancre de sa ligne dans l'onglet Finances). */
export const lienEncaissement = (dossierId: number, encaissementId: number) => `${lienFinancesDossier(dossierId)}#encaissement-${encaissementId}`;

export const estFinancesOuDirection = (a: Demandeur) => a.roles.includes('finances') || a.roles.includes('direction');

/** RG-01 (ADR 0018) : Finances / Direction sur tout Dossier ; Référent sur ses Dossiers. */
export function peutEnregistrerEncaissement(a: Demandeur, referentId: string | null): boolean {
  if (!peut(a.roles, 'encaissement.enregistrer')) return false;
  return estFinancesOuDirection(a) || (referentId !== null && referentId === a.id);
}

/** RG-02 : l'annulation est réservée au Responsable finances et à la Direction. */
export const peutAnnulerEncaissement = (a: Demandeur) => estFinancesOuDirection(a);

export const MESSAGE_ANNULATION_RESERVEE = 'Seuls le Responsable finances et la Direction peuvent annuler un encaissement : utilisez « Demander l’annulation ».';

/** RG-03 : doublon, avec le lien vers l'Encaissement existant. */
export class ErreurDoublon extends ErreurMetier {
  constructor(
    readonly dossierId: number,
    readonly encaissementId: number,
    readonly dossierNumero: string,
    readonly recuNumero: string | null,
  ) {
    super(`Ce paiement est déjà enregistré (même moyen et même référence)${recuNumero ? ` : reçu ${recuNumero}` : ''}, dossier ${dossierNumero}.`);
  }
  get lien() {
    return lienEncaissement(this.dossierId, this.encaissementId);
  }
}

// ─── Saisie ───────────────────────────────────────────────────

export const schemaSaisie = z.object({
  nature: z.enum(NATURE_CODES, { message: 'Choisissez la nature du paiement.' }),
  montant: z.number(),
  moyen: z.enum(MOYENS_SAISIE as [MoyenPaiement, ...MoyenPaiement[]], { message: 'Choisissez le moyen de paiement.' }),
  reference: z.string().trim().max(120, 'Référence trop longue (120 caractères maximum).').optional().nullable(),
  recuLe: z.string().trim(),
  commentaire: z.string().trim().max(1000, 'Commentaire trop long (1 000 caractères maximum).').optional().nullable(),
});
export type SaisieEncaissementEntree = z.input<typeof schemaSaisie>;

function validerJustificatif(f: FichierJustificatif | null | undefined) {
  if (!f || f.octets.byteLength === 0) return null;
  const v = validerFichier(f.nom, f.octets);
  if (!v.ok) throw new ErreurMetier(v.erreur);
  if (v.type === 'docx') throw new ErreurMetier('Le justificatif doit être une photo (reçu opérateur, avis de virement) ou un PDF.');
  return { extension: v.type === 'jpeg' ? 'jpg' : v.type, mime: v.mime };
}

/** Collaborateurs actifs Responsable finances ou Direction (notifications des demandes d'annulation). */
async function idsFinancesDirection(tx: Tx): Promise<string[]> {
  const r = await tx
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), inArray(schema.collaborateurRole.role, ['finances', 'direction'])));
  return [...new Set(r.map((x) => x.id))];
}

const libelleEcriture = (e: { nature: NatureEncaissement; moyen: MoyenPaiement; reference: string | null; montant: number }) =>
  `${formaterMontant(Math.abs(e.montant))} (${NATURES_ENCAISSEMENT[e.nature]}, ${MOYENS_PAIEMENT[e.moyen]}${e.reference ? `, réf. ${e.reference}` : ''})`;

export interface ResultatEnregistrement {
  /** Écritures créées (une, ou deux si l'acompte a été plafonné). */
  encaissements: { id: number; recuNumero: string; nature: NatureEncaissement; montant: number }[];
  /** Transition automatique provoquée (RG-05, RG-08). */
  transition: 'acompte_recu' | 'solde_recu' | null;
  /** Devis de rattachement (RG-06 : envoyé si pas encore accepté). */
  devis: { id: number; numero: string; statut: string };
  /** Message d'information pour l'interface (plafonnement, acompte partiel, acceptation attendue). */
  informations: string[];
}

/**
 * RG-01, RG-03..06 : enregistre un paiement reçu. Le justificatif (photo / PDF) devient un document
 * du Dossier de catégorie `justificatif`, dans la même transaction. Reçu numéroté dans la
 * transaction, PDF archivé après (sans faire échouer l'enregistrement).
 */
export async function enregistrerEncaissement(dossierId: number, entree: SaisieEncaissementEntree, justificatif: FichierJustificatif | null | undefined, a: ActeurEncaissement, maintenant = new Date()): Promise<ResultatEnregistrement> {
  const s = schemaSaisie.parse(entree);
  const reference = s.reference?.trim() || null;
  const commentaire = s.commentaire?.trim() || null;
  const fichier = validerJustificatif(justificatif);
  const erreurs = erreursSaisie({ nature: s.nature, montant: s.montant, moyen: s.moyen, reference, recuLe: s.recuLe, aUnJustificatif: !!fichier, commentaire }, dateDuJour(maintenant));
  if (erreurs.length) throw new ErreurMetier(erreurs.join(' '));
  const referenceNormalisee = reference ? normaliserReference(reference) : null;

  // Droits vérifiés avant d'écrire le justificatif sur le disque.
  const [pre] = await getDb().select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!pre) throw new ErreurMetier('Dossier introuvable.');
  if (!peutEnregistrerEncaissement(a, pre.referentId)) throw new ErreurAccesDossier();

  const cle = fichier ? nouvelleCle('dossiers', fichier.extension) : null;
  if (cle) await getStockage().deposer(cle, justificatif!.octets);
  let resultat: ResultatEnregistrement;
  try {
    resultat = await getDb().transaction(async (tx) => {
      const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
      if (!d) throw new ErreurMetier('Dossier introuvable.');
      if (!peutEnregistrerEncaissement(a, d.referentId)) throw new ErreurAccesDossier();
      if (d.type !== 'REC') throw new ErreurMetier('Les encaissements intégrés concernent les dossiers de recrutement.');
      if (estFinal(d.statut)) throw new ErreurMetier(`Le dossier est « ${STATUTS[d.statut]} » : aucun encaissement ne peut y être enregistré.`);
      const dv = await devisDeReference(tx, dossierId);
      if (!dv) throw new ErreurMetier('Aucun devis envoyé ou accepté sur ce dossier : envoyez d’abord le devis (onglet Devis).');

      // RG-03 : anti-doublon, protégé contre deux saisies simultanées de la même référence.
      if (referenceNormalisee) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`encaissement|${s.moyen}|${referenceNormalisee}`}))`);
        const candidats = await tx
          .select({ id: schema.encaissement.id, dossierId: schema.encaissement.dossierId, recuNumero: schema.encaissement.recuNumero, numero: schema.dossier.numero })
          .from(schema.encaissement)
          .innerJoin(schema.dossier, eq(schema.dossier.id, schema.encaissement.dossierId))
          .where(and(eq(schema.encaissement.type, 'encaissement'), eq(schema.encaissement.moyen, s.moyen), eq(schema.encaissement.referenceNormalisee, referenceNormalisee)))
          .orderBy(schema.encaissement.id);
        if (candidats.length) {
          const annulations = await tx
            .select({ id: schema.encaissement.annuleEncaissementId })
            .from(schema.encaissement)
            .where(and(eq(schema.encaissement.type, 'annulation'), inArray(schema.encaissement.annuleEncaissementId, candidats.map((c) => c.id))));
          const annules = new Set(annulations.map((x) => x.id));
          const existant = candidats.find((c) => !annules.has(c.id));
          if (existant) throw new ErreurDoublon(existant.dossierId, existant.id, existant.numero, existant.recuNumero);
        }
      }

      // Justificatif : document interne du Dossier (jamais montré au client, RG-15).
      let justificatifDocumentId: number | null = null;
      if (cle && fichier) {
        const nomOrigine = justificatif!.nom.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150);
        const [doc] = await tx
          .insert(schema.document)
          .values({ dossierId, cle, nomOrigine, mime: fichier.mime, taille: justificatif!.octets.byteLength, categorie: 'justificatif', auteurId: a.id })
          .returning({ id: schema.document.id });
        justificatifDocumentId = doc!.id;
        await journaliser({ ...auditDe(auteurDe(a)), action: 'document.televerse', objetType: 'document', objetId: doc!.id, details: { dossierId, categorie: 'justificatif', taille: justificatif!.octets.byteLength } }, tx);
      }

      // Cas limite : acompte plafonné au reste dû, excédent en écriture `autre` séparée.
      const informations: string[] = [];
      const avant = (await ecrituresDossier(tx, dossierId)).map(versEcriture);
      const du = acompteDu(dv);
      const parts: { nature: NatureEncaissement; montant: number }[] = [];
      if (s.nature === 'acompte') {
        const { acompte, excedent } = repartirAcompte(s.montant, du, acompteEncaisse(avant));
        if (acompte > 0) parts.push({ nature: 'acompte', montant: acompte });
        if (excedent > 0) {
          parts.push({ nature: 'autre', montant: excedent });
          informations.push(
            acompte > 0
              ? `Acompte plafonné à ${formaterMontant(acompte)} (montant dû) ; l’excédent de ${formaterMontant(excedent)} est enregistré en « Autre » (imputé au solde à la clôture), avec son propre reçu.`
              : `L’acompte est déjà entièrement encaissé : le paiement de ${formaterMontant(excedent)} est enregistré en « Autre » (imputé au solde à la clôture).`,
          );
        }
      } else parts.push({ nature: s.nature, montant: s.montant });

      const crees: ResultatEnregistrement['encaissements'] = [];
      for (const p of parts) {
        const recuNumero = await prochainNumeroRecu(tx);
        const [e] = await tx
          .insert(schema.encaissement)
          .values({ dossierId, devisId: dv.id, type: 'encaissement', nature: p.nature, montant: p.montant, moyen: s.moyen, reference, referenceNormalisee, recuLe: s.recuLe, justificatifDocumentId, commentaire, recuNumero, auteurId: a.id })
          .returning({ id: schema.encaissement.id });
        crees.push({ id: e!.id, recuNumero, nature: p.nature, montant: p.montant });
        await evenementDossier(tx, dossierId, `Encaissement enregistré — reçu ${recuNumero} : ${libelleEcriture({ ...p, moyen: s.moyen, reference })}, reçu le ${s.recuLe}${dv.statut !== 'accepte' ? ` — rattaché au devis envoyé ${dv.numero} v${dv.version}` : ''}`, auteurDe(a), 'document', {
          encaissementId: e!.id,
          recuNumero,
          devisId: dv.id,
        });
        await journaliser({ ...auditDe(auteurDe(a)), action: 'encaissement.enregistre', objetType: 'encaissement', objetId: e!.id, apres: { dossierId, devisId: dv.id, nature: p.nature, montant: p.montant, moyen: s.moyen, reference, recuLe: s.recuLe, recuNumero, justificatifDocumentId } }, tx);
      }

      // RG-05, RG-08 : gardes de statut.
      let transition: ResultatEnregistrement['transition'] = null;
      if (await appliquerGardeAcompte(tx, dossierId)) transition = 'acompte_recu';
      if (await appliquerGardeSolde(tx, dossierId)) transition = 'solde_recu';
      if (dv.statut !== 'accepte') informations.push(`Paiement rattaché au devis envoyé ${dv.numero} v${dv.version} : enregistrez l’acceptation du devis (onglet Devis) pour que le dossier avance.`);
      else if (!transition && d.statut === 'accepte') {
        const encaisse = acompteEncaisse((await ecrituresDossier(tx, dossierId)).map(versEcriture));
        if (encaisse > 0 && encaisse < du) informations.push(libelleAcomptePartiel(encaisse, du).replace(/^a/, 'A') + '.');
      }

      // Le référent est prévenu d'un paiement saisi par quelqu'un d'autre (Finances, Direction).
      if (d.referentId && d.referentId !== a.id) {
        await notifier(
          {
            destinataires: [d.referentId],
            type: 'encaissement',
            dossierId,
            titre: `Paiement enregistré sur ${d.numero}`,
            texte: `${d.numero} : paiement de ${formaterMontant(s.montant)} (${MOYENS_PAIEMENT[s.moyen]}${reference ? `, réf. ${reference}` : ''}) enregistré — reçu ${crees.map((c) => c.recuNumero).join(', ')}.${transition ? ` Le dossier passe à « ${STATUTS[transition]} ».` : ''}`,
            lien: lienFinancesDossier(dossierId),
            cle: `encaissement:${crees[0]!.id}`,
          },
          tx,
        );
      }
      return { encaissements: crees, transition, devis: { id: dv.id, numero: dv.numero, statut: dv.statut }, informations };
    });
  } catch (err) {
    if (cle) await getStockage().supprimer(cle); // pas de fichier orphelin
    throw err;
  }
  // RG-04 : PDF du reçu, après la transaction (rendu : lot C ; un échec n'annule rien).
  for (const e of resultat.encaissements) await archiverPdfRecuSansEchec(e.id);
  declencherEnvoi();
  return resultat;
}

// ─── Annulation (RG-02) ───────────────────────────────────────

async function encaissementPourAnnulation(tx: Tx, encaissementId: number) {
  const [e] = await tx.select().from(schema.encaissement).where(eq(schema.encaissement.id, encaissementId));
  if (!e) throw new ErreurMetier('Encaissement introuvable.');
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, e.dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (e.type !== 'encaissement') throw new ErreurMetier('Seul un encaissement reçu peut être annulé.');
  const [deja] = await tx.select({ id: schema.encaissement.id }).from(schema.encaissement).where(eq(schema.encaissement.annuleEncaissementId, encaissementId));
  if (deja) throw new ErreurMetier('Cet encaissement est déjà annulé.');
  return { e, d };
}

const texteMotif = (motif: string | null | undefined, message = 'Indiquez le motif.') => {
  const m = motif?.trim().slice(0, 1000) ?? '';
  if (!m) throw new ErreurMetier(message);
  return m;
};

/** RG-02 : le référent du Dossier (ou Finances / Direction) demande l'annulation d'un Encaissement. */
export async function demanderAnnulation(encaissementId: number, motif: string, a: ActeurEncaissement): Promise<{ demandeId: number }> {
  const m = texteMotif(motif, 'Indiquez le motif de la demande d’annulation.');
  const r = await getDb().transaction(async (tx) => {
    const { e, d } = await encaissementPourAnnulation(tx, encaissementId);
    if (!peutEnregistrerEncaissement(a, d.referentId)) throw new ErreurAccesDossier();
    const [enCours] = await tx
      .select({ id: schema.demandeAnnulation.id })
      .from(schema.demandeAnnulation)
      .where(and(eq(schema.demandeAnnulation.encaissementId, encaissementId), eq(schema.demandeAnnulation.statut, 'en_attente')));
    if (enCours) throw new ErreurMetier('Une demande d’annulation est déjà en cours pour cet encaissement.');
    const [dem] = await tx.insert(schema.demandeAnnulation).values({ encaissementId, motif: m, demandeParId: a.id }).returning({ id: schema.demandeAnnulation.id });
    await evenementDossier(tx, d.id, `Demande d’annulation de l’encaissement ${e.recuNumero ?? `n° ${e.id}`} (${libelleEcriture(e)}) : ${m}`, auteurDe(a), 'document', { encaissementId, demandeId: dem!.id });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'encaissement.annulation_demandee', objetType: 'encaissement', objetId: encaissementId, details: { demandeId: dem!.id, motif: m } }, tx);
    const destinataires = (await idsFinancesDirection(tx)).filter((id) => id !== a.id);
    await notifier(
      {
        destinataires,
        type: 'annulation_encaissement',
        dossierId: d.id,
        titre: `Demande d’annulation d’encaissement — ${d.numero}`,
        texte: `${d.numero} : annulation demandée pour l’encaissement ${e.recuNumero ?? `n° ${e.id}`} (${libelleEcriture(e)}). Motif : ${m}`,
        lien: lienEncaissement(d.id, encaissementId),
        cle: `demande_annulation:${dem!.id}`,
        email: true,
      },
      tx,
    );
    return { demandeId: dem!.id };
  });
  declencherEnvoi();
  return r;
}

export interface ResultatAnnulation {
  annulationId: number;
  /** Le Dossier a avancé mais l'acompte (ou le solde) n'est plus couvert : statut inchangé. */
  avertissement: string | null;
}

/** Statuts postérieurs à « Accepté » qui supposent l'acompte encaissé (dossiers REC). */
const STATUTS_APRES_ACOMPTE: readonly Statut[] = ['acompte_recu', 'recherche_en_cours', 'candidats_proposes', 'placements_confirmes', 'solde_recu', 'cloture'];

/**
 * RG-02 : annulation d'un Encaissement par Finances ou la Direction (motif obligatoire). Crée
 * l'écriture inverse liée, clôt les demandes en attente, notifie le(s) demandeur(s) et le référent.
 * Ne fait pas reculer le statut du Dossier (avertissement si l'acompte n'est plus couvert).
 */
export async function annulerEncaissement(encaissementId: number, motif: string, a: ActeurEncaissement, maintenant = new Date()): Promise<ResultatAnnulation> {
  if (!peutAnnulerEncaissement(a)) throw new ErreurMetier(MESSAGE_ANNULATION_RESERVEE);
  const m = texteMotif(motif, 'Indiquez le motif de l’annulation.');
  const r = await getDb().transaction(async (tx) => {
    const { e, d } = await encaissementPourAnnulation(tx, encaissementId);
    if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
    const [inv] = await tx
      .insert(schema.encaissement)
      .values({ dossierId: d.id, devisId: e.devisId, type: 'annulation', nature: e.nature, montant: -e.montant, moyen: e.moyen, reference: e.reference, recuLe: dateDuJour(maintenant), motif: m, annuleEncaissementId: e.id, auteurId: a.id })
      .returning({ id: schema.encaissement.id });
    const demandes = await tx
      .update(schema.demandeAnnulation)
      .set({ statut: 'acceptee', traiteeParId: a.id, traiteeLe: maintenant, reponse: m })
      .where(and(eq(schema.demandeAnnulation.encaissementId, encaissementId), eq(schema.demandeAnnulation.statut, 'en_attente')))
      .returning({ id: schema.demandeAnnulation.id, demandeParId: schema.demandeAnnulation.demandeParId });
    await evenementDossier(tx, d.id, `Encaissement ${e.recuNumero ?? `n° ${e.id}`} annulé (${libelleEcriture(e)}) — motif : ${m}. Le reçu est marqué « annulé ».`, auteurDe(a), 'document', { encaissementId: e.id, annulationId: inv!.id });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'encaissement.annule', objetType: 'encaissement', objetId: e.id, avant: { montant: e.montant, nature: e.nature, moyen: e.moyen, reference: e.reference, recuNumero: e.recuNumero }, details: { motif: m, annulationId: inv!.id, demandes: demandes.map((x) => x.id) } }, tx);
    // Un trop-perçu annulé peut solder le Dossier (RG-08).
    await appliquerGardeSolde(tx, d.id);

    // Avertissement : le Dossier a avancé alors que l'acompte (ou le solde) n'est plus couvert.
    const [apres] = await tx.select({ statut: schema.dossier.statut, montantFinalTtc: schema.dossier.montantFinalTtc }).from(schema.dossier).where(eq(schema.dossier.id, d.id));
    const ecritures = (await ecrituresDossier(tx, d.id)).map(versEcriture);
    const dv = await devisDeReference(tx, d.id);
    let avertissement: string | null = null;
    if (dv && STATUTS_APRES_ACOMPTE.includes(apres!.statut) && acompteEncaisse(ecritures) < acompteDu(dv)) {
      avertissement = `L’acompte encaissé (${formaterMontant(acompteEncaisse(ecritures))}) est désormais inférieur à l’acompte dû (${formaterMontant(acompteDu(dv))}) alors que le dossier est « ${STATUTS[apres!.statut]} ». Le statut n’est pas modifié automatiquement : régularisez le paiement ou faites revenir le dossier en arrière avec un motif.`;
    } else if ((apres!.statut === 'solde_recu' || apres!.statut === 'cloture') && apres!.montantFinalTtc !== null && apres!.montantFinalTtc - encaissementsNets(ecritures) > 0) {
      avertissement = `Il reste ${formaterMontant(apres!.montantFinalTtc - encaissementsNets(ecritures))} à encaisser alors que le dossier est « ${STATUTS[apres!.statut]} ». Le statut n’est pas modifié automatiquement.`;
    }

    const lien = lienEncaissement(d.id, e.id);
    const demandeurs = demandes.map((x) => x.demandeParId).filter((id): id is string => !!id && id !== a.id);
    await notifier({ destinataires: demandeurs, type: 'annulation_encaissement', dossierId: d.id, titre: `Annulation effectuée — ${d.numero}`, texte: `${d.numero} : l’encaissement ${e.recuNumero ?? `n° ${e.id}`} a été annulé. Motif : ${m}${avertissement ? `\n${avertissement}` : ''}`, lien, cle: `annulation_effectuee:${e.id}` }, tx);
    if (d.referentId && d.referentId !== a.id && !demandeurs.includes(d.referentId)) {
      await notifier({ destinataires: [d.referentId], type: 'annulation_encaissement', dossierId: d.id, titre: `Encaissement annulé — ${d.numero}`, texte: `${d.numero} : l’encaissement ${e.recuNumero ?? `n° ${e.id}`} (${libelleEcriture(e)}) a été annulé. Motif : ${m}${avertissement ? `\n${avertissement}` : ''}`, lien, cle: `annulation_effectuee:${e.id}` }, tx);
    }
    return { annulationId: inv!.id, avertissement };
  });
  declencherEnvoi();
  return r;
}

/**
 * RG-02 : traitement d'une demande d'annulation par Finances ou la Direction. Accepter = annuler
 * l'Encaissement (motif de la demande, complété de la réponse) ; refuser = réponse obligatoire.
 */
export async function traiterDemandeAnnulation(demandeId: number, decision: 'accepter' | 'refuser', reponse: string | null, a: ActeurEncaissement, maintenant = new Date()): Promise<ResultatAnnulation | null> {
  if (!peutAnnulerEncaissement(a)) throw new ErreurMetier(MESSAGE_ANNULATION_RESERVEE);
  const [dem] = await getDb().select().from(schema.demandeAnnulation).where(eq(schema.demandeAnnulation.id, demandeId));
  if (!dem) throw new ErreurMetier('Demande introuvable.');
  if (dem.statut !== 'en_attente') throw new ErreurMetier('Cette demande a déjà été traitée.');
  const rep = reponse?.trim().slice(0, 1000) || null;
  if (decision === 'accepter') return annulerEncaissement(dem.encaissementId, rep ? `${dem.motif} — ${rep}` : dem.motif, a, maintenant);
  const motifRefus = texteMotif(rep, 'Indiquez la raison du refus.');
  await getDb().transaction(async (tx) => {
    const [e] = await tx.select().from(schema.encaissement).where(eq(schema.encaissement.id, dem.encaissementId));
    const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, e!.dossierId)).for('update');
    if (!peutVoir(a, d!.referentId)) throw new ErreurAccesDossier();
    const maj = await tx
      .update(schema.demandeAnnulation)
      .set({ statut: 'refusee', traiteeParId: a.id, traiteeLe: maintenant, reponse: motifRefus })
      .where(and(eq(schema.demandeAnnulation.id, demandeId), eq(schema.demandeAnnulation.statut, 'en_attente')))
      .returning({ id: schema.demandeAnnulation.id });
    if (!maj.length) throw new ErreurMetier('Cette demande a déjà été traitée.');
    await evenementDossier(tx, d!.id, `Demande d’annulation de l’encaissement ${e!.recuNumero ?? `n° ${e!.id}`} refusée : ${motifRefus}`, auteurDe(a), 'document', { encaissementId: e!.id, demandeId });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'encaissement.annulation_refusee', objetType: 'encaissement', objetId: e!.id, details: { demandeId, reponse: motifRefus } }, tx);
    if (dem.demandeParId && dem.demandeParId !== a.id) {
      await notifier({ destinataires: [dem.demandeParId], type: 'annulation_encaissement', dossierId: d!.id, titre: `Demande d’annulation refusée — ${d!.numero}`, texte: `${d!.numero} : la demande d’annulation de l’encaissement ${e!.recuNumero ?? `n° ${e!.id}`} est refusée. Réponse : ${motifRefus}`, lien: lienEncaissement(d!.id, e!.id), cle: `annulation_refusee:${demandeId}` }, tx);
    }
  });
  declencherEnvoi();
  return null;
}

// ─── Lecture (onglet Finances, RG-14) ─────────────────────────

export interface LigneEncaissementVue {
  id: number;
  type: (typeof schema.encaissement.$inferSelect)['type'];
  nature: NatureEncaissement;
  montant: number;
  moyen: MoyenPaiement;
  reference: string | null;
  recuLe: string;
  commentaire: string | null;
  motif: string | null;
  recuNumero: string | null;
  /** PDF du reçu archivé (document du Dossier). */
  recuDocumentId: number | null;
  justificatifDocumentId: number | null;
  annule: boolean;
  annuleEncaissementId: number | null;
  auteurNom: string | null;
  /** Demande d'annulation en attente. */
  demandeEnCours: { id: number; motif: string; demandeParNom: string | null; demandeLe: Date } | null;
}

/** Écritures du Dossier pour l'onglet Finances (lecture : `peutVoir`). */
export async function lireEncaissementsDossier(dossierId: number, a: Demandeur): Promise<LigneEncaissementVue[]> {
  const db = getDb();
  const [d] = await db.select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d) return [];
  if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
  const lignes = await ecrituresDossier(db, dossierId);
  if (!lignes.length) return [];
  const ids = lignes.map((l) => l.id);
  const auteurs = [...new Set(lignes.map((l) => l.auteurId).filter((x): x is string => !!x))];
  const [recus, demandes, noms] = await Promise.all([
    db.select().from(schema.recuPdf).where(inArray(schema.recuPdf.encaissementId, ids)),
    db
      .select({ dem: schema.demandeAnnulation, nom: schema.user.name })
      .from(schema.demandeAnnulation)
      .leftJoin(schema.user, eq(schema.user.id, schema.demandeAnnulation.demandeParId))
      .where(and(inArray(schema.demandeAnnulation.encaissementId, ids), eq(schema.demandeAnnulation.statut, 'en_attente'))),
    auteurs.length ? db.select({ id: schema.user.id, nom: schema.user.name }).from(schema.user).where(inArray(schema.user.id, auteurs)) : Promise.resolve([]),
  ]);
  const annules = idsAnnules(lignes.map(versEcriture));
  const recuDe = new Map(recus.map((r) => [r.encaissementId, r.documentId]));
  const nomDe = new Map(noms.map((n) => [n.id, n.nom]));
  const demandeDe = new Map(demandes.map(({ dem, nom }) => [dem.encaissementId, { id: dem.id, motif: dem.motif, demandeParNom: nom, demandeLe: dem.demandeLe }]));
  return lignes.map((l) => ({
    id: l.id,
    type: l.type,
    nature: l.nature,
    montant: l.montant,
    moyen: l.moyen,
    reference: l.reference,
    recuLe: l.recuLe,
    commentaire: l.commentaire,
    motif: l.motif,
    recuNumero: l.recuNumero,
    recuDocumentId: recuDe.get(l.id) ?? null,
    justificatifDocumentId: l.justificatifDocumentId,
    annule: annules.has(l.id),
    annuleEncaissementId: l.annuleEncaissementId,
    auteurNom: l.auteurId ? (nomDe.get(l.auteurId) ?? null) : null,
    demandeEnCours: demandeDe.get(l.id) ?? null,
  }));
}

/** Documents attendus non émis (RG-13) : factures et reçus sans PDF archivé. */
export async function documentsManquants(dossierId: number, db: Pick<ReturnType<typeof getDb>, 'select'> = getDb()): Promise<string[]> {
  const [factures, recus] = await Promise.all([
    db
      .select({ numero: schema.facture.numero })
      .from(schema.facture)
      .leftJoin(schema.facturePdf, eq(schema.facturePdf.factureId, schema.facture.id))
      .where(and(eq(schema.facture.dossierId, dossierId), sql`${schema.facturePdf.factureId} is null`))
      .orderBy(schema.facture.id),
    db
      .select({ numero: schema.encaissement.recuNumero })
      .from(schema.encaissement)
      .leftJoin(schema.recuPdf, eq(schema.recuPdf.encaissementId, schema.encaissement.id))
      .where(and(eq(schema.encaissement.dossierId, dossierId), isNotNull(schema.encaissement.recuNumero), sql`${schema.recuPdf.encaissementId} is null`))
      .orderBy(schema.encaissement.id),
  ]);
  return [...factures.map((f) => `facture ${f.numero}`), ...recus.map((r) => `reçu ${r.numero}`)];
}

/** Devis et avenants du Dossier (liste courte de l'onglet Finances ; lecture : `peutVoir`). */
export async function listerDevisFinances(dossierId: number, a: Demandeur) {
  const db = getDb();
  const [d] = await db.select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d) return [];
  if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
  return db
    .select({ id: schema.devis.id, type: schema.devis.type, numero: schema.devis.numero, version: schema.devis.version, statut: schema.devis.statut, totalTtc: schema.devis.totalTtc, acompte: schema.devis.acompte, accepteLe: schema.devis.accepteLe })
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), sql`${schema.devis.statut} <> 'remplace'`))
    .orderBy(sql`${schema.devis.id} desc`);
}
