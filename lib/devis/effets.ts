// Effets partagés des devis et factures (specs/MVP2-04), appelés dans une transaction par le
// Back-Office, la page de suivi client et la clôture de la recherche. Indépendant de Next.js.
// Les contrôles de droits sont faits par l'appelant.
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { anneeDouala } from '@/lib/dossiers/numero';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { notifier } from '@/lib/notifications';
import { genererPdfFacture } from '@/lib/documents/rendu';
import { MENTIONS_LEGALES_PAR_DEFAUT } from '@/lib/parametres';
import { formaterMontant, formaterNumeroDocument, TYPES_FACTURE, type ModeAcceptation, type Sequence, type TypeFacture } from './domaine';

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const lienDevisDossier = (dossierId: number) => `/admin/dossiers/${dossierId}?onglet=devis`;

export type AuteurEffet = { type: 'collaborateur'; id: string; ip?: string | null } | { type: 'client'; ip?: string | null } | { type: 'systeme' };

export const auditDe = (a: AuteurEffet) =>
  a.type === 'collaborateur'
    ? { acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null }
    : a.type === 'client'
      ? { acteurType: 'client' as const, acteurId: null, ip: a.ip ?? null }
      : { acteurType: 'systeme' as const, acteurId: null };

const auteurIdDe = (a: AuteurEffet) => (a.type === 'collaborateur' ? a.id : null);

/**
 * Prochain numéro d'une séquence annuelle (DEV, FAC, REÇ). L'upsert verrouille la ligne de
 * séquence jusqu'à la fin de la transaction : deux émissions simultanées reçoivent deux numéros
 * consécutifs, et une transaction annulée ne consomme pas de numéro (RG-17 : sans trou).
 */
export async function prochainNumero(tx: Tx, sequence: Sequence, maintenant = new Date()): Promise<string> {
  const annee = anneeDouala(maintenant);
  const [ligne] = await tx
    .insert(schema.sequenceDocument)
    .values({ sequence, annee, dernier: 1 })
    .onConflictDoUpdate({ target: [schema.sequenceDocument.sequence, schema.sequenceDocument.annee], set: { dernier: sql`${schema.sequenceDocument.dernier} + 1` } })
    .returning({ dernier: schema.sequenceDocument.dernier });
  return formaterNumeroDocument(sequence, annee, ligne!.dernier);
}

/** Entrée d'historique du Dossier. */
export async function evenementDossier(tx: Tx, dossierId: number, commentaire: string, auteur: AuteurEffet, type: 'document' | 'transition' | 'modification' = 'document', apres?: unknown): Promise<void> {
  await tx.insert(schema.evenementDossier).values({ dossierId, type, commentaire, auteurId: auteurIdDe(auteur), apres: apres ?? null });
  await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, dossierId));
}

/**
 * Transition automatique du Dossier (MVP2-04 RG-08 ; MVP2-05 RG-05, RG-08, RG-11), journalisée ;
 * sans effet si le statut de départ ne correspond pas.
 */
export async function transitionAutomatique(tx: Tx, dossierId: number, de: readonly string[], vers: 'devis_pret' | 'devis_envoye' | 'accepte' | 'refuse' | 'acompte_recu' | 'solde_recu', motif: string): Promise<boolean> {
  const [d] = await tx.select({ statut: schema.dossier.statut }).from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d || !de.includes(d.statut)) return false;
  await tx.update(schema.dossier).set({ statut: vers, fermeLe: vers === 'refuse' ? new Date() : null }).where(eq(schema.dossier.id, dossierId));
  await tx.insert(schema.evenementDossier).values({ dossierId, type: 'transition', deStatut: d.statut, versStatut: vers, commentaire: `Transition automatique : ${motif}` });
  await journaliser({ acteurType: 'systeme', action: 'dossier.transition', objetType: 'dossier', objetId: dossierId, avant: d.statut, apres: vers, details: { automatique: true, motif } }, tx);
  return true;
}

export interface NouvelleFacture {
  type: TypeFacture;
  dossierId: number;
  devisId?: number | null;
  factureOrigineId?: number | null;
  libelle: string;
  lignes: { libelle: string; quantite: number; prixUnitaire: number; montantHt: number }[];
  tauxTva: number;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
}

/**
 * Émet une facture ou un avoir (RG-17) : numéro FAC-AAAA-NNNNN attribué dans la transaction,
 * client et mentions légales figés. La ligne est ensuite immuable (déclencheur en base).
 * Le PDF est produit après validation de la transaction : `archiverPdfFacture`.
 */
