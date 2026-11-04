// Onglet Finances — bloc « Régularisation » : trop-perçu, ajustement (remboursement ou crédit),
// remboursements et leur validation (specs/MVP2-05 RG-10..12). Implémenté par le lot B ;
// affiché par SectionFinances (lot A).
import type { Demandeur } from '@/lib/dossiers/acces';
import type { SituationFinanciere } from '@/lib/encaissements/lecture';

export interface PropsBlocRegularisation {
  dossierId: number;
  demandeur: Demandeur;
  /** Le demandeur peut traiter le Dossier (référent du Dossier ou Direction). */
  traiter: boolean;
  situation: SituationFinanciere;
}

export default async function BlocRegularisation(_props: PropsBlocRegularisation) {
  return null;
}
