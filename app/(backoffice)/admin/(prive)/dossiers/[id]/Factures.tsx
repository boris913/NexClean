'use client';
// MVP2-04 : boutons de la section « Factures » (génération du PDF, avoir de correction).
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './factures/actions';

function Retour({ r }: { r: ResultatAction | null }) {
  if (!r) return null;
  return r.ok ? (r.message ? <Alerte type="succes">{r.message}</Alerte> : null) : <Alerte>{r.erreur}</Alerte>;
}

export function GenererPdf({ dossierId, factureId }: { dossierId: number; factureId: number }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={envoi}
        className={classeBouton('secondaire')}
        onClick={async () => {
          setEnvoi(true);
          setR(await actions.genererPdfFacture(dossierId, factureId));
          setEnvoi(false);
        }}
      >
        {envoi ? 'Génération…' : 'Générer le PDF'}
      </button>
      {r && !r.ok && <Retour r={r} />}
    </div>
  );
}

export function EmettreAvoir({ dossierId, factureId, numero, montant }: { dossierId: number; factureId: number; numero: string; montant: string }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [motif, setMotif] = useState('');
  return (
    <details className="border border-ink-100 rounded-lg">
      <summary className="cursor-pointer list-none min-h-11 flex items-center px-3 text-sm font-medium text-red-700">Émettre un avoir</summary>
      <form
        className="px-3 pb-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!window.confirm(`Émettre un avoir de ${montant} sur la facture ${numero} ? Cette opération est définitive.`)) return;
          setEnvoi(true);
          const res = await actions.emettreAvoir(dossierId, factureId, motif.trim());
          setEnvoi(false);
          setR(res);
          if (res.ok) setMotif('');
        }}
      >
        <Retour r={r} />
        <p className="text-xs text-ink-600">Une facture émise ne se modifie pas : l’erreur est corrigée par un avoir de {montant}, numéroté dans la séquence des factures.</p>
        <div>
          <label htmlFor={`motif-avoir-${factureId}`} className={classeLibelle}>Motif de la correction</label>
          <input id={`motif-avoir-${factureId}`} required maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi || !motif.trim()} className={classeBouton('danger', true)}>
          {envoi ? 'Émission…' : `Émettre l’avoir sur ${numero}`}
        </button>
      </form>
    </details>
  );
}
