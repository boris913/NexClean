// Service Back-Office du devis et des avenants (specs/MVP2-04 RG-02..11, RG-14, RG-15 ; ADR 0008,
// 0009, 0010). Indépendant de Next.js : utilisé par les actions serveur, la tâche planifiée et les tests.
// Droits : référent du Dossier ou Direction (`peutTraiter`) ; validation hors bornes : Direction.
// Les effets partagés avec la page de suivi (acceptation, refus, factures) sont dans ./effets.ts.
//
// Choix documentés (lot A) :
//  - Création : Dossier REC « En qualification » uniquement (RG-03 : autres types → devis externe).
//    Un Dossier « Refusé » se rouvre d'abord en « En qualification » (RG-08) ; un seul devis non
//    terminal à la fois ; un devis accepté se complète par avenant.
//  - Taux d'acompte : la valeur est figée dans le devis ; le taux par défaut et les bornes sont
//    **relus** à chaque modification / validation (règle de contrôle de la Direction en vigueur, pas un prix).
//  - Nouvelle version (RG-07) : prix re-figés aux valeurs **actuelles** (RG-02 : nouveau devis =
//    nouvelles valeurs : commissions, TVA, garantie, validité, conditions, mentions) ; les éléments
//    négociés (quantités, taux d'acompte et sa justification, délai, conditions particulières) sont repris.
//    Si le Dossier était « Devis prêt » / « Devis envoyé », il revient « En qualification ».
//  - Avenant (RG-09) : lignes = écart de personnes par ligne de poste (voir ./lignes.ts), TVA,
//    délai, garantie et conditions du devis initial ; pas d'acompte (taux 0) : le montant final est
//    calculé à la clôture sur le devis + avenants acceptés. Une seule modification en cours à la fois.
import { and, asc, desc, eq, gt, lt, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { echapperHtml, envoyerEmail } from '@/lib/email';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, peutVoir, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier, noterMessageWhatsApp } from '@/lib/dossiers/service';
import { estFinal, STATUTS, type Statut } from '@/lib/dossiers/statuts';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { genererPdfDevis } from '@/lib/documents/rendu';
import { contexteDossier } from '@/lib/modeles/service';
import { rendreMessage, type ContexteMessage } from '@/lib/modeles/variables';
import { declencherEnvoi, idsDirection, notifier } from '@/lib/notifications';
import { lireParametre } from '@/lib/parametres';
import {
  calculerDevis,
  commissionPour,
  dateExpiration,
  donneesManquantes,
  estModifiable,
  estTermine,
  formaterMontant,
  MESSAGE_A_COMPLETER,
  STATUTS_DEVIS,
  totauxFiges,
  verifierTauxAcompte,
  type BornesAcompte,
  type LigneDevis,
  type StatutDevis,
  type Tarifs,
} from './domaine';
import { accepterDevis, archiverPdf, archiverPdfFacture, auditDe, evenementDossier, lienDevisDossier, prochainNumero, refuserDevis, transitionAutomatique, type AuteurEffet, type Tx } from './effets';
import { consoliderLignes, devisAccepte, type LigneFacturable } from './lignes';

export interface ActeurDevis extends Demandeur {
  ip?: string | null;
  /** Nom affiché (modèles WhatsApp). */
  nom?: string;
}

export interface Fichier {
  nom: string;
  octets: Uint8Array;
}

type Devis = typeof schema.devis.$inferSelect;
type Dossier = typeof schema.dossier.$inferSelect;

const auteurDe = (a: ActeurDevis): AuteurEffet => ({ type: 'collaborateur', id: a.id, ip: a.ip ?? null });
const estDirection = (a: Demandeur) => a.roles.includes('direction');

/** Libellé d'un devis : « Devis DEV-2026-00001 v2 » / « Avenant DEV-2026-00003 v1 ». */
export const libelleDevis = (d: Pick<Devis, 'type' | 'numero' | 'version'>) => `${d.type === 'avenant' ? 'Avenant' : 'Devis'} ${d.numero} v${d.version}`;
export const nomPdfDevis = (d: Pick<Devis, 'type' | 'numero' | 'version'>) => `${d.type === 'avenant' ? 'Avenant' : 'Devis'}-${d.numero}-v${d.version}.pdf`;
/** Capture de l'acceptation WhatsApp (RG-15), lue depuis le Back-Office. */
export const lienPreuveAcceptation = (dossierId: number, devisId: number) => `/admin/dossiers/${dossierId}/devis/${devisId}/preuve`;

export const MESSAGE_TYPE_NON_REC = 'Le devis intégré ne concerne que les dossiers de recrutement : pour ce type de dossier, joignez le devis externe (document « Devis externe »).';

/** RG-05 : données manquantes, listées dans le message (et exposées pour l'interface). */
export class ErreurDonneesManquantes extends ErreurMetier {
  constructor(readonly manques: string[]) {
    super(`Impossible de créer le devis, il manque : ${manques.join(', ')}. Complétez le dossier, ou passez-le « À compléter » pour obtenir ces informations du client.`);
  }
}

// ─── Modèle WhatsApp « Envoi du devis » (RG-10) ───────────────

export const NOM_MODELE_ENVOI_DEVIS = 'Envoi du devis';
/** Texte par défaut (inséré par migration à la fusion ; utilisé tant que le modèle n'est pas en base). */
export const MODELE_ENVOI_DEVIS =
  'Bonjour {{client.contact}}, voici votre devis {{devis.numero}} pour le dossier {{dossier.numero}} ({{postes.resume}}).\n\nMontant : {{devis.montant}}\nAcompte à l’acceptation : {{devis.acompte}}\nValable jusqu’au {{devis.validite}}.\n\nConsultez-le et acceptez-le en ligne (les 4 derniers chiffres de votre numéro vous seront demandés) : {{dossier.lien_suivi}}\n\n{{referent.prenom}}, NEXCLEAN — {{referent.telephone}}';

const formaterDate = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long' }).format(d);

// ─── Paramètres de la grille (RG-01) ─────────────────────────

interface Grille extends Tarifs {
  tauxAcompteDefaut: number;
  bornes: BornesAcompte;
  delaiRechercheJours: number;
  garantieJours: number;
  validiteJours: number;
  mentionsLegales: string;
  conditions: string;
}

/** Valeurs **actuelles** des paramètres, à figer dans un nouveau devis (RG-02). */
export async function grilleActuelle(): Promise<Grille> {
  const [commission, commissionsParCategorie, tauxTva, tauxAcompteDefaut, bornes, delaiRechercheJours, garantieJours, validiteJours, mentionsLegales, conditions] = await Promise.all([
    lireParametre('commission_par_personne'),
    lireParametre('commissions_par_categorie'),
    lireParametre('tva_taux'),
    lireParametre('acompte_taux_defaut'),
    lireParametre('acompte_bornes'),
    lireParametre('delai_recherche_jours'),
    lireParametre('garantie_jours'),
    lireParametre('validite_devis_jours'),
    lireParametre('mentions_legales'),
    lireParametre('conditions_devis'),
  ]);
  return { commission, commissionsParCategorie, tauxTva, tauxAcompteDefaut, bornes, delaiRechercheJours, garantieJours, validiteJours, mentionsLegales, conditions };
}

