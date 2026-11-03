'use client';
// MVP2-01 RG-07 : mot de passe oublié — lien par e-mail, ou demande assistée traitée par un conseiller.
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import Coque from '../Coque';
import { demanderReinitialisation } from '../actions';

export default function PageMotDePasseOublie() {
  const [telephone, setTelephone] = useState('');
  const [siteWeb, setSiteWeb] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  return (
    <Coque titre="Mot de passe oublié">
      {fait ? (
        <div role="status" className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-success mx-auto" strokeWidth={1.5} />
          <p className="text-slate-700">Demande enregistrée.</p>
          <p className="text-sm text-slate-600">
            Si ce numéro a un compte avec une adresse e-mail, vous recevez un lien valable 30 minutes. Sinon, un conseiller NEXCLEAN vous contacte sur WhatsApp : il vous posera quelques questions sur votre profil avant de vous envoyer un lien.
          </p>
          <Link href="/candidat/connexion" className="inline-block text-primary underline">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form
          noValidate
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 sm:p-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!telephone.trim()) return setErreur('Indiquez votre numéro de téléphone.');
            setEnvoi(true);
            setErreur(null);
            try {
              const r = await demanderReinitialisation({ telephone, siteWeb });
              if (r.ok) setFait(true);
              else setErreur(r.erreur);
            } catch {
              setErreur('Connexion au serveur impossible. Réessayez dans un instant.');
            }
            setEnvoi(false);
          }}
        >
          <p className="text-sm text-slate-600">Indiquez le numéro avec lequel vous vous êtes inscrit(e).</p>
          <div className="hidden" aria-hidden="true">
            <label>
              Site web
              <input tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
            </label>
          </div>
          <div>
            <label htmlFor="mo-telephone" className={labelClass}>
              Téléphone
            </label>
            <input id="mo-telephone" type="tel" inputMode="tel" autoComplete="tel" placeholder="6 90 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} />
          </div>
          {erreur && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <button type="submit" disabled={envoi} className="flex w-full items-center justify-center gap-2 min-h-12 px-6 rounded-full bg-primary text-white font-semibold disabled:opacity-60">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />} Continuer
          </button>
        </form>
      )}
    </Coque>
  );
}
