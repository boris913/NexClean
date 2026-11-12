'use client';
// COM1-02 RG-01 : planifier, replanifier et clôturer un rendez-vous depuis la fiche dossier.
import { useState, type ReactNode } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { RDV_TYPES, RDV_TYPE_CODES, type RdvStatut, type RdvType } from '@/lib/rendezvous/domaine';
import * as actions from '../actions';

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

export interface ValeursRdv {
  type: RdvType;
  jour: string;
  heure: string;
  dureeMinutes: number;
  lieu: string;
  participants: string[];
}

const lire = (f: FormData): ValeursRdv => ({
  type: String(f.get('type')) as RdvType,
  jour: String(f.get('jour') ?? ''),
  heure: String(f.get('heure') ?? ''),
  dureeMinutes: Number(f.get('dureeMinutes') ?? 60),
  lieu: String(f.get('lieu') ?? ''),
  participants: f.getAll('participants').map(String),
});

/** Formulaire commun à la planification et à la replanification. */
export function FormulaireRdv({
  dossierId,
  rdvId,
  initial,
  collaborateurs,
  referentId,
  onFini,
}: {
  dossierId: number;
  rdvId?: number;
  initial?: ValeursRdv;
  collaborateurs: { id: string; nom: string }[];
  referentId: string | null;
  onFini?: () => void;
}) {
  const { lancer, envoi, retour } = useAction();
  const [cle, setCle] = useState(0);
  const p = rdvId ? `rdv-${rdvId}` : 'rdv';
  const autres = collaborateurs.filter((c) => c.id !== referentId);
  return (
    <form
      key={cle}
      className="space-y-3"
      action={async (f) => {
        const v = lire(f);
        const res = await lancer(() => (rdvId ? actions.modifierRendezVous(dossierId, rdvId, v) : actions.planifierRendezVous(dossierId, v)));
        if (res.ok) {
          if (!rdvId) setCle((k) => k + 1);
          onFini?.();
        }
      }}
    >
      {retour}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${p}-type`} className={classeLibelle}>Type</label>
          <select id={`${p}-type`} name="type" required defaultValue={initial?.type ?? 'visite_site'} className={classeChamp}>
            {RDV_TYPE_CODES.map((t) => <option key={t} value={t}>{RDV_TYPES[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${p}-duree`} className={classeLibelle}>Durée (min)</label>
          <input id={`${p}-duree`} name="dureeMinutes" type="number" min={15} max={600} step={15} required defaultValue={initial?.dureeMinutes ?? 60} className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`${p}-jour`} className={classeLibelle}>Date</label>
          <input id={`${p}-jour`} name="jour" type="date" required defaultValue={initial?.jour} className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`${p}-heure`} className={classeLibelle}>Heure (Douala)</label>
          <input id={`${p}-heure`} name="heure" type="time" required step={300} defaultValue={initial?.heure} className={classeChamp} />
        </div>
      </div>
      <div>
        <label htmlFor={`${p}-lieu`} className={classeLibelle}>Lieu ou lien</label>
        <input id={`${p}-lieu`} name="lieu" maxLength={300} defaultValue={initial?.lieu} placeholder="Adresse, point de repère ou lien visio" className={classeChamp} />
      </div>
      {autres.length > 0 && (
        <fieldset>
          <legend className={classeLibelle}>Autres participants</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {autres.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm text-ink-700">
                <input type="checkbox" name="participants" value={c.id} defaultChecked={initial?.participants.includes(c.id)} className="h-4 w-4 rounded border-ink-300" />
                {c.nom}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
        {rdvId ? 'Enregistrer les modifications' : 'Planifier le rendez-vous'}
      </button>
    </form>
  );
}

/** Actions sur un rendez-vous prévu : replanifier, clôturer (fait / non honoré / annulé). */
export function ActionsRdv({ dossierId, rdvId, passe, initial, collaborateurs, referentId }: { dossierId: number; rdvId: number; passe: boolean; initial: ValeursRdv; collaborateurs: { id: string; nom: string }[]; referentId: string | null }) {
  const { lancer, envoi, retour } = useAction();
  const [mode, setMode] = useState<'aucun' | 'modifier' | 'cloturer'>('aucun');
  const [statut, setStatut] = useState<Exclude<RdvStatut, 'prevu'>>(passe ? 'fait' : 'annule');
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode(mode === 'modifier' ? 'aucun' : 'modifier')} className={classeBouton('secondaire')}>Replanifier</button>
        <button type="button" onClick={() => setMode(mode === 'cloturer' ? 'aucun' : 'cloturer')} className={classeBouton('secondaire')}>Clôturer</button>
      </div>
      {mode === 'modifier' && <FormulaireRdv dossierId={dossierId} rdvId={rdvId} initial={initial} collaborateurs={collaborateurs} referentId={referentId} onFini={() => setMode('aucun')} />}
      {mode === 'cloturer' && (
        <form className="space-y-2" action={async (f) => void (await lancer(() => actions.cloturerRendezVous(dossierId, rdvId, statut, String(f.get('compteRendu') ?? ''))))}>
          {retour}
          <label htmlFor={`cr-statut-${rdvId}`} className={classeLibelle}>Issue</label>
          <select id={`cr-statut-${rdvId}`} value={statut} onChange={(e) => setStatut(e.target.value as Exclude<RdvStatut, 'prevu'>)} className={classeChamp}>
            {passe && <option value="fait">Fait</option>}
            {passe && <option value="non_honore">Non honoré</option>}
            <option value="annule">Annulé</option>
          </select>
          <label htmlFor={`cr-texte-${rdvId}`} className={classeLibelle}>Compte rendu {statut === 'fait' ? '(obligatoire)' : '(facultatif)'}</label>
          <textarea id={`cr-texte-${rdvId}`} name="compteRendu" rows={3} required={statut === 'fait'} maxLength={3000} className={classeChamp} />
          <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Clôturer le rendez-vous</button>
        </form>
      )}
    </div>
  );
}
