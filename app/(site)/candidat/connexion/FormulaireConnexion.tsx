'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { connecter } from '../actions';

export default function FormulaireConnexion() {
  const router = useRouter();
  const [telephone, setTelephone] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voir, setVoir] = useState(false);
  const [resterConnecte, setResterConnecte] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  return (
    <form
      noValidate
      className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 sm:p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!telephone.trim() || !motDePasse) return setErreur('Indiquez votre numéro et votre mot de passe.');
        setEnvoi(true);
        setErreur(null);
        try {
          const r = await connecter({ telephone, motDePasse, resterConnecte });
          if (r.ok) {
            router.replace('/candidat/espace');
            router.refresh();
            return;
          }
          setErreur(r.erreur);
        } catch {
          setErreur('Connexion au serveur impossible. Réessayez dans un instant.');
        }
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor="cx-telephone" className={labelClass}>
          Téléphone
        </label>
        <input id="cx-telephone" type="tel" inputMode="tel" autoComplete="tel" placeholder="6 90 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="cx-mdp" className={labelClass}>
          Mot de passe
        </label>
        <div className="relative">
          <input id="cx-mdp" type={voir ? 'text' : 'password'} autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${inputClass} pr-12`} />
          <button type="button" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setVoir((v) => !v)} className="absolute right-0 top-0 h-full w-12 inline-flex items-center justify-center text-slate-500">
            {voir ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-3 min-h-11 text-sm text-slate-700">
        <input type="checkbox" checked={resterConnecte} onChange={(e) => setResterConnecte(e.target.checked)} className="h-5 w-5 accent-primary" />
        Rester connecté(e) sur ce téléphone
      </label>
      {erreur && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erreur}
        </p>
      )}
      <button type="submit" disabled={envoi} className="flex w-full items-center justify-center gap-2 min-h-12 px-6 rounded-full bg-primary text-white font-semibold disabled:opacity-60">
        {envoi && <Loader2 className="w-4 h-4 animate-spin" />} Se connecter
      </button>
      <p className="text-center text-sm">
        <Link href="/candidat/mot-de-passe-oublie" className="text-primary underline">
          Mot de passe oublié ?
        </Link>
      </p>
    </form>
  );
}
