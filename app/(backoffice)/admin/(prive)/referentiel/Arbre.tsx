'use client';
import { useState } from 'react';
import type { lireReferentiel } from '@/lib/geo/service';
import { Alerte, Carte, classeBouton, classeChamp, Pastille, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

type Villes = Awaited<ReturnType<typeof lireReferentiel>>;
type Quartier = Villes[number]['arrondissements'][number]['quartiers'][number];

function Ajout({ placeholder, onAjout }: { placeholder: string; onAjout: (nom: string) => Promise<ResultatAction> }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  return (
    <div className="mt-2 space-y-2">
      <form
        className="flex gap-2"
        action={async (f) => {
          setR(await onAjout(String(f.get('nom') ?? '')));
        }}
      >
        <input name="nom" required minLength={2} placeholder={placeholder} aria-label={placeholder} className={classeChamp} />
        <button type="submit" className={classeBouton('secondaire')}>Ajouter</button>
      </form>
      {r && !r.ok && <Alerte>{r.erreur}</Alerte>}
    </div>
  );
}

function LigneQuartier({ q }: { q: Quartier }) {
  const [edition, setEdition] = useState(false);
  const [affiche, setAffiche] = useState(q.afficheSite);
  const [r, setR] = useState<ResultatAction | null>(null);
  return (
    <li className="py-1.5">
      {/* Sur mobile, les commandes passent à la ligne : le nom reste aligné sur la première. */}
      <div className="flex items-start justify-between gap-2">
        <span className={`pt-2 min-w-0 break-words ${q.actif ? '' : 'line-through text-ink-400'}`}>
          {q.nom} {q.latitude != null && <span className="text-xs text-ink-400">📍</span>}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-x-1 shrink-0 max-w-[65%]">
          <label className="text-xs text-ink-600 px-2 py-2 flex items-center gap-1.5 cursor-pointer" title="Afficher dans « Où intervenons-nous ? » sur le site public">
            <input
              type="checkbox"
              checked={affiche}
              disabled={!q.actif}
              onChange={async (e) => {
                // Mise à jour immédiate de la case ; retour à l'état précédent si l'enregistrement échoue.
                const voulu = e.target.checked;
                setAffiche(voulu);
                const res = await actions.modifier('quartier', q.id, { afficheSite: voulu });
                if (!res.ok) setAffiche(!voulu);
                setR(res);
              }}
              className="w-4 h-4 accent-primary"
            />
            Sur le site
          </label>
          <button type="button" className="text-xs text-primary px-2 py-2" onClick={() => setEdition((e) => !e)}>Modifier</button>
          <button type="button" className="text-xs text-ink-600 px-2 py-2" onClick={async () => setR(await actions.modifier('quartier', q.id, { actif: !q.actif }))}>
            {q.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </span>
      </div>
      {r && !r.ok && <Alerte>{r.erreur}</Alerte>}
      {edition && (
        <form
          className="grid grid-cols-2 gap-2 mt-1"
          action={async (f) => {
            const num = (k: string) => (String(f.get(k) ?? '').trim() === '' ? null : Number(String(f.get(k)).replace(',', '.')));
            const res = await actions.modifier('quartier', q.id, { nom: String(f.get('nom') ?? ''), latitude: num('lat'), longitude: num('lng') });
            setR(res);
            if (res.ok) setEdition(false);
          }}
        >
          <input name="nom" defaultValue={q.nom} required aria-label="Nom" className={`${classeChamp} col-span-2`} />
          <input name="lat" defaultValue={q.latitude ?? ''} inputMode="decimal" placeholder="Latitude (ex. 4.05)" aria-label="Latitude" className={classeChamp} />
          <input name="lng" defaultValue={q.longitude ?? ''} inputMode="decimal" placeholder="Longitude (ex. 9.70)" aria-label="Longitude" className={classeChamp} />
          <button type="submit" className={`${classeBouton()} col-span-2`}>Enregistrer</button>
        </form>
      )}
    </li>
  );
}

export default function Arbre({ villes }: { villes: Villes }) {
  const [retour, setRetour] = useState<ResultatAction | null>(null);
  const suivre = async (p: Promise<ResultatAction>) => setRetour(await p);

  return (
    <div className="space-y-4">
      {retour && (retour.ok ? <Alerte type="succes">{retour.message}</Alerte> : <Alerte>{retour.erreur}</Alerte>)}
      {villes.map((v) => (
        <Carte
          key={v.id}
          titre={v.nom}
          actions={
            <div className="flex items-center gap-2">
              {v.couverte ? <Pastille ton="vert">Couverte</Pastille> : <Pastille>Non couverte</Pastille>}
              {!v.actif && <Pastille ton="rouge">Inactive</Pastille>}
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" className={classeBouton('secondaire')} onClick={() => suivre(actions.modifier('ville', v.id, { couverte: !v.couverte }))}>
              {v.couverte ? 'Marquer non couverte' : 'Marquer couverte'}
            </button>
            <button type="button" className={classeBouton('secondaire')} onClick={() => suivre(actions.modifier('ville', v.id, { actif: !v.actif }))}>
              {v.actif ? 'Désactiver la ville' : 'Réactiver la ville'}
            </button>
          </div>
          <div className="space-y-2">
            {v.arrondissements.map((a) => (
              <details key={a.id} className="border border-ink-100 rounded-lg px-3">
                <summary className="cursor-pointer py-3 font-medium flex justify-between">
                  <span className={a.actif ? '' : 'line-through text-ink-400'}>{a.nom}</span>
                  <span className="text-xs text-ink-500">{a.quartiers.length} quartier(s)</span>
                </summary>
                <ul className="divide-y divide-ink-50 text-sm">
                  {a.quartiers.map((q) => (
                    <LigneQuartier key={q.id} q={q} />
                  ))}
                </ul>
                <Ajout placeholder="Nouveau quartier" onAjout={(nom) => actions.ajouterQuartier(v.id, a.id, nom).then((r) => (setRetour(r), r))} />
                <button type="button" className="text-xs text-ink-600 py-3" onClick={() => suivre(actions.modifier('arrondissement', a.id, { actif: !a.actif }))}>
                  {a.actif ? 'Désactiver l’arrondissement' : 'Réactiver l’arrondissement'}
                </button>
              </details>
            ))}
            {v.quartiersNonRattaches.length > 0 && (
              <details className="border border-amber-200 rounded-lg px-3">
                <summary className="cursor-pointer py-3 font-medium">Quartiers sans arrondissement ({v.quartiersNonRattaches.length})</summary>
                <ul className="text-sm">
                  {v.quartiersNonRattaches.map((q) => (
                    <LigneQuartier key={q.id} q={q} />
                  ))}
                </ul>
              </details>
            )}
          </div>
          <Ajout placeholder="Nouvel arrondissement" onAjout={(nom) => actions.ajouterArrondissement(v.id, nom).then((r) => (setRetour(r), r))} />
        </Carte>
      ))}
      <Carte titre="Nouvelle ville">
        <Ajout placeholder="Nom de la ville" onAjout={(nom) => actions.ajouterVille(nom, false).then((r) => (setRetour(r), r))} />
      </Carte>
    </div>
  );
}
