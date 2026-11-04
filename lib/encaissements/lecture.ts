// Situation financière d'un Dossier (specs/MVP2-05 RG-05, RG-08, RG-14, RG-15) : lecture partagée
// par l'onglet Finances (Back-Office), la clôture du Dossier et la page de suivi. Sans contrôle de
// droits : l'appelant vérifie l'accès au Dossier.
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { acompteDu, aUnRemboursementEnAttente, creditDisponible, devisDeReference, ecrituresDossier, versEcriture } from './effets';
import { acompteEncaisse, encaissementsNets, etatAcompte, idsAnnules, issueCloture, type EtatAcompte, type IssueCloture } from './domaine';

type Lecteur = Pick<ReturnType<typeof getDb>, 'select'>;

export interface SituationFinanciere {
  dossierId: number;
  clientId: number;
  /** Devis accepté, ou envoyé (RG-06) ; null sans devis intégré. */
  devis: { id: number; numero: string; version: number; statut: string; totalTtc: number; acompte: number; deductionCredit: number; acompteDu: number } | null;
  /** Écritures (encaissements, annulations, remboursements), avec l'indication « annulé ». */
  ecritures: (typeof schema.encaissement.$inferSelect & { annule: boolean })[];
  /** Σ de toutes les écritures (RG-08). */
  nets: number;
  acompteEncaisse: number;
  etatAcompte: EtatAcompte;
  /** RG-07 : montant final TTC figé à la clôture de la recherche (null tant qu'inconnu). */
  montantFinalTtc: number | null;
  /** Montant final connu : reste à payer (> 0), soldé (0) ou trop-perçu (< 0 → `issue`). */
  issue: IssueCloture | null;
  /**
   * Reste à payer affiché : montant final − nets si connu ; sinon montant TTC du devis − nets
   * (crédit client imputé compris). Jamais négatif (voir `tropPercu`).
   */
  resteAPayer: number;
  tropPercu: number;
  remboursementEnAttente: boolean;
  /** Ajustements déjà préparés (RG-10) et remboursements (RG-11). */
  ajustements: (typeof schema.ajustement.$inferSelect)[];
  remboursements: (typeof schema.remboursement.$inferSelect)[];
  /** RG-12 : crédit disponible du Client. */
  creditClient: number;
}

export async function situationFinanciere(dossierId: number, db: Lecteur = getDb()): Promise<SituationFinanciere | null> {
  const [d] = await db.select({ id: schema.dossier.id, clientId: schema.dossier.clientId, montantFinalTtc: schema.dossier.montantFinalTtc }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d) return null;
  const dv = await devisDeReference(db, dossierId);
  const lignes = await ecrituresDossier(db, dossierId);
  const ecritures = lignes.map(versEcriture);
  const annules = idsAnnules(ecritures);
  const nets = encaissementsNets(ecritures);
  const encAcompte = acompteEncaisse(ecritures);
  const du = dv ? acompteDu(dv) : null;
  const issue = d.montantFinalTtc !== null ? issueCloture(d.montantFinalTtc, nets) : null;
  const reference = d.montantFinalTtc ?? (dv ? dv.totalTtc : null);
  const ecart = reference === null ? 0 : reference - nets;
  const [ajustements, remboursements] = await Promise.all([
    db.select().from(schema.ajustement).where(eq(schema.ajustement.dossierId, dossierId)).orderBy(asc(schema.ajustement.id)),
    db.select().from(schema.remboursement).where(eq(schema.remboursement.dossierId, dossierId)).orderBy(asc(schema.remboursement.id)),
  ]);
  return {
    dossierId,
    clientId: d.clientId,
    devis: dv ? { id: dv.id, numero: dv.numero, version: dv.version, statut: dv.statut, totalTtc: dv.totalTtc, acompte: dv.acompte, deductionCredit: dv.deductionCredit, acompteDu: du! } : null,
    ecritures: lignes.map((l) => ({ ...l, annule: annules.has(l.id) })),
    nets,
    acompteEncaisse: encAcompte,
    etatAcompte: etatAcompte(du, encAcompte),
    montantFinalTtc: d.montantFinalTtc,
    issue,
    resteAPayer: Math.max(0, ecart),
    tropPercu: d.montantFinalTtc !== null ? Math.max(0, -ecart) : 0,
    remboursementEnAttente: await aUnRemboursementEnAttente(db, dossierId),
    ajustements,
    remboursements,
    creditClient: await creditDisponible(db, d.clientId),
  };
}

/**
 * Trop-perçu restant à régulariser (RG-10) : trop-perçu − ajustements « remboursement » préparés
 * mais pas encore effectués. (Un remboursement effectué et un crédit client sont des écritures
 * négatives : ils réduisent déjà `tropPercu`.) Un remboursement refusé libère son montant.
 */
export const tropPercuARegulariser = (s: Pick<SituationFinanciere, 'tropPercu' | 'ajustements' | 'remboursements'>) => {
  const enCours = s.remboursements.filter((r) => r.statut === 'a_valider' || r.statut === 'valide').reduce((t, r) => t + r.montant, 0);
  return Math.max(0, s.tropPercu - enCours);
};