// ─── Verrous et droits ───────────────────────────────────────

/** Dossier verrouillé ; référent du Dossier ou Direction ; dossier de recrutement (RG-03). */
async function verrouillerDossier(tx: Tx, dossierId: number, a: Demandeur): Promise<Dossier> {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
  if (d.type !== 'REC') throw new ErreurMetier(MESSAGE_TYPE_NON_REC);
  return d;
}

/** Verrouille le Dossier puis le devis (ordre stable : Dossier → devis). */
async function devisPourEcriture(tx: Tx, devisId: number, a: Demandeur): Promise<{ dos: Dossier; dv: Devis }> {
  const [x] = await tx.select({ dossierId: schema.devis.dossierId }).from(schema.devis).where(eq(schema.devis.id, devisId));
  if (!x) throw new ErreurMetier('Devis introuvable.');
  const dos = await verrouillerDossier(tx, x.dossierId, a);
  const [dv] = await tx.select().from(schema.devis).where(eq(schema.devis.id, devisId)).for('update');
  return { dos, dv: dv! };
}

/** Contrôle des droits sans verrou (avant un dépôt de fichier ou la génération d'un PDF). */
async function verifierDroits(devisId: number, a: Demandeur): Promise<{ dv: Devis; referentId: string | null }> {
  const [r] = await getDb().select({ dv: schema.devis, referentId: schema.dossier.referentId }).from(schema.devis).innerJoin(schema.dossier, eq(schema.dossier.id, schema.devis.dossierId)).where(eq(schema.devis.id, devisId));
  if (!r) throw new ErreurMetier('Devis introuvable.');
  if (!peutTraiter(a, r.referentId)) throw new ErreurAccesDossier();
  return r;
}

/** Dernière version d'une chaîne (même numéro). */
async function estDerniereVersion(tx: Tx, dv: Devis): Promise<boolean> {
  const [plusRecente] = await tx
    .select({ id: schema.devis.id })
    .from(schema.devis)
    .where(and(eq(schema.devis.numero, dv.numero), gt(schema.devis.version, dv.version)))
    .limit(1);
  return !plusRecente;
}

/** Retour automatique « En qualification » (nouvelle version d'un devis validé ou envoyé). */
async function retourEnQualification(tx: Tx, dos: Dossier, motif: string, a: ActeurDevis): Promise<void> {
  if (dos.statut !== 'devis_pret' && dos.statut !== 'devis_envoye') return;
  await tx.update(schema.dossier).set({ statut: 'en_qualification' }).where(eq(schema.dossier.id, dos.id));
  await tx.insert(schema.evenementDossier).values({ dossierId: dos.id, auteurId: a.id, type: 'transition', deStatut: dos.statut, versStatut: 'en_qualification', commentaire: `Transition automatique : ${motif}` });
  await journaliser({ ...auditDe(auteurDe(a)), action: 'dossier.transition', objetType: 'dossier', objetId: dos.id, avant: dos.statut, apres: 'en_qualification', details: { automatique: true, motif } }, tx);
}

// ─── Lecture du Dossier pour le devis ────────────────────────

async function donneesDossier(tx: Pick<Tx, 'select'>, dos: Dossier) {
  const [c] = await tx.select({ nom: schema.client.nom, whatsapp: schema.client.whatsapp }).from(schema.client).where(eq(schema.client.id, dos.clientId));
  const lignes = await tx
    .select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre })
    .from(schema.lignePoste)
    .where(eq(schema.lignePoste.dossierId, dos.id))
    .orderBy(asc(schema.lignePoste.ordre));
  const manques = donneesManquantes({ statut: dos.statut, clientNom: c?.nom ?? null, whatsapp: c?.whatsapp ?? null, villeId: dos.villeId, villeAutre: dos.villeAutre, lignes });
  return { lignes, manques };
}

// ─── Création (RG-04, RG-05) ─────────────────────────────────

export async function creerDevis(dossierId: number, a: ActeurDevis): Promise<{ devisId: number; numero: string }> {
  const g = await grilleActuelle();
  const r = await getDb().transaction(async (tx) => {
    const dos = await verrouillerDossier(tx, dossierId, a);
    const { lignes, manques } = await donneesDossier(tx, dos);
    if (dos.statut === 'a_completer') {
      // RG-05 : refus avec la liste des données manquantes (et les informations demandées au client).
      const [demande] = await tx
        .select({ commentaire: schema.evenementDossier.commentaire })
        .from(schema.evenementDossier)
        .where(and(eq(schema.evenementDossier.dossierId, dossierId), eq(schema.evenementDossier.type, 'transition'), eq(schema.evenementDossier.versStatut, 'a_completer')))
        .orderBy(desc(schema.evenementDossier.id))
        .limit(1);
      const details = [manques.length ? `Il manque : ${manques.join(', ')}.` : null, demande?.commentaire ? `Informations demandées au client : ${demande.commentaire}` : null].filter(Boolean).join(' ');
      throw new ErreurMetier(details ? `${MESSAGE_A_COMPLETER} ${details}` : MESSAGE_A_COMPLETER);
    }
    if (manques.length) throw new ErreurDonneesManquantes(manques);
    if (dos.statut !== 'en_qualification') {
      throw new ErreurMetier(
        dos.statut === 'refuse'
          ? 'Le dossier est « Refusé » : rouvrez-le en « En qualification », puis créez une nouvelle version du devis refusé.'
          : `Le devis se crée quand le dossier est « En qualification » (statut actuel : ${STATUTS[dos.statut]}).`,
      );
    }
    const existants = await tx.select().from(schema.devis).where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis'))).orderBy(desc(schema.devis.id));
    if (existants.some((x) => x.statut === 'accepte')) throw new ErreurMetier('Un devis est déjà accepté sur ce dossier : créez un avenant.');
    const enCours = existants.find((x) => !estTermine(x.statut));
    if (enCours) throw new ErreurMetier(`${libelleDevis(enCours)} est en cours (${STATUTS_DEVIS[enCours.statut]}) : modifiez-le ou créez-en une nouvelle version.`);

    const t = calculerDevis(
      lignes.filter((l) => l.nombre > 0).map((l) => ({ lignePosteId: l.id, intitule: l.intitule, nombre: l.nombre })),
      g,
      g.tauxAcompteDefaut,
    );
    const numero = await prochainNumero(tx, 'devis');
    const [dv] = await tx
      .insert(schema.devis)
      .values({
        dossierId,
        clientId: dos.clientId,
        type: 'devis',
        numero,
        version: 1,
        statut: 'brouillon',
        lignes: t.lignes,
        tauxTva: g.tauxTva,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: t.tauxAcompte,
        acompte: t.acompte,
        delaiRechercheJours: g.delaiRechercheJours,
        garantieJours: g.garantieJours,
        validiteJours: g.validiteJours,
        conditions: g.conditions,
        mentionsLegales: g.mentionsLegales,
        auteurId: a.id,
      })
      .returning({ id: schema.devis.id });
    await evenementDossier(tx, dossierId, `Devis ${numero} v1 créé (brouillon) : ${formaterMontant(t.totalTtc)}`, auteurDe(a), 'document', { devisId: dv!.id, numero, version: 1 });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.cree', objetType: 'devis', objetId: dv!.id, apres: { numero, version: 1, totalTtc: t.totalTtc, tauxAcompte: t.tauxAcompte }, details: { dossierId } }, tx);
    return { devisId: dv!.id, numero };
  });
  return r;
}

