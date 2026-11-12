'use client';
// COM2-02 RG-01..04, RG-08 : répondre depuis le Back-Office. Dans la fenêtre de 24 h : texte libre
// (avec insertion d'un modèle interne) ; au-delà : modèles approuvés par Meta uniquement.
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from '../actions';
import type { ResultatEnvoi } from '../actions';

function Retour({ r }: { r: ResultatEnvoi | ResultatAction | null }) {
  if (!r) return null;
  if (r.ok) return r.message ? <Alerte type="succes">{r.message}</Alerte> : null;
  const repli = 'repli' in r ? r.repli : undefined;
  return (
    <Alerte>
      {r.erreur}
      {repli && (
        <>
          {' '}
          <a href={repli} target="_blank" rel="noreferrer" className="font-medium underline">Envoyer depuis le téléphone (wa.me)</a>
        </>
      )}
    </Alerte>
  );
}

export default function Repondre({
  conversationId,
  fenetreOuverte,
  finFenetre,
  modelesInternes,
  modelesMeta,
  documents,
}: {
  conversationId: number;
  documents: { id: number; libelle: string; texte: string }[];
  fenetreOuverte: boolean;
  finFenetre: string | null;
  modelesInternes: { id: number; nom: string; texte: string }[];
  modelesMeta: { id: number; nom: string; categorie: string | null }[];
}) {
  const [texte, setTexte] = useState('');
  const [modeleMeta, setModeleMeta] = useState('');
  const [r, setR] = useState<ResultatEnvoi | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const lancer = async (fn: () => Promise<ResultatEnvoi>) => {
    setEnvoi(true);
    const res = await fn();
    setEnvoi(false);
    setR(res);
    return res;
  };

  return (
    <div className="space-y-3" id="repondre">
      <Retour r={r} />
      {fenetreOuverte ? (
        <form
          className="space-y-2"
          action={async () => {
            const res = await lancer(() => actions.envoyerTexte(conversationId, texte));
            if (res.ok) setTexte('');
          }}
        >
          {modelesInternes.length > 0 && (
            <select aria-label="Insérer un modèle" value="" onChange={(e) => setTexte(modelesInternes.find((m) => String(m.id) === e.target.value)?.texte ?? texte)} className={classeChamp}>
              <option value="">Insérer un modèle de message…</option>
              {modelesInternes.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          )}
          {documents.length > 0 && (
            <select aria-label="Joindre un document" value="" onChange={(e) => {
              const d = documents.find((x) => String(x.id) === e.target.value);
              if (d) setTexte((t) => (t.trim() ? `${t.trim()}

${d.texte}` : d.texte));
            }} className={classeChamp}>
              <option value="">Joindre un document (lien sécurisé vers l’espace de suivi)…</option>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.libelle}</option>)}
            </select>
          )}
          <label htmlFor="reponse" className="sr-only">Votre réponse</label>
          <textarea id="reponse" required rows={3} maxLength={4096} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Votre réponse au client…" className={classeChamp} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-500">Texte libre possible jusqu’au {finFenetre} (24 h après le dernier message du client).</p>
            <button type="submit" disabled={envoi || !texte.trim()} className={classeBouton('principal')}>Envoyer</button>
          </div>
        </form>
      ) : (
        <Alerte type="info">Le client n’a pas écrit depuis plus de 24 h : WhatsApp n’autorise que l’envoi d’un modèle approuvé par Meta.</Alerte>
      )}
      {modelesMeta.length > 0 ? (
        <form className="space-y-2" action={async () => void (await lancer(() => actions.envoyerModele(conversationId, Number(modeleMeta))))}>
          <label htmlFor="modele-meta" className={classeLibelle}>Modèle approuvé par Meta</label>
          <div className="flex gap-2">
            <select id="modele-meta" required value={modeleMeta} onChange={(e) => setModeleMeta(e.target.value)} className={classeChamp}>
              <option value="">Choisir…</option>
              {modelesMeta.map((m) => <option key={m.id} value={m.id}>{m.nom}{m.categorie === 'marketing' ? ' (promotionnel)' : ''}</option>)}
            </select>
            <button type="submit" disabled={envoi || !modeleMeta} className={classeBouton(fenetreOuverte ? 'secondaire' : 'principal')}>Envoyer le modèle</button>
          </div>
        </form>
      ) : (
        !fenetreOuverte && <p className="text-sm text-ink-600">Aucun modèle approuvé pour l’instant : créez-en un dans <a href="/admin/modeles" className="text-primary underline">Modèles</a> (nom du modèle Meta), puis faites-le approuver dans le WhatsApp Manager.</p>
      )}
    </div>
  );
}

export function Automate({ conversationId, mode, suspenduJusqua }: { conversationId: number; mode: 'actif' | 'manuel'; suspenduJusqua: string | null }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const basculer = async () => {
    setEnvoi(true);
    setR(await actions.changerAutomate(conversationId, mode === 'actif' ? 'manuel' : 'actif'));
    setEnvoi(false);
  };
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <p className="text-sm text-ink-700">
        {mode === 'manuel' ? 'Réponses automatiques arrêtées : vous avez repris la main.' : suspenduJusqua ? `Réponses automatiques en pause jusqu’au ${suspenduJusqua} (réponse humaine récente).` : 'Réponses automatiques actives (accusé de réception, réponses aux questions fréquentes).'}
      </p>
      <button type="button" onClick={basculer} disabled={envoi} className={classeBouton('secondaire')}>
        {mode === 'actif' ? 'Reprendre la main' : 'Rendre la main à l’automate'}
      </button>
    </div>
  );
}

export function Accord({ conversationId, numero, etat }: { conversationId: number; numero: string; etat: { accordLe: string | null; retireLe: string | null; formulation: string | null } }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const retire = !!etat.retireLe && (!etat.accordLe || etat.retireLe >= etat.accordLe);
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <p className="text-sm text-ink-700">
        {retire ? `Désinscrit des messages promotionnels (STOP) le ${new Date(etat.retireLe!).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}.` : etat.accordLe ? `Accord donné le ${new Date(etat.accordLe).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })} : « ${etat.formulation} ».` : 'Aucun accord pour les messages promotionnels.'}
      </p>
      <details>
        <summary className="cursor-pointer text-sm text-primary">Enregistrer un accord explicite</summary>
        <form
          className="mt-2 space-y-2"
          action={async (f) => {
            setEnvoi(true);
            setR(await actions.enregistrerAccord(conversationId, numero, String(f.get('formulation') ?? ''), String(f.get('canal') ?? 'whatsapp')));
            setEnvoi(false);
          }}
        >
          <label htmlFor="formulation" className={classeLibelle}>Formulation exacte de l’accord du client</label>
          <textarea id="formulation" name="formulation" required minLength={10} rows={2} placeholder="« Oui, je veux recevoir vos offres par WhatsApp »" className={classeChamp} />
          <label htmlFor="canal" className={classeLibelle}>Recueilli par</label>
          <select id="canal" name="canal" className={classeChamp} defaultValue="whatsapp">
            <option value="whatsapp">Message WhatsApp du client</option>
            <option value="telephone">Téléphone</option>
            <option value="formulaire">Formulaire</option>
            <option value="visite">Visite</option>
          </select>
          <button type="submit" disabled={envoi} className={classeBouton('secondaire')}>Enregistrer l’accord</button>
        </form>
      </details>
    </div>
  );
}
