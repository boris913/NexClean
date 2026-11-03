'use client';
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { convertirSaisie } from '../actions';

type Props = {
  villeId: number;
  saisie: string;
  quartiers: { id: number; nom: string; arrondissementId: number | null }[];
  arrondissements: { id: number; nom: string }[];
  /** Appelé après un rattachement réussi (la carte disparaît ensuite au rafraîchissement). */
  onFait: (message: string) => void;
};

/** Rattachement d'une saisie : quartier existant ou nouveau quartier (M1-GEO-04). */
export default function Conversion({ villeId, saisie, quartiers, arrondissements, onFait }: Props) {
  const [mode, setMode] = useState<'existant' | 'nouveau'>('existant');
  const [resultat, setResultat] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const nomArr = (id: number | null) => arrondissements.find((a) => a.id === id)?.nom;

  return (
    <form
      className="space-y-3"
      action={async (f) => {
        setEnvoi(true);
        const arr = String(f.get('arrondissementId') ?? '');
        const r = await convertirSaisie(
          mode === 'existant'
            ? { villeId, saisie, quartierId: Number(f.get('quartierId')) || null }
            : { villeId, saisie, nouveau: { nom: String(f.get('nom') ?? ''), arrondissementId: arr ? Number(arr) : null } },
        );
        setResultat(r);
        if (r.ok) onFait(r.message ?? 'Dossiers rattachés.');
        setEnvoi(false);
      }}
    >
      {resultat && !resultat.ok && <Alerte>{resultat.erreur}</Alerte>}
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 py-1 cursor-pointer">
          <input type="radio" name="mode" checked={mode === 'existant'} onChange={() => setMode('existant')} className="w-4 h-4" />
          Quartier existant
        </label>
        <label className="flex items-center gap-2 py-1 cursor-pointer">
          <input type="radio" name="mode" checked={mode === 'nouveau'} onChange={() => setMode('nouveau')} className="w-4 h-4" />
          Nouveau quartier
        </label>
      </div>
      {mode === 'existant' ? (
        <div>
          <label htmlFor={`q-${villeId}-${saisie}`} className={classeLibelle}>Quartier du référentiel</label>
          <select id={`q-${villeId}-${saisie}`} name="quartierId" required defaultValue="" className={classeChamp}>
            <option value="" disabled>Choisir…</option>
            {quartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
                {nomArr(q.arrondissementId) ? ` (${nomArr(q.arrondissementId)})` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`n-${villeId}-${saisie}`} className={classeLibelle}>Nom du quartier</label>
            <input id={`n-${villeId}-${saisie}`} name="nom" required minLength={2} maxLength={80} defaultValue={saisie} className={classeChamp} />
          </div>
          <div>
            <label htmlFor={`a-${villeId}-${saisie}`} className={classeLibelle}>Arrondissement</label>
            <select id={`a-${villeId}-${saisie}`} name="arrondissementId" defaultValue="" className={classeChamp}>
              <option value="">Non rattaché pour l’instant</option>
              {arrondissements.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <button type="submit" disabled={envoi} className={classeBouton('principal')}>
        {envoi ? 'Rattachement…' : 'Rattacher les dossiers'}
      </button>
    </form>
  );
}