// ─── Modification d'un brouillon (RG-06) ─────────────────────

export const schemaModification = z.object({
  /** Nombre de personnes par ligne, dans l'ordre des lignes du devis (écart pour un avenant). */
  nombres: z.array(z.number().int('Nombre entier').min(-100).max(100)).max(20),
  tauxAcompte: z.number().int('Le taux d’acompte doit être un pourcentage entier.').min(0).max(100).optional(),
  justificationTaux: z.string().trim().max(500).optional().nullable(),
  delaiRechercheJours: z.number().int('Nombre de jours entier').min(1, 'Délai de recherche : au moins 1 jour').max(365).optional(),
  /** Avenant : prolongation du délai de recherche. */
  prolongationJours: z.number().int('Nombre de jours entier').min(0).max(365).optional().nullable(),
  conditionsParticulieres: z.string().trim().max(2000, 'Conditions particulières : 2 000 caractères maximum').optional().nullable(),
});
export type Modification = z.input<typeof schemaModification>;

/** Contrats d'un avenant : nombres consolidés du devis initial et des avenants acceptés. */
async function contratActuel(tx: Pick<Tx, 'select'>, devisInitial: Devis, saufId?: number): Promise<LigneFacturable[]> {
  const avenants = await tx
    .select({ id: schema.devis.id, lignes: schema.devis.lignes })
    .from(schema.devis)
    .where(and(eq(schema.devis.devisInitialId, devisInitial.id), eq(schema.devis.type, 'avenant'), eq(schema.devis.statut, 'accepte')))
    .orderBy(asc(schema.devis.accepteLe), asc(schema.devis.id));
  return consoliderLignes([devisInitial.lignes, ...avenants.filter((x) => x.id !== saufId).map((x) => x.lignes)]);
}

/** Avenant : aucune ligne de poste ne descend sous zéro personne. */
function verifierEcarts(contrat: readonly LigneFacturable[], lignes: readonly LigneDevis[]) {
  for (const l of lignes) {
    const actuel = contrat.find((c) => c.lignePosteId === l.lignePosteId)?.nombre ?? 0;
    if (actuel + l.nombre < 0) throw new ErreurMetier(`« ${l.intitule} » : l’avenant ne peut pas retirer plus de ${actuel} personne(s).`);
  }
}

export async function modifierDevis(devisId: number, entree: Modification, a: ActeurDevis): Promise<void> {
  const m = schemaModification.parse(entree);
  const g = await grilleActuelle();
  await getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (!estModifiable(dv.statut)) throw new ErreurMetier(`${libelleDevis(dv)} est « ${STATUTS_DEVIS[dv.statut]} » : il n’est plus modifiable. Créez une nouvelle version.`);
    if (m.nombres.length !== dv.lignes.length) throw new ErreurMetier('Lignes du devis modifiées entre-temps : rechargez la page.');
    const lignes: LigneDevis[] = dv.lignes.map((l, i) => ({ ...l, nombre: m.nombres[i]!, montantHt: l.commission * m.nombres[i]! }));
    const maj: Partial<typeof schema.devis.$inferInsert> = { majLe: new Date() };

    if (dv.type === 'devis') {
      if (lignes.some((l) => l.nombre < 0)) throw new ErreurMetier('Le nombre de personnes ne peut pas être négatif.');
      if (!lignes.some((l) => l.nombre > 0)) throw new ErreurMetier('Au moins un poste doit compter une personne.');
      const taux = m.tauxAcompte ?? dv.tauxAcompte;
      const justification = m.justificationTaux === undefined ? dv.justificationTaux : m.justificationTaux || null;
      const v = verifierTauxAcompte(taux, g.tauxAcompteDefaut, g.bornes, justification);
      if (!v.ok) throw new ErreurMetier(v.erreur);
      Object.assign(maj, totauxFiges(lignes, dv.tauxTva, taux), { justificationTaux: taux === g.tauxAcompteDefaut ? null : justification });
      if (m.delaiRechercheJours !== undefined) maj.delaiRechercheJours = m.delaiRechercheJours;
    } else {
      const [initial] = await tx.select().from(schema.devis).where(eq(schema.devis.id, dv.devisInitialId!));
      verifierEcarts(await contratActuel(tx, initial!), lignes);
      const prolongation = m.prolongationJours === undefined ? dv.prolongationJours : m.prolongationJours || null;
      if (!lignes.some((l) => l.nombre !== 0) && !prolongation) throw new ErreurMetier('L’avenant doit modifier un nombre de personnes ou prolonger le délai de recherche.');
      Object.assign(maj, totauxFiges(lignes, dv.tauxTva, 0), { prolongationJours: prolongation });
    }
    maj.lignes = lignes;
    if (m.conditionsParticulieres !== undefined) maj.conditionsParticulieres = m.conditionsParticulieres || null;
    // Un devis « en attente de validation direction » modifié repasse en brouillon (à revalider).
    if (dv.statut === 'attente_direction') maj.statut = 'brouillon';
    await tx.update(schema.devis).set(maj).where(eq(schema.devis.id, devisId));
    const avant = { lignes: dv.lignes.map((l) => l.nombre), tauxAcompte: dv.tauxAcompte, delaiRechercheJours: dv.delaiRechercheJours, prolongationJours: dv.prolongationJours, totalTtc: dv.totalTtc };
    const apres = { lignes: lignes.map((l) => l.nombre), tauxAcompte: maj.tauxAcompte ?? dv.tauxAcompte, delaiRechercheJours: maj.delaiRechercheJours ?? dv.delaiRechercheJours, prolongationJours: maj.prolongationJours ?? dv.prolongationJours, totalTtc: maj.totalTtc };
    await evenementDossier(tx, dos.id, `${libelleDevis(dv)} modifié : ${formaterMontant(maj.totalTtc ?? dv.totalTtc)}`, auteurDe(a), 'modification', { devisId, ...apres });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.modifie', objetType: 'devis', objetId: devisId, avant, apres, details: maj.justificationTaux ? { justificationTaux: maj.justificationTaux } : undefined }, tx);
  });
}

/**
 * Brouillon d'un devis : reprend les postes actuels du Dossier (poste ajouté ou retiré après la
 * création). Commission figée conservée pour les postes déjà au devis, grille en vigueur pour les nouveaux.
 */
