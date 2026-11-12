'use client';
// COM2-02 RG-06..10 : textes et réglages des réponses automatiques WhatsApp.
import { useState } from 'react';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { enregistrerWhatsApp } from './actions';

export interface ValeursWhatsApp {
  accuseOuvert: string;
  accuseFerme: string;
  reponses: { mots: string[]; reponse: string }[];
  suspensionHeures: number;
  plafondMarketing: number;
}

/** « horaires, ouvert => Nos horaires : {horaires}. » — une règle par ligne. */
const versTexte = (r: ValeursWhatsApp['reponses']) => r.map((x) => `${x.mots.join(', ')} => ${x.reponse}`).join('\n');

export default function ParametresWhatsApp({ valeurs }: { valeurs: ValeursWhatsApp }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <Carte titre="WhatsApp : réponses automatiques" description="Accusé de réception, réponses aux questions fréquentes et garde-fous. Une réponse automatique n’annonce jamais de prix.">
      <form
        className="space-y-4"
        action={async (f) => {
          setEnvoi(true);
          setR(await enregistrerWhatsApp({ accuseOuvert: String(f.get('accuseOuvert')), accuseFerme: String(f.get('accuseFerme')), reponses: String(f.get('reponses')), suspensionHeures: Number(f.get('suspension')), plafondMarketing: Number(f.get('plafond')) }));
          setEnvoi(false);
        }}
      >
        {r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
        <div>
          <label htmlFor="wa-ouvert" className={classeLibelle}>Accusé de réception (heures ouvrées)</label>
          <textarea id="wa-ouvert" name="accuseOuvert" rows={3} defaultValue={valeurs.accuseOuvert} className={classeChamp} />
          <p className={classeAide}>Variables : {'{numero}'} (dossier), {'{horaires}'}.</p>
        </div>
        <div>
          <label htmlFor="wa-ferme" className={classeLibelle}>Accusé de réception (fermé)</label>
          <textarea id="wa-ferme" name="accuseFerme" rows={3} defaultValue={valeurs.accuseFerme} className={classeChamp} />
          <p className={classeAide}>Variables : {'{numero}'}, {'{ouverture}'} (« demain à 07:00 »), {'{horaires}'}.</p>
        </div>
        <div>
          <label htmlFor="wa-reponses" className={classeLibelle}>Réponses par mots-clés (une par ligne : mots, séparés par des virgules =&gt; réponse)</label>
          <textarea id="wa-reponses" name="reponses" rows={6} defaultValue={versTexte(valeurs.reponses)} className={`${classeChamp} font-mono text-xs`} />
          <p className={classeAide}>Variables : {'{horaires}'}, {'{zones}'}, {'{services}'}, {'{suivi}'} (lien de suivi du dossier), {'{numero}'}.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="wa-suspension" className={classeLibelle}>Pause après une réponse humaine (heures)</label>
            <input id="wa-suspension" name="suspension" type="number" min={0} max={168} defaultValue={valeurs.suspensionHeures} className={classeChamp} />
          </div>
          <div>
            <label htmlFor="wa-plafond" className={classeLibelle}>Messages promotionnels par client et par semaine</label>
            <input id="wa-plafond" name="plafond" type="number" min={0} max={14} defaultValue={valeurs.plafondMarketing} className={classeChamp} />
          </div>
        </div>
        <button type="submit" disabled={envoi} className={classeBouton('principal')}>Enregistrer</button>
      </form>
    </Carte>
  );
}