export async function emettreFacture(tx: Tx, f: NouvelleFacture, auteur: AuteurEffet): Promise<{ id: number; numero: string }> {
  if (f.totalTtc <= 0) throw new ErreurMetier('Montant de facture invalide.');
  const [c] = await tx
    .select({ nom: schema.client.nom, contact: schema.client.contact, whatsapp: schema.client.whatsapp, email: schema.client.email, ville: schema.ville.nom, villeAutre: schema.dossier.villeAutre })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(eq(schema.dossier.id, f.dossierId));
  if (!c) throw new ErreurMetier('Dossier introuvable.');
  const [p] = await tx.select({ valeur: schema.parametre.valeur }).from(schema.parametre).where(eq(schema.parametre.cle, 'mentions_legales'));
  const mentionsLegales = typeof p?.valeur === 'string' ? p.valeur : MENTIONS_LEGALES_PAR_DEFAUT;
  const numero = await prochainNumero(tx, 'facture');
  const [ligne] = await tx
    .insert(schema.facture)
    .values({
      numero,
      type: f.type,
      dossierId: f.dossierId,
      devisId: f.devisId ?? null,
      factureOrigineId: f.factureOrigineId ?? null,
      libelle: f.libelle,
      lignes: f.lignes,
      tauxTva: f.tauxTva,
      totalHt: f.totalHt,
      montantTva: f.montantTva,
      totalTtc: f.totalTtc,
      client: { nom: c.nom, contact: c.contact, whatsapp: c.whatsapp, email: c.email, ville: c.ville ?? c.villeAutre },
      mentionsLegales,
      auteurId: auteurIdDe(auteur),
    })
    .returning({ id: schema.facture.id });
  await evenementDossier(tx, f.dossierId, `${TYPES_FACTURE[f.type]} ${numero} émise : ${formaterMontant(f.totalTtc)}`, auteur, 'document', { factureId: ligne!.id, numero });
  await journaliser({ ...auditDe(auteur), action: 'facture.emise', objetType: 'facture', objetId: ligne!.id, apres: { numero, type: f.type, totalTtc: f.totalTtc, dossierId: f.dossierId } }, tx);
  return { id: ligne!.id, numero };
}

/** Archive un PDF généré dans les Documents du Dossier (RG-19). Retourne l'id du document et l'empreinte SHA-256. */
export async function archiverPdf(dossierId: number, nom: string, octets: Uint8Array, categorie: 'devis' | 'facture' | 'accuse_reception' | 'attestation' | 'recu', auteur: AuteurEffet, tx?: Tx): Promise<{ documentId: number; empreinte: string }> {
  const cle = nouvelleCle('dossiers', 'pdf');
  await getStockage().deposer(cle, octets);
  const empreinte = createHash('sha256').update(octets).digest('hex');
  try {
    const inserer = async (t: Tx) => {
      const [doc] = await t
        .insert(schema.document)
        .values({ dossierId, cle, nomOrigine: nom, mime: 'application/pdf', taille: octets.byteLength, categorie, auteurId: auteurIdDe(auteur) })
        .returning({ id: schema.document.id });
      return doc!.id;
    };
    const documentId = tx ? await inserer(tx) : await getDb().transaction(inserer);
    return { documentId, empreinte };
  } catch (e) {
    await getStockage().supprimer(cle);
    throw e;
  }
}

/** Génère et archive le PDF d'une facture émise (après validation de la transaction d'émission). Idempotent. */
export async function archiverPdfFacture(factureId: number): Promise<number> {
  const [deja] = await getDb().select({ documentId: schema.facturePdf.documentId }).from(schema.facturePdf).where(eq(schema.facturePdf.factureId, factureId));
  if (deja) return deja.documentId;
  const [f] = await getDb().select({ numero: schema.facture.numero, dossierId: schema.facture.dossierId }).from(schema.facture).where(eq(schema.facture.id, factureId));
  if (!f) throw new ErreurMetier('Facture introuvable.');
  const octets = await genererPdfFacture(factureId);
  return getDb().transaction(async (tx) => {
    const { documentId, empreinte } = await archiverPdf(f.dossierId, `${f.numero}.pdf`, octets, 'facture', { type: 'systeme' }, tx);
    await tx.insert(schema.facturePdf).values({ factureId, documentId, empreinte }).onConflictDoNothing();
    return documentId;
  });
}

