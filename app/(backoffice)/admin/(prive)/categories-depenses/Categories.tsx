'use client';
// POST-03 RG-02 : ajout, renommage, ordre, désactivation et suppression (si jamais utilisée).
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, Pastille, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

export interface CategorieLigne {
  id: number;
  libelle: string;
  ordre: number;
  actif: boolean;
  depenses: number;
}

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

export function GestionCategories({ categories }: { categories: CategorieLigne[] }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    setR(await fn());
    setEnvoi(false);
  };

  return (
    <div className="space-y-4">
      <Retour r={r} />
      <form
        className="grid gap-3 sm:grid-cols-[1fr_8rem_auto]"
        action={async (f) => {
          await lancer(() => actions.creer({ libelle: String(f.get('libelle') ?? ''), ordre: Number(f.get('ordre') || 100) }));
        }}
      >
        <div>
          <label htmlFor="c-libelle" className={classeLibelle}>Nouvelle catégorie</label>
          <input id="c-libelle" name="libelle" required maxLength={80} placeholder="Formation" className={classeChamp} />
        </div>
        <div>
          <label htmlFor="c-ordre" className={classeLibelle}>Ordre</label>
          <input id="c-ordre" name="ordre" type="number" min={0} max={1000} defaultValue={100} className={classeChamp} />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={envoi} className={classeBouton()}>Ajouter</button>
        </div>
      </form>

      <ul className="-mx-1 divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 sm:mx-0">
        {categories.map((c) => (
          <li key={c.id} className="px-3 py-3 sm:px-4">
            <form
              className="flex flex-wrap items-end gap-2"
              action={async (f) => {
                await lancer(() => actions.modifier(c.id, { libelle: String(f.get('libelle') ?? ''), ordre: Number(f.get('ordre') || 0) }));
              }}
            >
              <div className="min-w-48 flex-1">
                <label htmlFor={`c-${c.id}`} className="sr-only">Libellé</label>
                <input id={`c-${c.id}`} name="libelle" required maxLength={80} defaultValue={c.libelle} className={classeChamp} />
              </div>
              <div className="w-24">
                <label htmlFor={`o-${c.id}`} className="sr-only">Ordre</label>
                <input id={`o-${c.id}`} name="ordre" type="number" min={0} max={1000} defaultValue={c.ordre} className={classeChamp} />
              </div>
              <button type="submit" disabled={envoi} className={classeBouton('secondaire')}>Enregistrer</button>
              <button type="button" disabled={envoi} className={classeBouton('fantome')} onClick={() => lancer(() => actions.activer(c.id, !c.actif))}>
                {c.actif ? 'Désactiver' : 'Réactiver'}
              </button>
              {c.depenses === 0 && (
                <button type="button" disabled={envoi} className={classeBouton('fantome')} onClick={() => window.confirm(`Supprimer la catégorie « ${c.libelle} » ?`) && lancer(() => actions.supprimer(c.id))}>
                  Supprimer
                </button>
              )}
              <span className="flex items-center gap-2 pb-2 text-xs text-ink-500">
                {!c.actif && <Pastille>Désactivée</Pastille>}
                {c.depenses} dépense{c.depenses > 1 ? 's' : ''}
              </span>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
