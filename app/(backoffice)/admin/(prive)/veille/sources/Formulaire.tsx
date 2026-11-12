'use client';
import { useState } from 'react';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { TYPES_AUTOMATISES, TYPES_SOURCE, type TypeSource } from '@/lib/veille/domaine';
import * as actions from './actions';

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

interface Source {
  id: number;
  nom: string;
  type: TypeSource;
  url: string | null;
  requetes: string[];
  frequenceHeures: number;
  actif: boolean;
}

export function FormulaireSource({ source }: { source: Source | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [type, setType] = useState<TypeSource>(source?.type ?? 'rss');
  const cle = source?.id ?? 'n';
  if (!ouvert)
    return source ? (
      <button className="min-h-11 px-2 text-sm text-primary" onClick={() => setOuvert(true)}>Modifier</button>
    ) : (
      <div className="space-y-2">
        <Retour r={r} />
        <button className={classeBouton('principal')} onClick={() => setOuvert(true)}>+ Nouvelle source</button>
      </div>
    );
  return (
    <Carte titre={source ? `Modifier « ${source.nom} »` : 'Nouvelle source'}>
      <form
        className="space-y-3"
        action={async (f) => {
          setEnvoi(true);
          const res = await actions.enregistrer(source?.id ?? null, {
            nom: String(f.get('nom')),
            type,
            url: String(f.get('url') ?? ''),
            requetes: String(f.get('requetes') ?? '')
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean),
            frequenceHeures: Number(f.get('frequence') || 12),
            actif: f.get('actif') === 'on',
          });
          setEnvoi(false);
          setR(res);
          if (res.ok) setOuvert(false);
        }}
      >
        <Retour r={r} />
        <div>
          <label htmlFor={`s-nom-${cle}`} className={classeLibelle}>Nom</label>
          <input id={`s-nom-${cle}`} name="nom" required defaultValue={source?.nom} placeholder="Annonces emploi Douala (flux RSS)" className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`s-type-${cle}`} className={classeLibelle}>Type</label>
          <select id={`s-type-${cle}`} value={type} onChange={(e) => setType(e.target.value as TypeSource)} className={classeChamp}>
            {Object.entries(TYPES_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <p className={classeAide}>
            {TYPES_AUTOMATISES.includes(type)
              ? 'Collecte automatique depuis un flux public RSS / Atom. Vérifiez que les conditions du site l’autorisent.'
              : type === 'api_recherche'
                ? 'Non automatisée : une API de recherche payante ne sera branchée qu’avec l’accord de la Direction. Sert au suivi des requêtes.'
                : 'Pas de collecte automatique (Facebook, TikTok, groupes, LinkedIn) : les pistes sont ajoutées à la main sur l’écran Veille.'}
          </p>
        </div>
        <div>
          <label htmlFor={`s-url-${cle}`} className={classeLibelle}>Adresse du flux {TYPES_AUTOMATISES.includes(type) ? '' : '(facultatif)'}</label>
          <input id={`s-url-${cle}`} name="url" type="url" defaultValue={source?.url ?? ''} placeholder="https://…/rss" className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`s-req-${cle}`} className={classeLibelle}>Requêtes (une par ligne)</label>
          <textarea id={`s-req-${cle}`} name="requetes" rows={4} defaultValue={source?.requetes.join('\n')} placeholder={'femme de ménage Douala\nagent de sécurité Yaoundé'} className={classeChamp} />
          <p className={classeAide}>Un élément du flux est retenu s’il contient tous les mots significatifs d’une requête. Sans requête, tout le flux est analysé.</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label htmlFor={`s-freq-${cle}`} className={classeLibelle}>Fréquence (heures)</label>
            <input id={`s-freq-${cle}`} name="frequence" type="number" min={1} max={168} defaultValue={source?.frequenceHeures ?? 12} className={classeChamp} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="actif" defaultChecked={source?.actif ?? true} className="h-5 w-5 accent-primary" /> Active
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" className={classeBouton('secondaire')} onClick={() => setOuvert(false)}>Annuler</button>
          <button type="submit" disabled={envoi} className={`${classeBouton('principal')} flex-1`}>Enregistrer</button>
        </div>
      </form>
    </Carte>
  );
}

export function CollecterMaintenant({ id }: { id: number }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={envoi}
        className={classeBouton('secondaire')}
        onClick={async () => {
          if (!window.confirm('Lancer la collecte maintenant ? Chaque nouvel élément est analysé par l’IA (appels facturés).')) return;
          setEnvoi(true);
          setR(await actions.collecterMaintenant(id));
          setEnvoi(false);
        }}
      >
        {envoi ? 'Collecte…' : 'Collecter maintenant'}
      </button>
      <Retour r={r} />
    </div>
  );
}