/** Facture d'acompte d'un devis accepté (RG-13) : une seule par devis. */
export async function emettreFactureAcompte(tx: Tx, devisId: number, auteur: AuteurEffet): Promise<{ id: number; numero: string } | null> {
  const [d] = await tx.select().from(schema.devis).where(eq(schema.devis.id, devisId));
  if (!d || d.acompte <= 0) return null;
  const [existante] = await tx.select({ id: schema.facture.id, numero: schema.facture.numero }).from(schema.facture).where(and(eq(schema.facture.devisId, devisId), eq(schema.facture.type, 'acompte')));
  if (existante) return existante;
  // L'acompte est TTC ; décomposition au taux figé du devis.
  const totalHt = d.tauxTva > 0 ? Math.round((d.acompte * 100) / (100 + d.tauxTva)) : d.acompte;
  return emettreFacture(
    tx,
    {
      type: 'acompte',
      dossierId: d.dossierId,
      devisId,
      libelle: `Acompte de ${d.tauxAcompte} % sur le devis ${d.numero} (version ${d.version})`,
      lignes: [{ libelle: `Acompte ${d.tauxAcompte} % — devis ${d.numero} v${d.version}`, quantite: 1, prixUnitaire: totalHt, montantHt: totalHt }],
      tauxTva: d.tauxTva,
      totalHt,
      montantTva: d.acompte - totalHt,
      totalTtc: d.acompte,
    },
    auteur,
  );
}

export interface Acceptation {
  mode: ModeAcceptation;
  signataireNom: string;
  signataireFonction: string;
  ip?: string | null;
  navigateur?: string | null;
  /** RG-15 : capture de l'accord WhatsApp (obligatoire en mode `whatsapp`). */
  preuveCle?: string | null;
  preuveMime?: string | null;
  acceptationParId?: string | null;
  maintenant?: Date;
}

/**
 * RG-13, RG-15 : acceptation d'un devis ou d'un avenant `envoyé` (dernière version, non expiré).
 * Devis : Dossier → « Accepté », délai de recherche figé reporté sur le Dossier, facture d'acompte.
 * Avenant : prolongation du délai reportée sur le Dossier. Référent notifié.
 * Retourne la facture d'acompte émise (à archiver après la transaction avec `archiverPdfFacture`).
 */
export async function accepterDevis(tx: Tx, devisId: number, a: Acceptation, auteur: AuteurEffet): Promise<{ facture: { id: number; numero: string } | null }> {
  const maintenant = a.maintenant ?? new Date();
  if (!a.signataireNom.trim() || !a.signataireFonction.trim()) throw new ErreurMetier('Indiquez le nom et la fonction du signataire.');
  if (a.mode === 'whatsapp' && !a.preuveCle) throw new ErreurMetier('Joignez la capture de l’acceptation WhatsApp.');
  const [d] = await tx.select().from(schema.devis).where(eq(schema.devis.id, devisId)).for('update');
  if (!d) throw new ErreurMetier('Devis introuvable.');
  if (d.statut === 'remplace') throw new ErreurMetier('Ce devis a été remplacé par une version plus récente.');
  if (d.statut !== 'envoye') throw new ErreurMetier('Ce devis ne peut plus être accepté.');
  if (d.expireLe && maintenant.getTime() > d.expireLe.getTime()) throw new ErreurMetier('Ce devis a expiré.');
  await tx
    .update(schema.devis)
    .set({
      statut: 'accepte',
      acceptationMode: a.mode,
      accepteLe: maintenant,
      signataireNom: a.signataireNom.trim(),
      signataireFonction: a.signataireFonction.trim(),
      acceptationIp: a.ip ?? null,
      acceptationNavigateur: a.navigateur?.slice(0, 300) ?? null,
      acceptationPreuveCle: a.preuveCle ?? null,
      acceptationPreuveMime: a.preuveMime ?? null,
      acceptationParId: a.acceptationParId ?? null,
      majLe: maintenant,
    })
    .where(eq(schema.devis.id, devisId));
  const libelle = `${d.type === 'avenant' ? 'Avenant' : 'Devis'} ${d.numero} v${d.version}`;
  await evenementDossier(
    tx,
    d.dossierId,
    `${libelle} accepté (${a.mode === 'suivi' ? 'page de suivi' : 'WhatsApp'}) par ${a.signataireNom.trim()}, ${a.signataireFonction.trim()}${a.ip ? ` — IP ${a.ip}` : ''}${d.pdfEmpreinte ? ` — empreinte ${d.pdfEmpreinte.slice(0, 16)}…` : ''}`,
    auteur,
    'document',
    { devisId, version: d.version, numero: d.numero, signataireNom: a.signataireNom.trim(), signataireFonction: a.signataireFonction.trim(), ip: a.ip ?? null, empreinte: d.pdfEmpreinte },
  );
  let factureEmise: { id: number; numero: string } | null = null;
  if (d.type === 'devis') {
    await tx.update(schema.dossier).set({ delaiRechercheJours: d.delaiRechercheJours }).where(eq(schema.dossier.id, d.dossierId));
    await transitionAutomatique(tx, d.dossierId, ['devis_envoye', 'devis_pret'], 'accepte', `${libelle} accepté`);
    factureEmise = await emettreFactureAcompte(tx, devisId, auteur);
  } else if (d.prolongationJours) {
    await tx
      .update(schema.dossier)
      .set({ delaiRechercheJours: sql`coalesce(${schema.dossier.delaiRechercheJours}, ${d.delaiRechercheJours}) + ${d.prolongationJours}` })
      .where(eq(schema.dossier.id, d.dossierId));
  }
  await journaliser({ ...auditDe(auteur), action: 'devis.accepte', objetType: 'devis', objetId: devisId, apres: { mode: a.mode, version: d.version, empreinte: d.pdfEmpreinte } }, tx);
  const [dos] = await tx.select({ referentId: schema.dossier.referentId, numero: schema.dossier.numero }).from(schema.dossier).where(eq(schema.dossier.id, d.dossierId));
  if (auteur.type !== 'collaborateur' && dos?.referentId) {
    await notifier({ destinataires: [dos.referentId], type: 'devis_accepte', dossierId: d.dossierId, titre: 'Devis accepté', texte: `${dos.numero} : ${libelle} accepté par ${a.signataireNom.trim()}.`, lien: lienDevisDossier(d.dossierId), cle: `devis_accepte:${devisId}` }, tx);
  }
  return { facture: factureEmise };
}

