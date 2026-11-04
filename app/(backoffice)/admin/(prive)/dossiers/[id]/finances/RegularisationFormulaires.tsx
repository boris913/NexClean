'use client';
// MVP2-05 : formulaires du bloc « Régularisation » (onglet Finances) — ajustement d'un trop-perçu
// (RG-10), validation / refus d'un remboursement (Direction, RG-11), sortie d'un remboursement
// validé (Responsable finances ou Direction). Les droits sont revérifiés par les actions serveur.
import { useState, type ReactNode } from 'react';
import { Alerte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { formaterMontant } from '@/lib/devis/domaine';
import * as actions from './actions-regularisation';

function useAction() {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    const res = await fn();
    setEnvoi(false);
    setR(res);
    return res;
  };
  const retour: ReactNode = r ? r.ok ? r.message && <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte> : null;
  return { lancer, envoi, retour };
}

const classeFichier = 'block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-primary-light file:text-primary-dark';

/** RG-10 : choix du client pour le trop-perçu (remboursement ou crédit sur un prochain dossier). */
export function FormulaireAjustement({ dossierId, maximum }: { dossierId: number; maximum: number }) {
  const { lancer, envoi, retour } = useAction();
  const [choix, setChoix] = useState<'remboursement' | 'credit'>('remboursement');
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        await lancer(() => actions.preparerAjustement(dossierId, form));
      }}
    >
      {retour}
      <fieldset>
        <legend className={classeLibelle}>Choix du client</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {(
            [
              ['remboursement', 'Remboursement'],
              ['credit', 'Crédit sur un prochain dossier'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="flex min-h-11 items-center gap-2 text-sm text-ink-800">
              <input type="radio" name="choix" value={v} checked={choix === v} onChange={() => setChoix(v)} className="h-5 w-5 accent-primary" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`aj-montant-${dossierId}`} className={classeLibelle}>Montant (FCFA)</label>
        <input id={`aj-montant-${dossierId}`} name="montant" type="number" inputMode="numeric" min={1} max={maximum} step={1} defaultValue={maximum} required className={classeChamp} />
        <p className={classeAide}>Au plus {formaterMontant(maximum)} (trop-perçu à régulariser).</p>
      </div>
      <div>
        <label htmlFor={`aj-com-${dossierId}`} className={classeLibelle}>Commentaire (facultatif)</label>
        <textarea id={`aj-com-${dossierId}`} name="commentaire" rows={2} maxLength={1000} className={classeChamp} />
      </div>
      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
        {envoi ? 'Enregistrement…' : choix === 'remboursement' ? 'Préparer le remboursement' : 'Verser au crédit du client'}
      </button>
      {choix === 'remboursement' && <p className={classeAide}>Le remboursement sera soumis à la validation de la Direction.</p>}
    </form>
  );
}

/** RG-11 : validation ou refus (motif obligatoire) par la Direction. */
export function ValidationRemboursement({ dossierId, remboursementId }: { dossierId: number; remboursementId: number }) {
  const { lancer, envoi, retour } = useAction();
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState('');
  return (
    <div className="space-y-2">
      {retour}
      {refus ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await lancer(() => actions.refuserRemboursement(dossierId, remboursementId, motif.trim()));
            if (r.ok) setRefus(false);
          }}
        >
          <label htmlFor={`refus-${remboursementId}`} className={classeLibelle}>Motif du refus</label>
          <textarea id={`refus-${remboursementId}`} rows={2} required maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={envoi || !motif.trim()} className={classeBouton('danger')}>Refuser</button>
            <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => setRefus(false)}>Annuler</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={envoi} className={classeBouton('principal')} onClick={() => lancer(() => actions.validerRemboursement(dossierId, remboursementId))}>
            Valider
          </button>
          <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => setRefus(true)}>
            Refuser
          </button>
        </div>
      )}
    </div>
  );
}

/** RG-11 : sortie d'un remboursement validé (moyen, référence, date, justificatif). */
export function SortieRemboursement({ dossierId, remboursementId, montant, moyens, aujourdhui }: { dossierId: number; remboursementId: number; montant: number; moyens: { code: string; libelle: string }[]; aujourdhui: string }) {
  const { lancer, envoi, retour } = useAction();
  const [moyen, setMoyen] = useState(moyens[0]?.code ?? 'especes');
  const especes = moyen === 'especes';
  return (
    <details className="group border border-ink-100 rounded-lg">
      <summary className="cursor-pointer list-none min-h-11 flex items-center px-3 text-sm font-medium text-primary">Enregistrer le remboursement ({formaterMontant(montant)})</summary>
      <form
        className="px-3 pb-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          await lancer(() => actions.effectuerRemboursement(dossierId, remboursementId, form));
        }}
      >
        {retour}
        <div>
          <label htmlFor={`rb-moyen-${remboursementId}`} className={classeLibelle}>Moyen</label>
          <select id={`rb-moyen-${remboursementId}`} name="moyen" value={moyen} onChange={(e) => setMoyen(e.target.value)} className={classeChamp}>
            {moyens.map((m) => (
              <option key={m.code} value={m.code}>
                {m.libelle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`rb-ref-${remboursementId}`} className={classeLibelle}>Référence de la transaction{especes ? ' (facultatif)' : ''}</label>
          <input id={`rb-ref-${remboursementId}`} name="reference" required={!especes} maxLength={100} className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`rb-date-${remboursementId}`} className={classeLibelle}>Date de sortie</label>
          <input id={`rb-date-${remboursementId}`} name="date" type="date" required max={aujourdhui} defaultValue={aujourdhui} className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`rb-just-${remboursementId}`} className={classeLibelle}>Justificatif{especes ? ' (facultatif)' : ''}</label>
          <input id={`rb-just-${remboursementId}`} name="justificatif" type="file" accept="image/*,application/pdf" required={!especes} className={classeFichier} />
          <p className={classeAide}>Photo du reçu opérateur ou avis de virement (5 Mo maximum).</p>
        </div>
        {moyen === 'autre' && (
          <div>
            <label htmlFor={`rb-com-${remboursementId}`} className={classeLibelle}>Commentaire (obligatoire pour « Autre »)</label>
            <textarea id={`rb-com-${remboursementId}`} name="commentaire" rows={2} required maxLength={1000} className={classeChamp} />
          </div>
        )}
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
          {envoi ? 'Enregistrement…' : 'Enregistrer la sortie'}
        </button>
      </form>
    </details>
  );
}
