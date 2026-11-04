// Paiements sur la page de suivi du client (specs/MVP2-05 RG-04, RG-15) : montant du devis,
// acompte demandé, paiements (avec reçu téléchargeable), reste à payer ou trop-perçu en cours de
// régularisation. Indépendant de Next.js. L'appelant contrôle le cookie de vérification des
// 4 chiffres (`estVerifie`) avant d'appeler ces fonctions.
//
// **Aucune donnée interne** : ni commentaire, ni justificatif, ni motif d'annulation, ni auteur,
// ni demande d'annulation, ni statut interne d'un remboursement (seuls les remboursements
// effectués apparaissent). Seule la référence de la transaction (connue du client) est montrée.
//
// Paiement annulé (RG-02) : il reste listé, marqué « annulé » et exclu des montants payés ; son
// reçu reste téléchargeable tel qu'il a été émis (le client peut l'avoir déjà reçu), avec la
// mention « annulé » à côté du lien. L'écriture d'annulation elle-même n'est pas listée.
import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { getStockage } from '@/lib/fichiers/stockage';
import type { Contexte } from '@/lib/propositions/client';
import { MOYENS_PAIEMENT, NATURES_ENCAISSEMENT } from './domaine';
import { archiverPdfRecu } from './effets';
import { situationFinanciere, tropPercuARegulariser } from './lecture';

export type LignePaiementClient =
  | { genre: 'paiement'; id: number; date: string; montant: number; nature: string; moyen: string; reference: string | null; recuNumero: string | null; annule: boolean }
  | { genre: 'credit_utilise'; id: number; date: string; montant: number }
  | { genre: 'credit_verse'; id: number; date: string; montant: number }
  | { genre: 'remboursement'; id: number; date: string; montant: number };

export interface PaiementsClient {
  devis: { numero: string; version: number; totalTtc: number; acompte: number; deductionCredit: number } | null;
  /** Montant final (connu à la clôture de la recherche). */
  montantFinalTtc: number | null;
  lignes: LignePaiementClient[];
  /** Somme des paiements non annulés et du crédit client imputé (hors remboursements). */
  totalPaye: number;
  resteAPayer: number;
  /** Trop-perçu restant (avant remboursement ou versement au crédit). */
  tropPercu: number;
  /** Trop-perçu dont la régularisation (remboursement) est engagée. */
  regularisationEnCours: boolean;
}

/** RG-15 : paiements du Dossier REC vus par le client (null hors Dossier REC ou sans devis ni paiement). */
export async function paiementsPourSuivi(ctx: Contexte): Promise<PaiementsClient | null> {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') return null;
  const s = await situationFinanciere(ctx.dossierId);
  if (!s || (!s.devis && s.ecritures.length === 0)) return null;
  const lignes: LignePaiementClient[] = s.ecritures.flatMap((e): LignePaiementClient[] => {
    if (e.type === 'encaissement') {
      return [{ genre: 'paiement', id: e.id, date: e.recuLe, montant: e.montant, nature: NATURES_ENCAISSEMENT[e.nature], moyen: MOYENS_PAIEMENT[e.moyen], reference: e.moyen === 'especes' ? null : e.reference, recuNumero: e.recuNumero, annule: e.annule }];
    }
    if (e.type === 'credit') return [{ genre: e.montant > 0 ? 'credit_utilise' : 'credit_verse', id: e.id, date: e.recuLe, montant: Math.abs(e.montant) }];
    if (e.type === 'remboursement') return [{ genre: 'remboursement', id: e.id, date: e.recuLe, montant: Math.abs(e.montant) }];
    return []; // annulation : portée par le paiement marqué « annulé »
  });
  const totalPaye = lignes.reduce((t, l) => t + ((l.genre === 'paiement' && !l.annule) || l.genre === 'credit_utilise' ? l.montant : 0), 0);
  const aRegulariser = tropPercuARegulariser(s);
  return {
    devis: s.devis ? { numero: s.devis.numero, version: s.devis.version, totalTtc: s.devis.totalTtc, acompte: s.devis.acompte, deductionCredit: s.devis.deductionCredit } : null,
    montantFinalTtc: s.montantFinalTtc,
    lignes,
    totalPaye,
    resteAPayer: s.resteAPayer,
    tropPercu: s.tropPercu,
    regularisationEnCours: s.tropPercu > 0 && aRegulariser < s.tropPercu,
  };
}

export interface FichierClient {
  nom: string;
  octets: Uint8Array;
}

/**
 * PDF du reçu d'un paiement du Dossier (archivé à la volée s'il ne l'est pas encore), journalisé.
 * Le reçu doit appartenir au Dossier du jeton (sinon « introuvable », sans distinction).
 */
export async function pdfRecuClient(ctx: Contexte, encaissementId: number, ip: string | null): Promise<FichierClient> {
  if (ctx.type !== 'dossier' || ctx.typeDossier !== 'REC') throw new ErreurMetier('Document introuvable.');
  if (!Number.isInteger(encaissementId) || encaissementId <= 0) throw new ErreurMetier('Document introuvable.');
  const [e] = await getDb()
    .select({ recuNumero: schema.encaissement.recuNumero, documentId: schema.recuPdf.documentId })
    .from(schema.encaissement)
    .leftJoin(schema.recuPdf, eq(schema.recuPdf.encaissementId, schema.encaissement.id))
    .where(and(eq(schema.encaissement.id, encaissementId), eq(schema.encaissement.dossierId, ctx.dossierId), eq(schema.encaissement.type, 'encaissement')));
  if (!e?.recuNumero) throw new ErreurMetier('Document introuvable.');
  const documentId = e.documentId ?? (await archiverPdfRecu(encaissementId));
  const [doc] = await getDb()
    .select({ cle: schema.document.cle })
    .from(schema.document)
    .where(and(eq(schema.document.id, documentId), isNull(schema.document.supprimeLe)));
  if (!doc) throw new ErreurMetier('Document indisponible.');
  const octets = await getStockage().lire(doc.cle);
  await journaliser({ acteurType: 'client', action: 'recu.pdf_telecharge', objetType: 'encaissement', objetId: encaissementId, ip, details: { dossierId: ctx.dossierId, via: 'suivi', documentId, numero: e.recuNumero } });
  return { nom: `${e.recuNumero}.pdf`, octets };
}
