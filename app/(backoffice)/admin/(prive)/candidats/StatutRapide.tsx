'use client';
// RG-02 : fixer le statut d'un nouveau candidat sans quitter la file. Le candidat sort de la file
// dès que son statut quitte « Nouveau » (la page est revalidée par l'action).
import { useState } from 'react';
import type { StatutCandidat } from '@/lib/candidats/domaine';
import { Alerte, classeBouton, classeChamp, type ResultatAction } from '@/components/backoffice/ui';
import { traiterDepuisFile } from './actions';

export default function StatutRapide({ candidatId, nom, statut, options }: { candidatId: number; nom: string; statut: StatutCandidat; options: { code: StatutCandidat; libelle: string }[] }) {
  const [vers, setVers] = useState<StatutCandidat>(statut);
  const [envoi, setEnvoi] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const id = `statut-${candidatId}`;
  return (
    <form
      className="mt-3 pt-3 border-t border-ink-100 space-y-2"
      action={async () => {
        setEnvoi(true);
        setR(await traiterDepuisFile(candidatId, vers));
        setEnvoi(false);
      }}
    >
      {r && (r.ok ? r.message && <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Statut de {nom}
        </label>
        <select id={id} value={vers} onChange={(e) => setVers(e.target.value as StatutCandidat)} className={classeChamp}>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.libelle}
            </option>
          ))}
        </select>
        <button type="submit" disabled={envoi} className={`${classeBouton()} shrink-0`}>
          Valider
        </button>
      </div>
    </form>
  );
}