export async function reprendrePostes(devisId: number, a: ActeurDevis): Promise<void> {
  const g = await grilleActuelle();
  await getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (dv.type !== 'devis' || !estModifiable(dv.statut)) throw new ErreurMetier('Seul un devis en brouillon peut reprendre les postes du dossier.');
    const { lignes: postes, manques } = await donneesDossier(tx, dos);
    if (manques.length) throw new ErreurDonneesManquantes(manques);
    const lignes: LigneDevis[] = postes
      .filter((p) => p.nombre > 0)
      .map((p) => {
        const commission = dv.lignes.find((l) => l.lignePosteId === p.id)?.commission ?? commissionPour(p.intitule, g);
        return { lignePosteId: p.id, intitule: p.intitule, nombre: p.nombre, commission, montantHt: commission * p.nombre };
      });
    const t = totauxFiges(lignes, dv.tauxTva, dv.tauxAcompte);
    await tx.update(schema.devis).set({ lignes, ...t, statut: 'brouillon', majLe: new Date() }).where(eq(schema.devis.id, devisId));
    await evenementDossier(tx, dos.id, `${libelleDevis(dv)} : postes du dossier repris (${formaterMontant(t.totalTtc)})`, auteurDe(a), 'modification', { devisId, lignes: lignes.map((l) => ({ lignePosteId: l.lignePosteId, nombre: l.nombre })) });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.modifie', objetType: 'devis', objetId: devisId, avant: { totalTtc: dv.totalTtc }, apres: { totalTtc: t.totalTtc }, details: { postesRepris: true } }, tx);
  });
}

// ─── Validation (RG-06, RG-07, RG-08) ────────────────────────

async function marquerValide(tx: Tx, dos: Dossier, dv: Devis, a: ActeurDevis, direction: boolean): Promise<void> {
  const maintenant = new Date();
  await tx
    .update(schema.devis)
    .set({ statut: 'valide', valideParId: a.id, valideLe: maintenant, majLe: maintenant, ...(direction ? { valideDirectionParId: a.id, valideDirectionLe: maintenant } : {}) })
    .where(eq(schema.devis.id, dv.id));
  await evenementDossier(tx, dos.id, `${libelleDevis(dv)} validé${direction ? ' par la Direction' : ''} : ${formaterMontant(dv.totalTtc)}`, auteurDe(a), 'document', { devisId: dv.id, statut: 'valide' });
  await journaliser({ ...auditDe(auteurDe(a)), action: direction ? 'devis.valide_direction' : 'devis.valide', objetType: 'devis', objetId: dv.id, avant: dv.statut, apres: 'valide', details: { tauxAcompte: dv.tauxAcompte } }, tx);
  // RG-08 : devis validé → Dossier « Devis prêt » (les avenants ne changent pas le statut du Dossier).
  if (dv.type === 'devis') await transitionAutomatique(tx, dos.id, ['en_qualification'], 'devis_pret', `${libelleDevis(dv)} validé`);
}

/**
 * Valide un brouillon. Taux d'acompte hors bornes → « en attente de validation direction » et
 * Direction notifiée (RG-06) ; sinon `valide` et Dossier « Devis prêt ». Une personne ayant le rôle
 * Direction valide directement, même hors bornes.
 */
export async function validerDevis(devisId: number, a: ActeurDevis): Promise<{ statut: StatutDevis }> {
  const g = await grilleActuelle();
  const statut = await getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (dv.statut === 'attente_direction') throw new ErreurMetier('Ce devis attend la validation de la Direction (taux d’acompte hors bornes).');
    if (dv.statut !== 'brouillon') throw new ErreurMetier(`${libelleDevis(dv)} est « ${STATUTS_DEVIS[dv.statut]} » : il ne peut pas être validé.`);
    if (dv.type === 'devis' && dos.statut !== 'en_qualification') throw new ErreurMetier(`Le dossier doit être « En qualification » pour valider le devis (statut actuel : ${STATUTS[dos.statut]}).`);
    if (dv.type === 'avenant' && estFinal(dos.statut)) throw new ErreurMetier('Le dossier est fermé.');
    if (dv.totalTtc <= 0 && dv.type === 'devis') throw new ErreurMetier('Montant du devis nul.');
    let horsBornes = false;
    if (dv.type === 'devis') {
      const v = verifierTauxAcompte(dv.tauxAcompte, g.tauxAcompteDefaut, g.bornes, dv.justificationTaux);
      if (!v.ok) throw new ErreurMetier(v.erreur);
      horsBornes = v.validationDirection;
    }
    if (horsBornes && !estDirection(a)) {
      await tx.update(schema.devis).set({ statut: 'attente_direction', majLe: new Date() }).where(eq(schema.devis.id, devisId));
      await evenementDossier(tx, dos.id, `${libelleDevis(dv)} en attente de validation direction : acompte de ${dv.tauxAcompte} % hors bornes (${g.bornes.min} %–${g.bornes.max} %)${dv.justificationTaux ? ` — ${dv.justificationTaux}` : ''}`, auteurDe(a), 'document', { devisId, statut: 'attente_direction' });
      await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.attente_direction', objetType: 'devis', objetId: devisId, avant: dv.statut, apres: 'attente_direction', details: { tauxAcompte: dv.tauxAcompte, bornes: g.bornes, justification: dv.justificationTaux } }, tx);
      await notifier(
        {
          destinataires: (await idsDirection(tx)).filter((id) => id !== a.id),
          type: 'devis_attente_direction',
          dossierId: dos.id,
          titre: `Devis à valider : ${dos.numero}`,
          texte: `${libelleDevis(dv)} (${formaterMontant(dv.totalTtc)}) : acompte de ${dv.tauxAcompte} % hors bornes (${g.bornes.min} %–${g.bornes.max} %). Justification : ${dv.justificationTaux ?? '—'}.`,
          lien: lienDevisDossier(dos.id),
          cle: `devis_attente_direction:${devisId}:${Date.now()}`,
          email: true,
        },
        tx,
      );
      return 'attente_direction' as const;
    }
    await marquerValide(tx, dos, dv, a, horsBornes);
    return 'valide' as const;
  });
  declencherEnvoi();
  return { statut };
}

/** RG-06 : validation par la Direction d'un devis au taux d'acompte hors bornes. */
export async function validerParDirection(devisId: number, a: ActeurDevis): Promise<void> {
  if (!estDirection(a)) throw new ErreurMetier('Seule la Direction peut valider un taux d’acompte hors bornes.');
  await getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (dv.statut !== 'attente_direction') throw new ErreurMetier('Ce devis n’attend pas de validation de la Direction.');
    if (dv.type === 'devis' && dos.statut !== 'en_qualification') throw new ErreurMetier(`Le dossier doit être « En qualification » pour valider le devis (statut actuel : ${STATUTS[dos.statut]}).`);
    await marquerValide(tx, dos, dv, a, true);
    if (dos.referentId && dos.referentId !== a.id) {
      await notifier({ destinataires: [dos.referentId], type: 'devis_valide_direction', dossierId: dos.id, titre: `Devis validé par la Direction : ${dos.numero}`, texte: `${libelleDevis(dv)} est validé : vous pouvez l’envoyer au client (« Valider et envoyer »).`, lien: lienDevisDossier(dos.id), cle: `devis_valide_direction:${devisId}` }, tx);
    }
  });
}

// ─── Nouvelle version (RG-07) ────────────────────────────────

const STATUTS_NOUVELLE_VERSION: StatutDevis[] = ['valide', 'envoye', 'refuse', 'expire'];