/**
 * RG-14, RG-08 : refus d'un devis `envoyé` (client sur la page de suivi, ou référent qui
 * l'enregistre). Devis : Dossier → « Refusé » (le référent peut rouvrir en « En qualification »
 * pour une nouvelle version). Avenant : le devis initial reste acquis. Référent notifié.
 */
export async function refuserDevis(tx: Tx, devisId: number, motif: string | null, auteur: AuteurEffet, maintenant = new Date()): Promise<void> {
  const [d] = await tx.select().from(schema.devis).where(eq(schema.devis.id, devisId)).for('update');
  if (!d) throw new ErreurMetier('Devis introuvable.');
  if (d.statut === 'remplace') throw new ErreurMetier('Ce devis a été remplacé par une version plus récente.');
  if (d.statut !== 'envoye') throw new ErreurMetier('Ce devis ne peut plus être refusé.');
  const m = motif?.trim().slice(0, 1000) || null;
  await tx.update(schema.devis).set({ statut: 'refuse', refusLe: maintenant, refusMotif: m, majLe: maintenant }).where(eq(schema.devis.id, devisId));
  const libelle = `${d.type === 'avenant' ? 'Avenant' : 'Devis'} ${d.numero} v${d.version}`;
  await evenementDossier(tx, d.dossierId, `${libelle} refusé${m ? ` : ${m}` : ''}`, auteur, 'document', { devisId, version: d.version, motif: m });
  if (d.type === 'devis') await transitionAutomatique(tx, d.dossierId, ['devis_envoye', 'devis_pret'], 'refuse', `${libelle} refusé`);
  await journaliser({ ...auditDe(auteur), action: 'devis.refuse', objetType: 'devis', objetId: devisId, details: m ? { motif: m } : undefined }, tx);
  const [dos] = await tx.select({ referentId: schema.dossier.referentId, numero: schema.dossier.numero }).from(schema.dossier).where(eq(schema.dossier.id, d.dossierId));
  if (auteur.type !== 'collaborateur' && dos?.referentId) {
    await notifier({ destinataires: [dos.referentId], type: 'devis_refuse', dossierId: d.dossierId, titre: 'Devis refusé', texte: `${dos.numero} : ${libelle} refusé par le client${m ? ` (${m})` : ''}.`, lien: lienDevisDossier(d.dossierId), cle: `devis_refuse:${devisId}` }, tx);
  }
}
