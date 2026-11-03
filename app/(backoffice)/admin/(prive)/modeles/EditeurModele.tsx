'use client';
import { useState } from 'react';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import { VARIABLES, variableInconnue } from '@/lib/modeles/variables';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

export interface Modele {
  id: number;
  nom: string;
  types: DossierType[];
  texte: string;
  actif: boolean;
}

export default function EditeurModele({ modele }: { modele: Modele | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState(modele?.nom ?? '');
  const [types, setTypes] = useState<DossierType[]>(modele?.types ?? []);
  const [texte, setTexte] = useState(modele?.texte ?? '');
  const [actif, setActif] = useState(modele?.actif ?? true);
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const inconnue = variableInconnue(texte);
  const prefixe = `m${modele?.id ?? 'nouveau'}`;

  if (!ouvert) {
    return modele ? (
      <Carte titre={modele.nom} actions={<button className="text-sm text-primary min-h-11 px-2" onClick={() => setOuvert(true)}>Modifier</button>}>
        <p className="text-xs text-ink-500 mb-1">
          {modele.types.length ? modele.types.map((t) => DOSSIER_TYPES[t]).join(', ') : 'Tous les types'}
          {!modele.actif && ' · désactivé'}
        </p>
        <p className="text-sm whitespace-pre-wrap">{modele.texte}</p>
      </Carte>
    ) : (
      <button className={classeBouton('secondaire', true)} onClick={() => setOuvert(true)}>
        + Nouveau modèle
      </button>
    );
  }

  return (
    <Carte titre={modele ? `Modifier « ${modele.nom} »` : 'Nouveau modèle'}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setEnvoi(true);
          const res = await actions.enregistrer(modele?.id ?? null, { nom, types, texte, actif, langue: 'fr' });
          setEnvoi(false);
          setR(res);
          if (res.ok) {
            setOuvert(false);
            if (!modele) {
              setNom('');
              setTexte('');
              setTypes([]);
            }
          }
        }}
      >
        {r && !r.ok && <Alerte>{r.erreur}</Alerte>}
        <div>
          <label htmlFor={`${prefixe}-nom`} className={classeLibelle}>Nom</label>
          <input id={`${prefixe}-nom`} required maxLength={80} value={nom} onChange={(e) => setNom(e.target.value)} className={classeChamp} />
        </div>
        <fieldset>
          <legend className={classeLibelle}>Types de dossier (aucun coché = tous)</legend>
          <div className="flex flex-wrap gap-x-4">
            {DOSSIER_TYPE_CODES.map((t) => (
              <label key={t} className="flex items-center gap-2 min-h-11 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={types.includes(t)} onChange={(e) => setTypes((x) => (e.target.checked ? [...x, t] : x.filter((y) => y !== t)))} />
                {DOSSIER_TYPES[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${prefixe}-texte`} className={classeLibelle}>Texte</label>
          <textarea id={`${prefixe}-texte`} required rows={7} maxLength={2000} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} />
          {inconnue !== null && <p className="text-xs text-red-700 mt-1">Variable inconnue : {inconnue}</p>}
          <details className="mt-1">
            <summary className="text-xs text-primary cursor-pointer py-1">Variables disponibles</summary>
            <ul className="text-xs text-ink-600 space-y-0.5">
              {Object.entries(VARIABLES).map(([v, libelle]) => (
                <li key={v}>
                  <button type="button" className="font-mono text-primary" onClick={() => setTexte((x) => `${x}{{${v}}}`)}>{`{{${v}}}`}</button> — {libelle}
                </li>
              ))}
            </ul>
          </details>
        </div>
        <label className="flex items-center gap-2 min-h-11 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Actif (proposé dans les dossiers)
        </label>
        <div className="flex gap-2">
          <button type="button" className={classeBouton('secondaire')} onClick={() => setOuvert(false)}>Annuler</button>
          <button type="submit" disabled={envoi} className={`${classeBouton('principal')} flex-1`}>Enregistrer</button>
        </div>
      </form>
    </Carte>
  );
}