export async function nouvelleVersion(devisId: number, a: ActeurDevis): Promise<{ devisId: number; version: number }> {
  const g = await grilleActuelle();
  return getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (!STATUTS_NOUVELLE_VERSION.includes(dv.statut)) {
      throw new ErreurMetier(estModifiable(dv.statut) ? 'Ce devis est encore modifiable : modifiez-le directement.' : `${libelleDevis(dv)} est « ${STATUTS_DEVIS[dv.statut]} » : pas de nouvelle version possible.`);
    }
    if (!(await estDerniereVersion(tx, dv))) throw new ErreurMetier('Une version plus récente de ce devis existe déjà.');
    if (estFinal(dos.statut) && !(dv.type === 'devis' && dos.statut === 'refuse')) throw new ErreurMetier('Le dossier est fermé.');

    let lignes: LigneDevis[];
    let tauxTva: number;
    if (dv.type === 'devis') {
      if (dos.statut === 'refuse') throw new ErreurMetier('Le dossier est « Refusé » : rouvrez-le d’abord en « En qualification » (onglet Résumé).');
      if (!['en_qualification', 'devis_pret', 'devis_envoye'].includes(dos.statut)) throw new ErreurMetier(`Nouvelle version impossible au statut « ${STATUTS[dos.statut]} ».`);
      const autres = await tx.select({ id: schema.devis.id, statut: schema.devis.statut }).from(schema.devis).where(and(eq(schema.devis.dossierId, dos.id), eq(schema.devis.type, 'devis'), ne(schema.devis.id, dv.id)));
      if (autres.some((x) => x.statut === 'accepte')) throw new ErreurMetier('Un devis est déjà accepté sur ce dossier : créez un avenant.');
      if (autres.some((x) => !estTermine(x.statut))) throw new ErreurMetier('Un autre devis est en cours sur ce dossier.');
      // RG-02 : nouvelles valeurs de la grille (commissions, TVA) ; quantités reprises.
      lignes = calculerDevis(dv.lignes, g, dv.tauxAcompte).lignes;
      tauxTva = g.tauxTva;
    } else {
      const [initial] = await tx.select().from(schema.devis).where(eq(schema.devis.id, dv.devisInitialId!));
      if (initial?.statut !== 'accepte') throw new ErreurMetier('Le devis initial n’est plus accepté.');
      const enCours = await tx.select({ id: schema.devis.id, statut: schema.devis.statut }).from(schema.devis).where(and(eq(schema.devis.devisInitialId, initial.id), eq(schema.devis.type, 'avenant'), ne(schema.devis.id, dv.id)));
      if (enCours.some((x) => !estTermine(x.statut))) throw new ErreurMetier('Un autre avenant est en cours.');
      // Lignes déjà au contrat : commission figée du contrat ; nouvelles lignes : commission actuelle.
      const contrat = await contratActuel(tx, initial);
      lignes = dv.lignes.map((l) => {
        const commission = contrat.find((c) => c.lignePosteId === l.lignePosteId)?.commission ?? commissionPour(l.intitule, g);
        return { ...l, commission, montantHt: commission * l.nombre };
      });
      tauxTva = initial.tauxTva;
    }
    const t = totauxFiges(lignes, tauxTva, dv.type === 'devis' ? dv.tauxAcompte : 0);
    const version = dv.version + 1;
    const [nv] = await tx
      .insert(schema.devis)
      .values({
        dossierId: dos.id,
        clientId: dos.clientId,
        type: dv.type,
        numero: dv.numero,
        version,
        devisInitialId: dv.devisInitialId,
        statut: 'brouillon',
        lignes,
        tauxTva,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: t.tauxAcompte,
        justificationTaux: dv.justificationTaux,
        acompte: t.acompte,
        delaiRechercheJours: dv.delaiRechercheJours,
        garantieJours: dv.type === 'devis' ? g.garantieJours : dv.garantieJours,
        validiteJours: g.validiteJours,
        conditions: dv.type === 'devis' ? g.conditions : dv.conditions,
        conditionsParticulieres: dv.conditionsParticulieres,
        mentionsLegales: g.mentionsLegales,
        prolongationJours: dv.prolongationJours,
        auteurId: a.id,
      })
      .returning({ id: schema.devis.id });
    // RG-07 : l'ancienne version validée ou envoyée est remplacée ; refusée ou expirée, elle le reste.
    if (dv.statut === 'valide' || dv.statut === 'envoye') await tx.update(schema.devis).set({ statut: 'remplace', majLe: new Date() }).where(eq(schema.devis.id, dv.id));
    await evenementDossier(tx, dos.id, `${libelleDevis({ ...dv, version })} créé (nouvelle version${dv.statut === 'valide' || dv.statut === 'envoye' ? `, la v${dv.version} est remplacée` : ''})`, auteurDe(a), 'document', { devisId: nv!.id, numero: dv.numero, version, remplace: dv.id });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.nouvelle_version', objetType: 'devis', objetId: nv!.id, avant: { devisId: dv.id, version: dv.version, statut: dv.statut }, apres: { version, totalTtc: t.totalTtc } }, tx);
    if (dv.type === 'devis') await retourEnQualification(tx, dos, `nouvelle version du devis ${dv.numero} (v${version})`, a);
    return { devisId: nv!.id, version };
  });
}

// ─── « Valider et envoyer » (RG-10, RG-11) ───────────────────

/** Valeurs des variables `devis.*` (et du Dossier) pour le modèle « Envoi du devis ». */
async function contexteEnvoi(dv: Devis, a: ActeurDevis): Promise<ContexteMessage> {
  const ctx = await contexteDossier(dv.dossierId, { id: a.id, nom: a.nom ?? '' });
  const expire = dv.expireLe ?? dateExpiration(new Date(), dv.validiteJours);
  return {
    ...ctx,
    'devis.numero': `${dv.type === 'avenant' ? 'avenant ' : ''}${dv.numero} (version ${dv.version})`,
    'devis.montant': formaterMontant(dv.totalTtc),
    'devis.acompte': formaterMontant(dv.acompte),
    'devis.validite': formaterDate(expire),
  };
}

/** Texte du modèle « Envoi du devis » (en base s'il existe et est actif, sinon texte par défaut). */
async function texteModeleEnvoi(): Promise<string> {
  const [m] = await getDb().select({ texte: schema.modeleMessage.texte, actif: schema.modeleMessage.actif }).from(schema.modeleMessage).where(eq(schema.modeleMessage.nom, NOM_MODELE_ENVOI_DEVIS));
  return m?.actif ? m.texte : MODELE_ENVOI_DEVIS;
}

export interface MessageEnvoi {
  modele: string;
  texte: string;
  /** Numéro WhatsApp du client (E.164). */
  numero: string;
}

/** Message WhatsApp « Envoi du devis » d'un devis envoyé (bouton « Ouvrir WhatsApp »). */
export async function messageEnvoiDevis(devisId: number, a: ActeurDevis): Promise<MessageEnvoi> {
  const { dv } = await verifierDroits(devisId, a);
  const [c] = await getDb().select({ whatsapp: schema.client.whatsapp }).from(schema.client).where(eq(schema.client.id, dv.clientId));
  return { modele: NOM_MODELE_ENVOI_DEVIS, texte: rendreMessage(await texteModeleEnvoi(), await contexteEnvoi(dv, a)), numero: c!.whatsapp };
}

