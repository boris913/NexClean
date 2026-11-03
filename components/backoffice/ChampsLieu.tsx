'use client';
// Ville → Quartier en cascade, avec « Autre » en saisie libre (ADR 0021, M1-GEO).
import { useState } from 'react';
import type { ListesLieux } from '@/lib/geo/service';
import { classeChamp, classeLibelle } from './ui';

export interface ValeurLieu {
  villeId: number | null;
  villeAutre: string | null;
  quartierId: number | null;
  quartierAutre: string | null;
}

export default function ChampsLieu({ listes, valeur, onChange }: { listes: ListesLieux; valeur: ValeurLieu; onChange: (v: ValeurLieu) => void }) {
  const [autreVille, setAutreVille] = useState(valeur.villeId === null && !!valeur.villeAutre);
  const [autreQuartier, setAutreQuartier] = useState(valeur.quartierId === null && !!valeur.quartierAutre);
  const ville = listes.find((v) => v.id === valeur.villeId);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor="ville" className={classeLibelle}>Ville</label>
        <select
          id="ville"
          value={autreVille ? 'autre' : (valeur.villeId ?? '')}
          className={classeChamp}
          onChange={(e) => {
            const v = e.target.value;
            setAutreVille(v === 'autre');
            setAutreQuartier(false);
            onChange({ villeId: v && v !== 'autre' ? Number(v) : null, villeAutre: null, quartierId: null, quartierAutre: null });
          }}
        >
          <option value="">Choisir…</option>
          {listes.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
          <option value="autre">Autre ville</option>
        </select>
        {autreVille && (
          <input aria-label="Nom de la ville" placeholder="Nom de la ville" className={`${classeChamp} mt-2`} value={valeur.villeAutre ?? ''} onChange={(e) => onChange({ ...valeur, villeAutre: e.target.value })} />
        )}
      </div>
      <div>
        <label htmlFor="quartier" className={classeLibelle}>Quartier</label>
        {ville && !autreQuartier ? (
          <select
            id="quartier"
            value={valeur.quartierId ?? ''}
            className={classeChamp}
            onChange={(e) => {
              if (e.target.value === 'autre') {
                setAutreQuartier(true);
                onChange({ ...valeur, quartierId: null });
              } else onChange({ ...valeur, quartierId: e.target.value ? Number(e.target.value) : null, quartierAutre: null });
            }}
          >
            <option value="">Choisir…</option>
            {ville.quartiers.map((q) => <option key={q.id} value={q.id}>{q.nom}</option>)}
            <option value="autre">Autre quartier</option>
          </select>
        ) : (
          <input id="quartier" placeholder="Quartier" className={classeChamp} value={valeur.quartierAutre ?? ''} onChange={(e) => onChange({ ...valeur, quartierId: null, quartierAutre: e.target.value })} />
        )}
      </div>
    </div>
  );
}
