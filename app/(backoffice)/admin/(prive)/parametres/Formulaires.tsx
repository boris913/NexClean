'use client';
import { useState } from 'react';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

function useAction() {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    setR(await fn());
    setEnvoi(false);
  };
  return { r, envoi, lancer };
}

export default function Formulaires({ metiers }: { metiers: string[] }) {
  const [liste, setListe] = useState(metiers.join('\n'));
  const m = useAction();

  return (
    <div className="space-y-4">
      <Carte titre="Métiers suggérés">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void m.lancer(() => actions.enregistrerMetiers(liste));
          }}
        >
          <div>
            <label htmlFor="metiers" className={classeLibelle}>Un métier par ligne</label>
            <textarea id="metiers" rows={12} value={liste} onChange={(e) => setListe(e.target.value)} className={classeChamp} />
            <p className="text-xs text-ink-500 mt-1">Proposés en suggestion dans le champ « Intitulé du poste » ; le client peut toujours saisir un autre intitulé.</p>
          </div>
          {m.r && (m.r.ok ? <Alerte type="succes">{m.r.message}</Alerte> : <Alerte>{m.r.erreur}</Alerte>)}
          <button type="submit" disabled={m.envoi} className={classeBouton('principal', true)}>Enregistrer les métiers</button>
        </form>
      </Carte>
    </div>
  );
}