function emailDevis(p: { contact: string; libelle: string; montant: string; acompte: string; validite: string; lienSuivi: string; referent: string }) {
  const lignes = [
    `Bonjour ${p.contact},`,
    '',
    `Veuillez trouver ci-joint notre ${p.libelle}.`,
    `Montant : ${p.montant} — acompte à l’acceptation : ${p.acompte}.`,
    `Ce devis est valable jusqu’au ${p.validite}.`,
    '',
    `Vous pouvez le consulter et l’accepter en ligne : ${p.lienSuivi}`,
    '',
    `${p.referent}, NEXCLEAN`,
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:560px">
<p>Bonjour ${echapperHtml(p.contact)},</p>
<p>Veuillez trouver ci-joint notre ${echapperHtml(p.libelle)}.<br>Montant : <strong>${echapperHtml(p.montant)}</strong> — acompte à l’acceptation : <strong>${echapperHtml(p.acompte)}</strong>.<br>Ce devis est valable jusqu’au ${echapperHtml(p.validite)}.</p>
<p><a href="${echapperHtml(p.lienSuivi)}" style="display:inline-block;background:#3d7a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Consulter et accepter le devis</a></p>
<p style="color:#6b7280">${echapperHtml(p.referent)}, NEXCLEAN</p></div>`;
  return { text: lignes.join('\n'), html };
}

export interface ResultatEnvoi extends MessageEnvoi {
  documentId: number;
  empreinte: string;
  /** E-mail avec le PDF : envoyé, en échec (l'envoi du devis reste valable) ou client sans e-mail. */
  email: 'envoye' | 'echec' | 'absent';
}

/**
 * RG-10 : génère le PDF définitif, l'archive (catégorie « devis », empreinte SHA-256), passe le
 * devis à `envoyé` (date d'expiration = envoi + validité figée) et le Dossier à « Devis envoyé » ;
 * e-mail avec le PDF si le client a une adresse. Renvoie le message WhatsApp « Envoi du devis ».
 */
export async function validerEtEnvoyer(devisId: number, a: ActeurDevis, maintenant = new Date()): Promise<ResultatEnvoi> {
  const { dv: avant } = await verifierDroits(devisId, a);
  if (avant.statut !== 'valide') throw new ErreurMetier(avant.statut === 'envoye' ? 'Ce devis a déjà été envoyé.' : `${libelleDevis(avant)} doit être validé avant l’envoi (statut : ${STATUTS_DEVIS[avant.statut]}).`);
  // PDF généré hors transaction (lecture des valeurs figées du devis validé).
  const octets = await genererPdfDevis(devisId);
  const { dv, documentId, empreinte, client, dossier } = await getDb().transaction(async (tx) => {
    const { dos, dv } = await devisPourEcriture(tx, devisId, a);
    if (dv.statut !== 'valide') throw new ErreurMetier('Ce devis a changé entre-temps : rechargez la page.');
    if (estFinal(dos.statut)) throw new ErreurMetier('Le dossier est fermé.');
    const archive = await archiverPdf(dos.id, nomPdfDevis(dv), octets, 'devis', auteurDe(a), tx);
    const expireLe = dateExpiration(maintenant, dv.validiteJours);
    await tx.update(schema.devis).set({ statut: 'envoye', envoyeLe: maintenant, expireLe, documentId: archive.documentId, pdfEmpreinte: archive.empreinte, majLe: maintenant }).where(eq(schema.devis.id, devisId));
    await evenementDossier(tx, dos.id, `${libelleDevis(dv)} envoyé au client (PDF archivé, valable jusqu’au ${formaterDate(expireLe)})`, auteurDe(a), 'document', { devisId, documentId: archive.documentId, empreinte: archive.empreinte, expireLe });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.envoye', objetType: 'devis', objetId: devisId, avant: 'valide', apres: 'envoye', details: { documentId: archive.documentId, empreinte: archive.empreinte } }, tx);
    if (dv.type === 'devis') await transitionAutomatique(tx, dos.id, ['devis_pret', 'en_qualification'], 'devis_envoye', `${libelleDevis(dv)} envoyé`);
    const [client] = await tx.select({ nom: schema.client.nom, contact: schema.client.contact, email: schema.client.email, whatsapp: schema.client.whatsapp }).from(schema.client).where(eq(schema.client.id, dos.clientId));
    return { dv: { ...dv, statut: 'envoye' as const, envoyeLe: maintenant, expireLe }, ...archive, client: client!, dossier: dos };
  });

  const ctx = await contexteEnvoi(dv, a);
  let email: ResultatEnvoi['email'] = 'absent';
  if (client.email) {
    try {
      const contenu = emailDevis({
        contact: client.contact ?? client.nom,
        libelle: `${dv.type === 'avenant' ? 'avenant' : 'devis'} ${dv.numero} (version ${dv.version})`,
        montant: ctx['devis.montant']!,
        acompte: ctx['devis.acompte']!,
        validite: ctx['devis.validite']!,
        lienSuivi: `${env().BETTER_AUTH_URL}/suivi/${dossier.jetonSuivi}`,
        referent: ctx['referent.prenom'] ?? 'Votre conseiller',
      });
      await envoyerEmail({ to: client.email, subject: `Votre ${dv.type === 'avenant' ? 'avenant' : 'devis'} ${dv.numero} — NEXCLEAN`, ...contenu, pieces: [{ nom: nomPdfDevis(dv), contenu: octets }] });
      email = 'envoye';
      await getDb().transaction((tx) => evenementDossier(tx, dossier.id, `E-mail envoyé à ${client.email} avec le PDF (${libelleDevis(dv)})`, auteurDe(a), 'document', { devisId }));
    } catch (e) {
      // L'envoi du devis reste acquis : le référent est averti et peut l'envoyer par WhatsApp.
      console.error('Devis : e-mail non envoyé', devisId, e);
      email = 'echec';
      await journaliser({ ...auditDe(auteurDe(a)), action: 'email.echec', objetType: 'devis', objetId: devisId, details: { destinataire: client.email } });
    }
  }
  const texte = rendreMessage(await texteModeleEnvoi(), ctx);
  return { modele: NOM_MODELE_ENVOI_DEVIS, texte, numero: client.whatsapp, documentId, empreinte, email };
}

/** Trace du message WhatsApp « Envoi du devis » (MVP1-05 RG-17). */
export async function noterEnvoiWhatsApp(devisId: number, texte: string, a: ActeurDevis): Promise<void> {
  const { dv } = await verifierDroits(devisId, a);
  await noterMessageWhatsApp(dv.dossierId, `${NOM_MODELE_ENVOI_DEVIS} (${libelleDevis(dv)})`, texte, a);
}

// ─── Acceptation WhatsApp (RG-15) et refus (RG-14) ───────────

export interface AcceptationWhatsApp {
  /** Capture de l'accord du client (image ou PDF), obligatoire. */
  fichier: Fichier | null;
  signataireNom: string;
  signataireFonction: string;
}

function validerCapture(f: Fichier | null) {
  const MANQUE = 'Joignez la capture de l’acceptation WhatsApp (image ou PDF).';
  if (!f || f.octets.byteLength === 0) throw new ErreurMetier(MANQUE);
  const v = validerFichier(f.nom, f.octets);
  if (!v.ok) throw new ErreurMetier(v.erreur);
  if (v.type === 'docx') throw new ErreurMetier('La capture doit être une image (capture d’écran, photo) ou un PDF.');
  return { extension: v.type === 'jpeg' ? 'jpg' : v.type, mime: v.mime };
}

export async function enregistrerAcceptationWhatsApp(devisId: number, e: AcceptationWhatsApp, a: ActeurDevis, maintenant = new Date()): Promise<{ facture: { id: number; numero: string } | null }> {
  if (!e.signataireNom?.trim() || !e.signataireFonction?.trim()) throw new ErreurMetier('Indiquez le nom et la fonction du signataire.');
  const v = validerCapture(e.fichier);
  await verifierDroits(devisId, a);
  const cle = nouvelleCle('devis', v.extension);
  await getStockage().deposer(cle, e.fichier!.octets);
  let r: { facture: { id: number; numero: string } | null };
  try {
    r = await getDb().transaction(async (tx) => {
      await devisPourEcriture(tx, devisId, a);
      return accepterDevis(
        tx,
        devisId,
        { mode: 'whatsapp', signataireNom: e.signataireNom.slice(0, 120), signataireFonction: e.signataireFonction.slice(0, 120), preuveCle: cle, preuveMime: v.mime, acceptationParId: a.id, ip: a.ip ?? null, maintenant },
        auteurDe(a),
      );
    });
  } catch (err) {
    await getStockage().supprimer(cle);
    throw err;
  }
  // Après la transaction : PDF de la facture d'acompte. Un échec n'annule pas l'acceptation (facture émise).
  if (r.facture) {
    try {
      await archiverPdfFacture(r.facture.id);
    } catch (err) {
      console.error('Facture : PDF non archivé', r.facture.id, err);
      await journaliser({ acteurType: 'systeme', action: 'facture.pdf_echec', objetType: 'facture', objetId: r.facture.id, details: { devisId, erreur: err instanceof Error ? err.message : String(err) } });
    }
  }
  declencherEnvoi();
  return r;
}

/** Refus communiqué par le client hors page de suivi (téléphone, WhatsApp), enregistré par le référent. */
export async function enregistrerRefus(devisId: number, motif: string | null, a: ActeurDevis): Promise<void> {
  await getDb().transaction(async (tx) => {
    await devisPourEcriture(tx, devisId, a);
    await refuserDevis(tx, devisId, motif, auteurDe(a));
  });
}

// ─── Avenants (RG-09) ────────────────────────────────────────

/** Statuts du Dossier où un avenant est possible : devis accepté, recherche non clôturée. */
const STATUTS_AVENANT: Statut[] = ['accepte', 'acompte_recu', 'recherche_en_cours', 'candidats_proposes'];

export const schemaAvenant = z.object({
  /** Nouveau nombre total de personnes par ligne de poste du Dossier. */
  lignes: z.array(z.object({ lignePosteId: z.number().int().positive(), nombre: z.number().int('Nombre entier').min(0).max(100) })).max(20),
  prolongationJours: z.number().int('Nombre de jours entier').min(0).max(365).optional().nullable(),
  conditionsParticulieres: z.string().trim().max(2000).optional().nullable(),
});
export type EntreeAvenant = z.input<typeof schemaAvenant>;

/**
 * RG-09 : avenant sur un devis accepté (nombre de personnes, prolongation du délai de recherche).
 * Les nouvelles lignes de poste s'ajoutent d'abord dans l'onglet Postes ; l'avenant porte l'écart
 * avec le contrat (devis + avenants acceptés). Nouveau numéro DEV, même circuit valider → envoyer → accepter.
 */
export async function creerAvenant(devisAccepteId: number, entree: EntreeAvenant, a: ActeurDevis): Promise<{ devisId: number; numero: string }> {
  const e = schemaAvenant.parse(entree);
  const g = await grilleActuelle();
  return getDb().transaction(async (tx) => {
    const { dos, dv: initial } = await devisPourEcriture(tx, devisAccepteId, a);
    if (initial.type !== 'devis' || initial.statut !== 'accepte') throw new ErreurMetier('Un avenant porte sur un devis accepté.');
    if (!STATUTS_AVENANT.includes(dos.statut)) throw new ErreurMetier(`Avenant impossible au statut « ${STATUTS[dos.statut]} » (recherche clôturée ou dossier fermé).`);
    const enCours = await tx.select({ id: schema.devis.id, statut: schema.devis.statut, numero: schema.devis.numero }).from(schema.devis).where(and(eq(schema.devis.devisInitialId, initial.id), eq(schema.devis.type, 'avenant')));
    const ouvert = enCours.find((x) => !estTermine(x.statut));
    if (ouvert) throw new ErreurMetier(`L’avenant ${ouvert.numero} est en cours : terminez-le avant d’en créer un autre.`);
    const postes = await tx.select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dos.id)).orderBy(asc(schema.lignePoste.ordre));
    const contrat = await contratActuel(tx, initial);
    const lignes: LigneDevis[] = [];
    for (const l of e.lignes) {
      const poste = postes.find((p) => p.id === l.lignePosteId);
      if (!poste) throw new ErreurMetier('Poste introuvable dans ce dossier.');
      const actuel = contrat.find((c) => c.lignePosteId === l.lignePosteId);
      const ecart = l.nombre - (actuel?.nombre ?? 0);
      if (ecart === 0) continue;
      const commission = actuel?.commission ?? commissionPour(poste.intitule, g);
      lignes.push({ lignePosteId: poste.id, intitule: actuel?.intitule ?? poste.intitule, nombre: ecart, commission, montantHt: commission * ecart });
    }
    const prolongation = e.prolongationJours || null;
    if (!lignes.length && !prolongation) throw new ErreurMetier('L’avenant doit modifier un nombre de personnes ou prolonger le délai de recherche.');
    const t = totauxFiges(lignes, initial.tauxTva, 0);
    const numero = await prochainNumero(tx, 'devis');
    const [av] = await tx
      .insert(schema.devis)
      .values({
        dossierId: dos.id,
        clientId: dos.clientId,
        type: 'avenant',
        numero,
        version: 1,
        devisInitialId: initial.id,
        statut: 'brouillon',
        lignes,
        tauxTva: initial.tauxTva,
        totalHt: t.totalHt,
        montantTva: t.montantTva,
        totalTtc: t.totalTtc,
        tauxAcompte: 0,
        acompte: 0,
        delaiRechercheJours: initial.delaiRechercheJours,
        garantieJours: initial.garantieJours,
        validiteJours: g.validiteJours,
        conditions: initial.conditions,
        conditionsParticulieres: e.conditionsParticulieres || null,
        mentionsLegales: g.mentionsLegales,
        prolongationJours: prolongation,
        auteurId: a.id,
      })
      .returning({ id: schema.devis.id });
    const resume = [...lignes.map((l) => `${l.nombre > 0 ? '+' : ''}${l.nombre} ${l.intitule}`), prolongation ? `+${prolongation} jours de recherche` : null].filter(Boolean).join(', ');
    await evenementDossier(tx, dos.id, `Avenant ${numero} v1 créé (brouillon) sur le devis ${initial.numero} : ${resume}`, auteurDe(a), 'document', { devisId: av!.id, numero, devisInitialId: initial.id });
    await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.avenant_cree', objetType: 'devis', objetId: av!.id, apres: { numero, lignes: lignes.map((l) => ({ lignePosteId: l.lignePosteId, ecart: l.nombre })), prolongationJours: prolongation, totalTtc: t.totalTtc }, details: { devisInitialId: initial.id } }, tx);
    return { devisId: av!.id, numero };
  });
}

// ─── Expiration (RG-14, tâche planifiée) ─────────────────────

/** RG-14 : devis envoyés dont la date de validité est passée → `expiré`, référent notifié (une fois). */
export async function expirerDevis(maintenant = new Date()): Promise<number> {
  const dus = await getDb()
    .select({ id: schema.devis.id })
    .from(schema.devis)
    .where(and(eq(schema.devis.statut, 'envoye'), lt(schema.devis.expireLe, maintenant)));
  let n = 0;
  for (const { id } of dus) {
    const fait = await getDb().transaction(async (tx) => {
      const [dv] = await tx.select().from(schema.devis).where(eq(schema.devis.id, id)).for('update');
      if (!dv || dv.statut !== 'envoye' || !dv.expireLe || dv.expireLe >= maintenant) return false;
      await tx.update(schema.devis).set({ statut: 'expire', majLe: maintenant }).where(eq(schema.devis.id, id));
      await evenementDossier(tx, dv.dossierId, `${libelleDevis(dv)} expiré (non accepté au ${formaterDate(dv.expireLe)})`, { type: 'systeme' }, 'document', { devisId: id, statut: 'expire' });
      await journaliser({ acteurType: 'systeme', action: 'devis.expire', objetType: 'devis', objetId: id, avant: 'envoye', apres: 'expire' }, tx);
      const [dos] = await tx.select({ referentId: schema.dossier.referentId, numero: schema.dossier.numero }).from(schema.dossier).where(eq(schema.dossier.id, dv.dossierId));
      await notifier(
        {
          destinataires: [dos?.referentId],
          type: 'devis_expire',
          dossierId: dv.dossierId,
          titre: `Devis expiré : ${dos?.numero ?? ''}`,
          texte: `${libelleDevis(dv)} n’a pas été accepté avant le ${formaterDate(dv.expireLe)}. Relancez le client avec une nouvelle version, ou classez le dossier.`,
          lien: lienDevisDossier(dv.dossierId),
          cle: `devis_expire:${id}`,
          email: true,
        },
        tx,
      );
      return true;
    });
    if (fait) n++;
  }
  return n;
}

// ─── Lecture (onglet Devis) ──────────────────────────────────

export interface VueDevisDossier {
  /** Toutes les versions (devis et avenants), plus récentes d'abord. */
  devis: Devis[];
  /** Devis courant : dernière version de la dernière chaîne `devis`. */
  courant: Devis | null;
  /** Devis accepté (base des avenants) et avenants, plus récents d'abord. */
  accepte: Devis | null;
  avenants: Devis[];
  /** Contrat (devis + avenants acceptés) consolidé par ligne de poste. */
  contrat: LigneFacturable[];
  /** Lignes de poste du Dossier (formulaire d'avenant). */
  postes: { id: number; intitule: string; nombre: number }[];
  /** RG-05 : données manquantes pour créer le devis. */
  manques: string[];
  peutCreer: boolean;
  /** Avenant possible (devis accepté, statut du Dossier compatible, aucun avenant en cours). */
  peutCreerAvenant: boolean;
  /** Paramètres en vigueur (aide du formulaire). */
  tauxAcompteDefaut: number;
  bornes: BornesAcompte;
  /** Message WhatsApp de chaque devis envoyé (bouton « Ouvrir WhatsApp »). */
  messages: Record<number, MessageEnvoi>;
}

/** Données de l'onglet Devis ; null si le Dossier n'est pas REC ; lecture : `peutVoir`. */
export async function lireDevisDossier(dossierId: number, a: ActeurDevis): Promise<VueDevisDossier | null> {
  const db = getDb();
  const [dos] = await db.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!dos || dos.type !== 'REC') return null;
  if (!peutVoir(a, dos.referentId)) throw new ErreurAccesDossier();
  const [tous, g, donnees] = await Promise.all([
    db.select().from(schema.devis).where(eq(schema.devis.dossierId, dossierId)).orderBy(desc(schema.devis.creeLe), desc(schema.devis.id)),
    grilleActuelle(),
    donneesDossier(db, dos),
  ]);
  const chaine = tous.filter((d) => d.type === 'devis');
  const courant = chaine[0] ?? null;
  const accepte = (await devisAccepte(dossierId, db)) ?? null;
  const avenants = accepte ? tous.filter((d) => d.type === 'avenant' && d.devisInitialId === accepte.id) : [];
  const contrat = accepte ? await contratActuel(db, accepte) : [];
  const traiter = peutTraiter(a, dos.referentId);
  const messages: Record<number, MessageEnvoi> = {};
  if (traiter) for (const d of tous.filter((x) => x.statut === 'envoye')) messages[d.id] = await messageEnvoiDevis(d.id, a);
  return {
    devis: tous,
    courant,
    accepte,
    avenants,
    contrat,
    postes: donnees.lignes,
    manques: donnees.manques,
    peutCreer: traiter && dos.statut === 'en_qualification' && !chaine.some((d) => !estTermine(d.statut) || d.statut === 'accepte') && donnees.manques.length === 0,
    peutCreerAvenant: traiter && !!accepte && STATUTS_AVENANT.includes(dos.statut) && !avenants.some((x) => !estTermine(x.statut)),
    tauxAcompteDefaut: g.tauxAcompteDefaut,
    bornes: g.bornes,
    messages,
  };
}

/** Capture de l'acceptation WhatsApp (RG-15) : référent du Dossier ou Direction ; lectures et refus journalisés. */
export async function lirePreuveAcceptation(dossierId: number, devisId: number, a: ActeurDevis): Promise<{ nom: string; mime: string; octets: Uint8Array } | null> {
  const [r] = await getDb()
    .select({ cle: schema.devis.acceptationPreuveCle, mime: schema.devis.acceptationPreuveMime, numero: schema.devis.numero, version: schema.devis.version, referentId: schema.dossier.referentId })
    .from(schema.devis)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.devis.dossierId))
    .where(and(eq(schema.devis.id, devisId), eq(schema.devis.dossierId, dossierId)));
  if (!r) return null;
  if (!peutTraiter(a, r.referentId)) {
    await journaliser({ ...auditDe(auteurDe(a)), action: 'acces.refuse', objetType: 'devis', objetId: devisId, details: { preuve: 'acceptation' } });
    throw new ErreurAccesDossier();
  }
  if (!r.cle) return null;
  const octets = await getStockage().lire(r.cle);
  await journaliser({ ...auditDe(auteurDe(a)), action: 'devis.preuve_consultee', objetType: 'devis', objetId: devisId, details: { dossierId } });
  const ext = r.mime === 'application/pdf' ? 'pdf' : (r.mime ?? 'image/jpeg').split('/')[1];
  return { nom: `acceptation-${r.numero}-v${r.version}.${ext}`, mime: r.mime ?? 'application/octet-stream', octets };
}
