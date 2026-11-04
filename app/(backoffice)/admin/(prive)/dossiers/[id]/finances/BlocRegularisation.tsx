// Onglet Finances — bloc « Régularisation » : trop-perçu, ajustement (remboursement ou crédit),
// remboursements et leur validation (specs/MVP2-05 RG-10..12). Affiché par SectionFinances (lot A).
// Rien n'est affiché tant qu'il n'y a ni trop-perçu ni ajustement.
import { Alerte, Carte, Pastille } from '@/components/backoffice/ui';
import type { Demandeur } from '@/lib/dossiers/acces';
import { formaterMontant } from '@/lib/devis/domaine';
import { CHOIX_AJUSTEMENT, dateDuJour, MOYENS_PAIEMENT, MOYENS_SAISIE, STATUTS_REMBOURSEMENT, type StatutRemboursement } from '@/lib/encaissements/domaine';
import { tropPercuARegulariser, type SituationFinanciere } from '@/lib/encaissements/lecture';
import { FormulaireAjustement, SortieRemboursement, ValidationRemboursement } from './RegularisationFormulaires';

export interface PropsBlocRegularisation {
  dossierId: number;
  demandeur: Demandeur;
  /** Le demandeur peut traiter le Dossier (référent du Dossier ou Direction). */
  traiter: boolean;
  situation: SituationFinanciere;
}

const TON_REMBOURSEMENT: Record<StatutRemboursement, 'orange' | 'bleu' | 'rouge' | 'vert'> = { a_valider: 'orange', valide: 'bleu', refuse: 'rouge', effectue: 'vert' };
const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);

export default async function BlocRegularisation({ dossierId, demandeur, traiter, situation: s }: PropsBlocRegularisation) {
  const aRegulariser = tropPercuARegulariser(s);
  if (s.tropPercu <= 0 && !s.ajustements.length && !s.remboursements.length) return null;
  const direction = demandeur.roles.includes('direction');
  const finances = direction || demandeur.roles.includes('finances');
  const moyens = MOYENS_SAISIE.map((code) => ({ code, libelle: MOYENS_PAIEMENT[code] }));
  const aujourdhui = dateDuJour();
  const remboursementDe = new Map(s.remboursements.filter((r) => r.ajustementId !== null).map((r) => [r.ajustementId!, r]));
  return (
    <Carte
      titre="Régularisation du trop-perçu"
      description={s.montantFinalTtc !== null ? `Montant final ${formaterMontant(s.montantFinalTtc)} · encaissé ${formaterMontant(s.nets)}` : undefined}
      actions={aRegulariser > 0 ? <Pastille ton="orange" point>{formaterMontant(aRegulariser)} à régulariser</Pastille> : <Pastille ton="vert" point>Régularisé</Pastille>}
    >
      <div className="space-y-4">
        {aRegulariser > 0 &&
          (traiter ? (
            <div className="space-y-3">
              <Alerte type="info">
                Trop-perçu de {formaterMontant(aRegulariser)} à régulariser : un avoir est émis sur la facture d’acompte. Indiquez le choix du client.
              </Alerte>
              <FormulaireAjustement dossierId={dossierId} maximum={aRegulariser} />
            </div>
          ) : (
            <Alerte type="info">Trop-perçu de {formaterMontant(aRegulariser)} : le référent du dossier prépare l’ajustement selon le choix du client.</Alerte>
          ))}

        {s.ajustements.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink-700 mb-2">Ajustements</h3>
            <ul className="divide-y divide-ink-100 border border-ink-100 rounded-lg">
              {s.ajustements.map((a) => {
                const r = remboursementDe.get(a.id);
                return (
                  <li key={a.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ink-800">
                        <span className="font-medium">{CHOIX_AJUSTEMENT[a.choix]}</span> · <span className="tabular-nums">{formaterMontant(a.montant)}</span>
                        <span className="block text-xs text-ink-500">Préparé le {dateCourte(a.creeLe)}{a.commentaire ? ` · ${a.commentaire}` : ''}</span>
                      </p>
                      {r ? <Pastille ton={TON_REMBOURSEMENT[r.statut]} point>{STATUTS_REMBOURSEMENT[r.statut]}</Pastille> : <Pastille ton="vert" point>Crédit client</Pastille>}
                    </div>
                    {r?.statut === 'refuse' && r.motifRefus && <p className="text-xs text-red-700">Refusé : {r.motifRefus}</p>}
                    {r?.statut === 'valide' && r.valideLe && <p className="text-xs text-ink-500">Validé le {dateCourte(r.valideLe)}</p>}
                    {r?.statut === 'effectue' && r.effectueLe && <p className="text-xs text-ink-500">Effectué le {dateCourte(r.effectueLe)}</p>}
                    {r?.statut === 'a_valider' && (direction ? <ValidationRemboursement dossierId={dossierId} remboursementId={r.id} /> : <p className="text-xs text-ink-500">En attente de la validation de la Direction.</p>)}
                    {r?.statut === 'valide' && (finances ? <SortieRemboursement dossierId={dossierId} remboursementId={r.id} montant={r.montant} moyens={moyens} aujourdhui={aujourdhui} /> : <p className="text-xs text-ink-500">Le Responsable finances enregistrera la sortie.</p>)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {s.creditClient > 0 && <p className="text-xs text-ink-500">Crédit disponible du client : {formaterMontant(s.creditClient)} (proposé en déduction sur son prochain devis).</p>}
      </div>
    </Carte>
  );
}
