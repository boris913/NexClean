'use client';
// MVP1-05 RG-06, RG-07, RG-11 : heures ouvrées (Africa/Douala), délai d'escalade, seuil « sans action ».
import { useState } from 'react';
import type { HeuresOuvrees } from '@/lib/parametres';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Affichage du lundi au dimanche.
const ORDRE = [1, 2, 3, 4, 5, 6, 0];

export default function ParametresAttribution({ heures, delai, jours }: { heures: HeuresOuvrees; delai: number; jours: number }) {
  const [h, setH] = useState(heures);
  const [d, setD] = useState(String(delai));
  const [j, setJ] = useState(String(jours));
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (i: number, v: { debut: string; fin: string } | null) => setH((x) => x.map((y, k) => (k === i ? v : y)));

  return (
    <Carte titre="Attribution et relances">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          setR(await actions.enregistrerAttribution(h, Number(d), Number(j)));
          setEnvoi(false);
        }}
      >
        <fieldset>
          <legend className={classeLibelle}>Heures ouvrées (heure de Douala)</legend>
          <ul className="space-y-2">
            {ORDRE.map((i) => {
              const p = h[i];
              return (
                <li key={i} className="grid grid-cols-[2.75rem_auto_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[6.5rem_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-sm">
                  <span>
                    <span className="sm:hidden" aria-hidden>{JOURS[i]!.slice(0, 3)}.</span>
                    <span className="sr-only sm:not-sr-only">{JOURS[i]}</span>
                  </span>
                  <label className="flex items-center gap-1.5 min-h-11">
                    <input type="checkbox" className="h-5 w-5 accent-primary" checked={!!p} onChange={(e) => maj(i, e.target.checked ? { debut: '08:00', fin: '17:00' } : null)} />
                    <span className="sr-only">{JOURS[i]} ouvré</span>
                  </label>
                  {p ? (
                    <>
                      <input type="time" aria-label={`${JOURS[i]} : début`} value={p.debut} onChange={(e) => maj(i, { ...p, debut: e.target.value })} className={`${classeChamp} min-w-0 !px-2`} />
                      <input type="time" aria-label={`${JOURS[i]} : fin`} value={p.fin} onChange={(e) => maj(i, { ...p, fin: e.target.value })} className={`${classeChamp} min-w-0 !px-2`} />
                    </>
                  ) : (
                    <span className="col-span-2 text-ink-500">Non ouvré</span>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="delai" className={classeLibelle}>Relance des non attribués après (heures ouvrées)</label>
            <input id="delai" type="number" inputMode="numeric" min={1} max={72} required value={d} onChange={(e) => setD(e.target.value)} className={classeChamp} />
          </div>
          <div>
            <label htmlFor="jours" className={classeLibelle}>Dossier « sans action » après (jours)</label>
            <input id="jours" type="number" inputMode="numeric" min={1} max={60} required value={j} onChange={(e) => setJ(e.target.value)} className={classeChamp} />
          </div>
        </div>
        <p className="text-xs text-ink-500">Après la première relance, la Direction est relancée chaque jour ouvré à 8 h tant que le dossier n’est pas attribué.</p>
        {r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
          Enregistrer
        </button>
      </form>
    </Carte>
  );
}
