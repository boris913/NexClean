'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { schemaMotDePasse } from '@/lib/candidats/domaine';
import { reinitialiser } from '../../actions';

export default function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  if (fait)
    return (
      <div role="status" className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-3">
        <p className="text-slate-700">Mot de passe modifié.</p>
        <Link href="/candidat/connexion" className="text-primary underline font-semibold">
          Se connecter
        </Link>
      </div>
    );

  return (
    <form
      noValidate
      className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 sm:p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const m = schemaMotDePasse.safeParse(motDePasse);
        if (!m.success) return setErreur(m.error.issues[0]!.message);
        if (motDePasse !== confirmation) return setErreur('Les deux mots de passe ne correspondent pas.');
        setEnvoi(true);
        setErreur(null);
        try {
          const r = await reinitialiser(jeton, motDePasse, confirmation);
          if (r.ok) setFait(true);
          else setErreur(r.erreur);
        } catch {
          setErreur('Connexion au serveur impossible. Réessayez dans un instant.');
        }
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor="re-mdp" className={labelClass}>
          Nouveau mot de passe
        </label>
        <input id="re-mdp" type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={inputClass} />
        <p className="text-xs text-slate-500 mt-1">Au moins 8 caractères, ou un code de 6 chiffres.</p>
      </div>
      <div>
        <label htmlFor="re-confirmation" className={labelClass}>
          Confirmation
        </label>
        <input id="re-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} />
      </div>
      {erreur && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erreur}
        </p>
      )}
      <button type="submit" disabled={envoi} className="flex w-full items-center justify-center gap-2 min-h-12 px-6 rounded-full bg-primary text-white font-semibold disabled:opacity-60">
        {envoi && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
      </button>
    </form>
  );
}
