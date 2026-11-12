'use client';
import { useState } from 'react';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

const MODES = [
  { code: 'desactive', titre: 'Désactivé', aide: 'Les réponses automatiques simples (accusé, mots-clés) restent actives.' },
  { code: 'fantome', titre: 'Fantôme', aide: 'L’agent rédige ses réponses sans les envoyer ; comparez-les aux réponses réelles ci-dessous.' },
  { code: 'hors_heures', titre: 'Hors heures', aide: 'L’agent répond seul la nuit, le dimanche et les jours fermés.' },
  { code: 'permanent', titre: 'Permanent', aide: 'L’agent répond toujours en premier et passe la main au bon moment.' },
] as const;
type Mode = (typeof MODES)[number]['code'];

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

export function ModeAgent({ mode, iaConfiguree, evaluee }: { mode: Mode; iaConfiguree: boolean; evaluee: boolean }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [choix, setChoix] = useState<Mode>(mode);
  const [envoi, setEnvoi] = useState(false);
  return (
    <Carte titre="Mise en service" description="Passer d’un mode au suivant est une décision de la Direction, journalisée. Évaluez l’agent avant chaque passage.">
      <div className="space-y-3">
        <Retour r={r} />
        {!iaConfiguree && <Alerte type="info">La clé de l’API IA n’est pas configurée : l’agent reste inactif quel que soit le mode.</Alerte>}
        {!evaluee && <p className="text-sm text-ink-600">Les modes « Hors heures » et « Permanent » exigent une évaluation réussie avec le prompt, la base de connaissances et le modèle en vigueur.</p>}
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Mode de l’agent</legend>
          {MODES.map((m) => {
            const bloque = !evaluee && (m.code === 'hors_heures' || m.code === 'permanent') && m.code !== mode;
            return (
            <label key={m.code} className={`flex gap-2 rounded-lg border p-3 text-sm ${bloque ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${choix === m.code ? 'border-primary bg-brand-50' : 'border-ink-200'}`}>
              <input type="radio" name="mode" value={m.code} checked={choix === m.code} disabled={bloque} onChange={() => setChoix(m.code)} className="mt-0.5 accent-primary" />
              <span>
                <span className="block font-semibold text-ink-900">{m.titre}</span>
                <span className="text-ink-600">{m.aide}</span>
              </span>
            </label>
            );
          })}
        </fieldset>
        <button
          type="button"
          disabled={envoi || choix === mode}
          onClick={async () => {
            if (!window.confirm(`Passer l’agent en mode « ${MODES.find((m) => m.code === choix)!.titre} » ?`)) return;
            setEnvoi(true);
            setR(await actions.definirMode(choix));
            setEnvoi(false);
          }}
          className={classeBouton('principal')}
        >
          Appliquer le mode
        </button>
      </div>
    </Carte>
  );
}

export function Fiche({ fiche }: { fiche: { id: number; titre: string; contenu: string; ordre: number; actif: boolean; version: number } | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert)
    return fiche ? (
      <Carte titre={fiche.titre} actions={<button className="min-h-11 px-2 text-sm text-primary" onClick={() => setOuvert(true)}>Modifier</button>}>
        <p className="mb-1 text-xs text-ink-500">Version {fiche.version}{!fiche.actif && ' · désactivée'}</p>
        <p className="whitespace-pre-wrap text-sm">{fiche.contenu}</p>
      </Carte>
    ) : (
      <button className={classeBouton('secondaire', true)} onClick={() => setOuvert(true)}>+ Nouvelle fiche</button>
    );
  return (
    <Carte titre={fiche ? `Modifier « ${fiche.titre} »` : 'Nouvelle fiche'}>
      <form
        className="space-y-3"
        action={async (f) => {
          setEnvoi(true);
          const res = await actions.enregistrerFiche(fiche?.id ?? null, { titre: String(f.get('titre')), contenu: String(f.get('contenu')), ordre: Number(f.get('ordre') || 0), actif: f.get('actif') === 'on' });
          setEnvoi(false);
          setR(res);
          if (res.ok) setOuvert(false);
        }}
      >
        <Retour r={r} />
        <div>
          <label htmlFor={`f-titre-${fiche?.id ?? 'n'}`} className={classeLibelle}>Titre</label>
          <input id={`f-titre-${fiche?.id ?? 'n'}`} name="titre" required defaultValue={fiche?.titre} placeholder="Déroulé d’un recrutement" className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`f-contenu-${fiche?.id ?? 'n'}`} className={classeLibelle}>Contenu (pas de prix : l’agent ne cite que l’estimation calculée)</label>
          <textarea id={`f-contenu-${fiche?.id ?? 'n'}`} name="contenu" required rows={6} defaultValue={fiche?.contenu} className={classeChamp} />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-24">
            <label htmlFor={`f-ordre-${fiche?.id ?? 'n'}`} className={classeLibelle}>Ordre</label>
            <input id={`f-ordre-${fiche?.id ?? 'n'}`} name="ordre" type="number" min={0} defaultValue={fiche?.ordre ?? 0} className={classeChamp} />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="actif" defaultChecked={fiche?.actif ?? true} className="h-5 w-5 accent-primary" /> Active
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

export function LancerEvaluation({ nbCas, enCours, iaConfiguree }: { nbCas: number; enCours: boolean; iaConfiguree: boolean }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <button
        type="button"
        disabled={envoi || enCours || !iaConfiguree}
        onClick={async () => {
          if (!window.confirm(`Jouer les ${nbCas} conversations du jeu d’évaluation avec le modèle en vigueur ? Les appels sont facturés par le fournisseur IA (quelques centaines d’appels).`)) return;
          setEnvoi(true);
          setR(await actions.lancerEvaluation());
          setEnvoi(false);
        }}
        className={classeBouton('principal')}
      >
        {enCours ? 'Évaluation en cours…' : 'Lancer l’évaluation'}
      </button>
    </div>
  );
}
