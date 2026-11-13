'use client';
// Lancement de l'inscription intégrée Meta (SDK JavaScript) et transmission du code au serveur.
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { Alerte, classeBouton } from '@/components/backoffice/ui';
import { lireSessionInscription, type ResultatRaccordement, type SessionInscription } from '@/lib/whatsapp/inscription-meta';
import { terminerRaccordement } from './actions';

interface ReponseConnexion {
  authResponse?: { code?: string } | null;
  status?: string;
}
interface SdkFacebook {
  init(o: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(cb: (r: ReponseConnexion) => void, o: Record<string, unknown>): void;
}
declare global {
  interface Window {
    FB?: SdkFacebook;
    fbAsyncInit?: () => void;
  }
}

const ATTENTE_SESSION_MS = 2_000;

export default function Inscription({ appId, configId, version }: { appId: string; configId: string; version: string }) {
  const [pret, setPret] = useState(false);
  const [etat, setEtat] = useState<'repos' | 'meta' | 'serveur'>('repos');
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatRaccordement | null>(null);
  const session = useRef<SessionInscription | null>(null);

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: true, version });
      setPret(true);
    };
    if (window.FB) window.fbAsyncInit();
    const ecoute = (e: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      const s = lireSessionInscription(e.data);
      if (!s) return;
      session.current = s;
      if (s.issue === 'annule') setErreur(`Inscription interrompue${s.detail ? ` (étape ${s.detail})` : ''}.`);
      if (s.issue === 'erreur') setErreur(`Erreur Meta${s.detail ? ` : ${s.detail}` : ''}.`);
    };
    window.addEventListener('message', ecoute);
    return () => window.removeEventListener('message', ecoute);
  }, [appId, version]);

  const lancer = () => {
    setErreur(null);
    setResultat(null);
    session.current = null;
    setEtat('meta');
    window.FB!.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) {
          setEtat('repos');
          setErreur((e) => e ?? 'Fenêtre Meta fermée avant la fin de l’inscription.');
          return;
        }
        // Le code ne vit que 30 s : on attend brièvement les identifiants envoyés par message, puis on part.
        setEtat('serveur');
        const debut = Date.now();
        const envoyer = async () => {
          if (!session.current && Date.now() - debut < ATTENTE_SESSION_MS) return void setTimeout(envoyer, 200);
          const rep = await terminerRaccordement(code, session.current);
          setEtat('repos');
          if (rep.ok) setResultat(rep.resultat);
          else setErreur(rep.erreur);
        };
        void envoyer();
      },
      // Produits choisis dans la configuration Facebook Login for Business ; l'option de
      // coexistence (application WhatsApp Business) est demandée explicitement.
      { config_id: configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding' } },
    );
  };

  return (
    <div className="space-y-4">
      <Script src="https://connect.facebook.net/fr_FR/sdk.js" strategy="afterInteractive" crossOrigin="anonymous" />
      <button type="button" className={classeBouton()} disabled={!pret || etat !== 'repos'} onClick={lancer}>
        {etat === 'meta' ? 'Inscription en cours dans la fenêtre Meta…' : etat === 'serveur' ? 'Finalisation…' : 'Lancer l’inscription Meta'}
      </button>
      {erreur && <Alerte>{erreur}</Alerte>}
      {resultat && <Resultat resultat={resultat} numeroActuel={null} />}
    </div>
  );
}

export function Resultat({ resultat, numeroActuel }: { resultat: ResultatRaccordement; numeroActuel: string | null }) {
  const echecs = resultat.synchronisations.filter((s) => s.erreur);
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-500">Compte WhatsApp (WHATSAPP_WABA_ID)</dt>
        <dd className="font-mono">{resultat.wabaId}</dd>
        <dt className="text-ink-500">Webhooks</dt>
        <dd>{resultat.abonnement ? 'application abonnée' : 'abonnement non confirmé'}</dd>
      </dl>
      <ul className="space-y-1.5">
        {resultat.numeros.map((n) => (
          <li key={n.id} className="rounded-lg border border-ink-200/70 px-3 py-2">
            <span className="font-medium">{n.numero ?? 'Numéro'}</span>
            {n.nom && <span className="text-ink-500"> · {n.nom}</span>}
            <span className="block font-mono text-xs">WHATSAPP_PHONE_NUMBER_ID = {n.id}</span>
            <span className="block text-xs text-ink-500">
              {n.coexistence ? 'Coexistence active (application + Cloud API).' : `Plateforme : ${n.plateforme ?? 'inconnue'}.`}
              {numeroActuel === n.id && ' Numéro déjà utilisé par le Back-Office.'}
            </span>
          </li>
        ))}
      </ul>
      {resultat.synchronisations.length > 0 && (
        <p className="text-ink-600">
          Synchronisation demandée : {resultat.synchronisations.filter((s) => !s.erreur).map((s) => (s.type === 'history' ? 'historique' : 'contacts')).join(', ') || 'aucune'}.
          {echecs.length > 0 && <span className="block text-red-700">Échecs : {echecs.map((s) => `${s.type} (${s.erreur})`).join(' ; ')}. Meta laisse 24 h après l’inscription.</span>}
        </p>
      )}
      <Alerte type="info">
        Étapes suivantes : dans le portefeuille Meta, attribuer ce compte WhatsApp à l’utilisateur système <strong>nexclean-api</strong> (contrôle total), puis dans Coolify remplacer WHATSAPP_WABA_ID et WHATSAPP_PHONE_NUMBER_ID par les valeurs ci-dessus et redéployer.
      </Alerte>
    </div>
  );
}
