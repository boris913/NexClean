'use client';
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

export interface OptionReferent {
  id: string;
  nom: string;
  charge: number;
  raisons: string[];
}

function Choix({ id, options, valeur, onChange }: { id: string; options: OptionReferent[]; valeur: string; onChange: (v: string) => void }) {
  const choisi = options.find((o) => o.id === valeur);
  return (
    <>
      <select id={id} required value={valeur} onChange={(e) => onChange(e.target.value)} className={classeChamp}>
        <option value="">Choisir un référent…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nom} · {o.charge} ouvert{o.charge > 1 ? 's' : ''}
            {o.raisons.length ? ' · non éligible' : ''}
          </option>
        ))}
      </select>
      {choisi && choisi.raisons.length > 0 && <p className="text-xs text-amber-700 mt-1">Attention : {choisi.raisons.join(', ')}.</p>}
    </>
  );
}

export function Attribuer({ dossierId, options }: { dossierId: number; options: OptionReferent[] }) {
  const [cible, setCible] = useState('');
  const [motif, setMotif] = useState('');
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 mt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        setR(await actions.attribuer(dossierId, cible, motif));
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor={`cible-${dossierId}`} className="sr-only">
          Référent
        </label>
        <Choix id={`cible-${dossierId}`} options={options} valeur={cible} onChange={setCible} />
      </div>
      <div>
        <label htmlFor={`motif-${dossierId}`} className="sr-only">
          Motif
        </label>
        <input id={`motif-${dossierId}`} required minLength={3} placeholder="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
      </div>
      <button type="submit" disabled={envoi || !cible} className={classeBouton('principal')}>
        Attribuer
      </button>
      {r && <div className="sm:col-span-3">{r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>}</div>}
    </form>
  );
}

export function ReaffectationMasse({ dossiers, options }: { dossiers: { id: number; libelle: string }[]; options: OptionReferent[] }) {
  const [choisis, setChoisis] = useState<number[]>(dossiers.map((d) => d.id));
  const [cible, setCible] = useState('');
  const [motif, setMotif] = useState('');
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        setR(await actions.reaffecterSelection(choisis, cible, motif));
        setEnvoi(false);
      }}
    >
      <ul className="space-y-1">
        {dossiers.map((d) => (
          <li key={d.id}>
            <label className="flex items-center gap-3 min-h-11 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={choisis.includes(d.id)}
                onChange={(e) => setChoisis((x) => (e.target.checked ? [...x, d.id] : x.filter((y) => y !== d.id)))}
              />
              {d.libelle}
            </label>
          </li>
        ))}
      </ul>
      <div>
        <label htmlFor="cible-masse" className={classeLibelle}>
          Confier à
        </label>
        <Choix id="cible-masse" options={options} valeur={cible} onChange={setCible} />
      </div>
      <div>
        <label htmlFor="motif-masse" className={classeLibelle}>
          Motif commun (obligatoire)
        </label>
        <input id="motif-masse" required minLength={3} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
      </div>
      {r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
      <button type="submit" disabled={envoi || !cible || !choisis.length} className={classeBouton('principal', true)}>
        Réaffecter {choisis.length} dossier{choisis.length > 1 ? 's' : ''}
      </button>
    </form>
  );
}
