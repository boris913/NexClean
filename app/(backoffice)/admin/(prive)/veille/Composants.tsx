'use client';
// COM4-01 : formulaires de l'écran Veille. RG-08 : aucun envoi WhatsApp vers une piste ; le
// collaborateur copie le message et le publie lui-même sur le canal d'origine.
import { useState } from 'react';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { CANAUX_CONTACT, MOTIFS_ECART, messageAvecLien, type CanalContact, type MotifEcart } from '@/lib/veille/domaine';
import * as actions from './actions';

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

export function AjouterPiste({ iaConfiguree }: { iaConfiguree: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (!ouvert)
    return (
      <div className="space-y-2">
        <Retour r={r} />
        <button type="button" className={classeBouton('principal')} onClick={() => setOuvert(true)}>
          + Ajouter une piste
        </button>
      </div>
    );
  return (
    <Carte titre="Ajouter une piste" description="Collez le lien et le texte d’une publication (Facebook, TikTok, groupe, LinkedIn, site d’annonces). Rien n’est collecté automatiquement sur ces plateformes.">
      <form
        className="space-y-3"
        action={async (f) => {
          setEnvoi(true);
          const res = await actions.ajouter(String(f.get('url') ?? ''), String(f.get('texte') ?? ''));
          setEnvoi(false);
          setR(res);
          if (res.ok) setOuvert(false);
        }}
      >
        <Retour r={r} />
        {!iaConfiguree && <Alerte type="info">La clé de l’API IA n’est pas configurée : la piste sera enregistrée sans qualification automatique.</Alerte>}
        <div>
          <label htmlFor="piste-url" className={classeLibelle}>Lien de la publication (facultatif)</label>
          <input id="piste-url" name="url" type="url" inputMode="url" placeholder="https://…" className={classeChamp} />
        </div>
        <div>
          <label htmlFor="piste-texte" className={classeLibelle}>Texte de la publication</label>
          <textarea id="piste-texte" name="texte" required minLength={20} rows={6} placeholder="Cherche gardien de nuit pour villa à Bastos, sérieux et disponible rapidement…" className={classeChamp} />
        </div>
        <div className="flex gap-2">
          <button type="button" className={classeBouton('secondaire')} onClick={() => setOuvert(false)}>Annuler</button>
          <button type="submit" disabled={envoi} className={`${classeBouton('principal')} flex-1`}>{envoi ? 'Analyse…' : 'Analyser et ajouter'}</button>
        </div>
      </form>
    </Carte>
  );
}

export function ActionsPiste({ piste, iaConfiguree }: { piste: { id: number; reference: string; statut: string; message: string | null; canalDefaut: CanalContact; relance: { ok: boolean; raison?: string } }; iaConfiguree: boolean }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [mode, setMode] = useState<'aucun' | 'ecarter' | 'contacter'>('aucun');
  const [canal, setCanal] = useState<CanalContact>(piste.canalDefaut);
  const [texte, setTexte] = useState(piste.message ?? '');
  const [copie, setCopie] = useState(false);
  const lancer = async (f: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    setR(await f());
    setEnvoi(false);
  };
  const complet = texte.trim() ? messageAvecLien(texte, piste.reference) : '';
  const contactable = piste.statut === 'retenue' || ((piste.statut === 'contactee' || piste.statut === 'en_conversation') && piste.relance.ok);

  return (
    <div className="space-y-2">
      <Retour r={r} />
      <div className="flex flex-wrap gap-2">
        {(piste.statut === 'nouvelle' || piste.statut === 'sans_suite') && (
          <button type="button" disabled={envoi} className={classeBouton('principal')} onClick={() => lancer(() => actions.changerStatut(piste.id, 'retenue'))}>
            Retenir
          </button>
        )}
        {(piste.statut === 'nouvelle' || piste.statut === 'retenue') && (
          <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => setMode(mode === 'ecarter' ? 'aucun' : 'ecarter')}>
            Écarter
          </button>
        )}
        {piste.statut === 'ecartee' && (
          <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => lancer(() => actions.changerStatut(piste.id, 'nouvelle'))}>
            Rétablir
          </button>
        )}
        {contactable && (
          <button type="button" disabled={envoi} className={classeBouton(piste.statut === 'retenue' ? 'principal' : 'secondaire')} onClick={() => setMode(mode === 'contacter' ? 'aucun' : 'contacter')}>
            {piste.statut === 'retenue' ? 'Préparer le contact' : 'Relancer'}
          </button>
        )}
        {(piste.statut === 'contactee' || piste.statut === 'en_conversation') && (
          <>
            {piste.statut === 'contactee' && (
              <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => lancer(() => actions.changerStatut(piste.id, 'en_conversation'))}>
                A répondu
              </button>
            )}
            <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => lancer(() => actions.changerStatut(piste.id, 'sans_suite'))}>
              Sans suite
            </button>
          </>
        )}
      </div>
      {(piste.statut === 'contactee' || piste.statut === 'en_conversation') && !piste.relance.ok && piste.relance.raison && <p className="text-xs text-ink-500">{piste.relance.raison}</p>}

      {mode === 'ecarter' && (
        <form
          className="flex flex-wrap items-end gap-2"
          action={async (f) => {
            await lancer(() => actions.changerStatut(piste.id, 'ecartee', String(f.get('motif')) as MotifEcart));
            setMode('aucun');
          }}
        >
          <div>
            <label htmlFor={`motif-${piste.id}`} className={classeLibelle}>Motif</label>
            <select id={`motif-${piste.id}`} name="motif" className={classeChamp} defaultValue="hors_services">
              {Object.entries(MOTIFS_ECART).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button type="submit" disabled={envoi} className={classeBouton('principal')}>Confirmer</button>
        </form>
      )}

      {mode === 'contacter' && (
        <div className="space-y-3 rounded-lg border border-ink-200 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`canal-${piste.id}`} className={classeLibelle}>Canal d’origine</label>
              <select id={`canal-${piste.id}`} value={canal} onChange={(e) => setCanal(e.target.value as CanalContact)} className={classeChamp}>
                {Object.entries(CANAUX_CONTACT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {iaConfiguree && (
              <button
                type="button"
                disabled={envoi}
                className={classeBouton('secondaire')}
                onClick={async () => {
                  setEnvoi(true);
                  const res = await actions.rediger(piste.id, canal);
                  setEnvoi(false);
                  setR(res);
                }}
              >
                {envoi ? 'Rédaction…' : 'Proposer un message'}
              </button>
            )}
          </div>
          <div>
            <label htmlFor={`texte-${piste.id}`} className={classeLibelle}>Message (le lien WhatsApp avec la référence {piste.reference} est ajouté à la fin)</label>
            <textarea id={`texte-${piste.id}`} rows={5} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} placeholder={piste.message ?? 'Bonjour, …'} />
            {piste.message && piste.message !== texte && (
              <button type="button" className="mt-1 text-xs text-primary" onClick={() => setTexte(piste.message!)}>
                Reprendre le message proposé
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!complet}
              className={classeBouton('secondaire')}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(complet);
                  setCopie(true);
                  setTimeout(() => setCopie(false), 2000);
                } catch {
                  setR({ ok: false, erreur: 'Copie impossible : sélectionnez le texte à la main.' });
                }
              }}
            >
              {copie ? 'Copié ✓' : '1. Copier le message'}
            </button>
            <button type="button" disabled={envoi || !texte.trim()} className={classeBouton('principal')} onClick={() => lancer(() => actions.enregistrerMessage(piste.id, texte))}>
              Enregistrer le brouillon
            </button>
            <button
              type="button"
              disabled={envoi || !complet}
              className={classeBouton('principal')}
              onClick={async () => {
                if (!window.confirm(`Confirmez-vous avoir envoyé ce message vous-même (${CANAUX_CONTACT[canal]}) ?`)) return;
                await lancer(() => actions.marquerContactee(piste.id, canal, complet));
                setMode('aucun');
              }}
            >
              2. Marquer contactée
            </button>
          </div>
          <p className="text-xs text-ink-500">Publiez ou envoyez le message vous-même sur le canal d’origine. Aucun premier message WhatsApp n’est envoyé à une piste : c’est le prospect qui écrit, via le lien.</p>
        </div>
      )}
    </div>
  );
}
