// Rendu PDF des documents (specs/MVP2-04 RG-16, RG-19, RG-20). Points d'entrée partagés :
// les services (devis, factures, page de suivi) les appellent ; la mise en page commune est dans
// ./mise-en-page.ts et les modèles dans ./modeles.ts.
// Chaque fonction lit **uniquement les données figées** en base (RG-02 : jamais les paramètres
// tarifaires courants) et renvoie les octets du PDF (A4 portrait, police ≥ 10 pt, < 300 Ko).
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { lireParametre } from '@/lib/parametres';
import { pdfAccuseReception, pdfDevis, pdfFacture, type ClientDocument } from './modeles';

/** Client d'un Dossier (coordonnées courantes ; la facture, elle, porte un client figé). */
async function clientDuDossier(dossierId: number): Promise<{ numeroDossier: string; creeLe: Date; type: string; client: ClientDocument } | null> {
  const [r] = await getDb()
    .select({
      numero: schema.dossier.numero,
      creeLe: schema.dossier.creeLe,
      type: schema.dossier.type,
      villeAutre: schema.dossier.villeAutre,
      ville: schema.ville.nom,
      nom: schema.client.nom,
      contact: schema.client.contact,
      whatsapp: schema.client.whatsapp,
      email: schema.client.email,
    })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(eq(schema.dossier.id, dossierId));
  if (!r) return null;
  return { numeroDossier: r.numero, creeLe: r.creeLe, type: r.type, client: { nom: r.nom, contact: r.contact, whatsapp: r.whatsapp, email: r.email, ville: r.ville ?? r.villeAutre } };
}

/** Devis ou avenant (DEV-AAAA-NNNNN, version) — valeurs figées de la ligne `devis`. */
export async function genererPdfDevis(devisId: number): Promise<Uint8Array> {
  const [d] = await getDb().select().from(schema.devis).where(eq(schema.devis.id, devisId));
  if (!d) throw new ErreurMetier('Devis introuvable.');
  const dossier = await clientDuDossier(d.dossierId);
  if (!dossier) throw new ErreurMetier('Dossier introuvable.');
  const [initial] = d.devisInitialId ? await getDb().select({ numero: schema.devis.numero, version: schema.devis.version }).from(schema.devis).where(eq(schema.devis.id, d.devisInitialId)) : [];
  return pdfDevis({
    type: d.type,
    numero: d.numero,
    version: d.version,
    devisInitial: initial ?? null,
    numeroDossier: dossier.numeroDossier,
    date: d.envoyeLe ?? d.valideLe ?? d.creeLe,
    validiteJours: d.validiteJours,
    expireLe: d.expireLe,
    client: dossier.client,
    lignes: d.lignes,
    tauxTva: d.tauxTva,
    totalHt: d.totalHt,
    montantTva: d.montantTva,
    totalTtc: d.totalTtc,
    tauxAcompte: d.tauxAcompte,
    acompte: d.acompte,
    delaiRechercheJours: d.delaiRechercheJours,
    prolongationJours: d.prolongationJours,
    garantieJours: d.garantieJours,
    conditions: d.conditions,
    conditionsParticulieres: d.conditionsParticulieres,
    mentionsLegales: d.mentionsLegales,
  });
}

/** Facture d'acompte, de solde ou avoir — valeurs figées de la ligne `facture`. */
export async function genererPdfFacture(factureId: number): Promise<Uint8Array> {
  const [f] = await getDb()
    .select({ facture: schema.facture, numeroDossier: schema.dossier.numero })
    .from(schema.facture)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.facture.dossierId))
    .where(eq(schema.facture.id, factureId));
  if (!f) throw new ErreurMetier('Facture introuvable.');
  const x = f.facture;
  const [origine] = x.factureOrigineId ? await getDb().select({ numero: schema.facture.numero, emiseLe: schema.facture.emiseLe }).from(schema.facture).where(eq(schema.facture.id, x.factureOrigineId)) : [];
  const [devis] = x.devisId ? await getDb().select({ numero: schema.devis.numero, version: schema.devis.version }).from(schema.devis).where(eq(schema.devis.id, x.devisId)) : [];
  return pdfFacture({
    type: x.type,
    numero: x.numero,
    emiseLe: x.emiseLe,
    numeroDossier: f.numeroDossier,
    libelle: x.libelle,
    devis: devis ?? null,
    factureOrigine: origine ?? null,
    client: x.client,
    lignes: x.lignes,
    tauxTva: x.tauxTva,
    totalHt: x.totalHt,
    montantTva: x.montantTva,
    totalTtc: x.totalTtc,
    mentionsLegales: x.mentionsLegales,
  });
}

/**
 * MVP2-05 RG-04 : reçu d'un Encaissement (REÇ-AAAA-NNNNN) — valeurs figées de la ligne
 * `encaissement` (montant, moyen, référence, date de réception, Dossier, client).
 * À IMPLÉMENTER (lot C) : modèle `pdfRecu` dans ./modeles.ts.
 */
export async function genererPdfRecu(encaissementId: number): Promise<Uint8Array> {
  throw new ErreurMetier(`Rendu du reçu non disponible (encaissement ${encaissementId}).`);
}

/**
 * Accusé de réception d'un Dossier REC (numéro de dossier). Aucune valeur tarifaire : les
 * mentions légales sont celles en vigueur à la génération (document non figé, régénérable).
 */
export async function genererAccuseReception(dossierId: number): Promise<Uint8Array> {
  const dossier = await clientDuDossier(dossierId);
  if (!dossier) throw new ErreurMetier('Dossier introuvable.');
  if (dossier.type !== 'REC') throw new ErreurMetier('L’accusé de réception concerne les dossiers de recrutement.');
  const postes = await getDb().select({ intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(asc(schema.lignePoste.ordre));
  return pdfAccuseReception({ numeroDossier: dossier.numeroDossier, creeLe: dossier.creeLe, client: dossier.client, postes, mentionsLegales: await lireParametre('mentions_legales') });
}
