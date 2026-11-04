'use client';
// MVP2-05 (lot A) : formulaires de l'onglet Finances — « Enregistrer un paiement » (RG-01, RG-03),
// « Demander l'annulation » (référent) et « Annuler l'encaissement » (Finances / Direction, RG-02).
// Un Encaissement enregistré ne se modifie jamais : seule l'annulation est proposée.
import { useState } from 'react';
import Link from 'next/link';
import { dateDuJour, MOYENS_PAIEMENT, MOYENS_SAISIE, NATURES_ENCAISSEMENT, NATURE_CODES, type MoyenPaiement, type NatureEncaissement } from '@/lib/encaissements/domaine';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions-encaissements';

function Retour({ r }: { r: ResultatAction | null }) {
  if (!r) return null;
  return r.ok ? (r.message ? <Alerte type="succes">{r.message}</Alerte> : null) : <Alerte>{r.erreur}</Alerte>;
}

export function EnregistrerPaiement({ dossierId, natureParDefaut, aide }: { dossierId: number; natureParDefaut: NatureEncaissement; aide?: string | null }) {
  const [r, setR] = useState<actions.ResultatEncaissement | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [moyen, setMoyen] = useState<MoyenPaiement | ''>('');
  const [cle, setCle] = useState(0);
  const especes = moyen === 'especes';
  return (
    <Carte titre="Enregistrer un paiement" description="Montant réellement reçu (frais opérateur déduits). Un paiement enregistré ne se modifie plus : une erreur se corrige par une annulation.">
      <form
        key={cle}
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setEnvoi(true);
          const res = await actions.enregistrerEncaissement(dossierId, f);
          setEnvoi(false);
          setR(res);
          if (res.ok) {
            setMoyen('');
            setCle((k) => k + 1);
          }
        }}
      >
        {r && !r.ok && 'lienDoublon' in r ? (
          <Alerte>
            {r.erreur}{' '}
            <Link href={r.lienDoublon} className="font-medium underline">
              Voir l’encaissement existant
            </Link>
          </Alerte>
        ) : (
          <Retour r={r} />
        )}
        {aide && <p className="text-sm text-ink-600">{aide}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="enc-nature" className={classeLibelle}>Nature</label>
            <select id="enc-nature" name="nature" defaultValue={natureParDefaut} className={classeChamp}>
              {NATURE_CODES.map((n) => (
                <option key={n} value={n}>{NATURES_ENCAISSEMENT[n]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="enc-montant" className={classeLibelle}>Montant reçu (FCFA)</label>
            <input id="enc-montant" name="montant" required inputMode="numeric" pattern="[0-9  .]*" autoComplete="off" className={classeChamp} />
          </div>
          <div>
            <label htmlFor="enc-moyen" className={classeLibelle}>Moyen de paiement</label>
            <select id="enc-moyen" name="moyen" required value={moyen} onChange={(e) => setMoyen(e.target.value as MoyenPaiement)} className={classeChamp}>
              <option value="">Choisir…</option>
              {MOYENS_SAISIE.map((m) => (
                <option key={m} value={m}>{MOYENS_PAIEMENT[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="enc-date" className={classeLibelle}>Date de réception</label>
            <input id="enc-date" name="recuLe" type="date" required max={dateDuJour()} defaultValue={dateDuJour()} className={classeChamp} />
          </div>
        </div>
        {!especes && (
          <div>
            <label htmlFor="enc-ref" className={classeLibelle}>Référence de la transaction</label>
            <input id="enc-ref" name="reference" required={moyen !== ''} maxLength={120} autoComplete="off" placeholder="ex. MP2611.1234.A" className={classeChamp} />
          </div>
        )}
        <div>
          <label htmlFor="enc-justif" className={classeLibelle}>Justificatif {especes ? '(facultatif pour les espèces)' : ''}</label>
          <input
            id="enc-justif"
            type="file"
            name="justificatif"
            required={!especes && moyen !== ''}
            accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
            capture="environment"
            className="block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-primary-light file:text-primary-dark"
          />
          <p className={classeAide}>Photo du reçu opérateur ou avis de virement (JPEG, PNG, WEBP ou PDF, 5 Mo maximum). Interne : jamais montré au client.</p>
        </div>
        <div>
          <label htmlFor="enc-comm" className={classeLibelle}>Commentaire {moyen === 'autre' ? '(obligatoire : précisez, ex. numéro personnel d’un collaborateur)' : '(facultatif)'}</label>
          <textarea id="enc-comm" name="commentaire" rows={2} maxLength={1000} required={moyen === 'autre'} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le paiement'}
        </button>
      </form>
    </Carte>
  );
}

function FormulaireMotif({ libelle, bouton, danger, confirmation, onValider }: { libelle: string; bouton: string; danger?: boolean; confirmation?: string; onValider: (motif: string) => Promise<ResultatAction> }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [motif, setMotif] = useState('');
  return (
    <form
      className="px-3 pb-3 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirmation && !window.confirm(confirmation)) return;
        setEnvoi(true);
        const res = await onValider(motif.trim());
        setEnvoi(false);
        setR(res);
        if (res.ok) setMotif('');
      }}
    >
      <Retour r={r} />
      <div>
        <label className={classeLibelle}>
          {libelle}
          <textarea required rows={2} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} className={`${classeChamp} mt-1.5`} />
        </label>
      </div>
      <button type="submit" disabled={envoi || !motif.trim()} className={classeBouton(danger ? 'danger' : 'secondaire', true)}>
        {envoi ? 'Envoi…' : bouton}
      </button>
    </form>
  );
}

const classeResume = 'cursor-pointer list-none min-h-11 flex items-center px-3 text-sm font-medium';

export function DemanderAnnulation({ dossierId, encaissementId }: { dossierId: number; encaissementId: number }) {
  return (
    <details className="border border-ink-100 rounded-lg">
      <summary className={`${classeResume} text-ink-700`}>Demander l’annulation</summary>
      <FormulaireMotif libelle="Motif de la demande (erreur de montant, de référence…)" bouton="Envoyer la demande" onValider={(m) => actions.demanderAnnulation(dossierId, encaissementId, m)} />
    </details>
  );
}

export function AnnulerEncaissement({ dossierId, encaissementId, recu }: { dossierId: number; encaissementId: number; recu: string }) {
  return (
    <details className="border border-ink-100 rounded-lg">
      <summary className={`${classeResume} text-red-700`}>Annuler l’encaissement</summary>
      <FormulaireMotif
        libelle="Motif de l’annulation (obligatoire)"
        bouton={`Annuler ${recu}`}
        danger
        confirmation={`Annuler l’encaissement ${recu} ? Une écriture inverse sera enregistrée et le reçu marqué « annulé ». Cette opération est définitive.`}
        onValider={(m) => actions.annulerEncaissement(dossierId, encaissementId, m)}
      />
    </details>
  );
}

export function TraiterDemande({ dossierId, demandeId, recu }: { dossierId: number; demandeId: number; recu: string }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [reponse, setReponse] = useState('');
  const traiter = async (decision: 'accepter' | 'refuser') => {
    if (decision === 'accepter' && !window.confirm(`Annuler l’encaissement ${recu} ? Une écriture inverse sera enregistrée. Cette opération est définitive.`)) return;
    setEnvoi(true);
    setR(await actions.traiterDemandeAnnulation(dossierId, demandeId, decision, reponse.trim()));
    setEnvoi(false);
  };
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <label className={classeLibelle}>
        Réponse (obligatoire pour refuser)
        <input value={reponse} maxLength={1000} onChange={(e) => setReponse(e.target.value)} className={`${classeChamp} mt-1.5`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={envoi} onClick={() => traiter('accepter')} className={classeBouton('danger')}>Annuler l’encaissement</button>
        <button type="button" disabled={envoi || !reponse.trim()} onClick={() => traiter('refuser')} className={classeBouton('secondaire')}>Refuser</button>
      </div>
    </div>
  );
}
