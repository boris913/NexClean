'use client';
import { useState } from 'react';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { formaterFCFA } from '@/lib/dossiers/formulaire-personnel';
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

export default function Formulaires({ commission, metiers }: { commission: number; metiers: string[] }) {
  const [montant, setMontant] = useState(String(commission));
  const [liste, setListe] = useState(metiers.join('\n'));
  const c = useAction();
  const m = useAction();
  const n = Number(montant);

  return (
    <div className="space-y-4">
      <Carte titre="Commission de placement">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void c.lancer(() => actions.enregistrerCommission(n));
          }}
        >
          <div>
            <label htmlFor="commission" className={classeLibelle}>Commission par personne placée (FCFA)</label>
            <input id="commission" type="number" inputMode="numeric" min={0} step={1} required value={montant} onChange={(e) => setMontant(e.target.value)} className={classeChamp} />
            <p className="text-xs text-ink-500 mt-1">
              Sert à l’estimation affichée sur « Demander du personnel »{Number.isInteger(n) && n >= 0 ? ` : 10 personnes = ${formaterFCFA(10 * n)}` : ''}. Les demandes déjà reçues gardent l’estimation qui a été montrée.
            </p>
          </div>
          {c.r && (c.r.ok ? <Alerte type="succes">{c.r.message}</Alerte> : <Alerte>{c.r.erreur}</Alerte>)}
          <button type="submit" disabled={c.envoi} className={classeBouton('principal', true)}>Enregistrer la commission</button>
        </form>
      </Carte>

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
