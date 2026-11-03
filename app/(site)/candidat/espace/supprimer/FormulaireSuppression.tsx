'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { FUSEAU } from '@/lib/domain/referentiels';
import { demanderSuppression } from '../../actions';

export default function FormulaireSuppression({ connecte }: { connecte: boolean }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [prevueLe, setPrevueLe] = useState<string | null>(null);

  if (prevueLe)
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
        <p className="font-semibold">Demande enregistrée.</p>
        <p className="mt-1">
          Votre compte est bloqué. Vos données seront supprimées le{' '}
          {new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(prevueLe))}. Pour annuler d’ici là,
          contactez NEXCLEAN sur WhatsApp.
        </p>
      </div>
    );

  if (!connecte)
    return (
      <p className="pt-2 border-t border-slate-100">
        <Link href="/candidat/connexion" className="text-primary underline font-semibold">
          Connectez-vous
        </Link>{' '}
        pour demander la suppression de votre compte.
      </p>
    );

  return (
    <form
      noValidate
      className="space-y-3 pt-2 border-t border-slate-100"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!motDePasse) return setErreur('Indiquez votre mot de passe pour confirmer.');
        setEnvoi(true);
        setErreur(null);
        try {
          const r = await demanderSuppression(motDePasse);
          if (r.ok) setPrevueLe(r.message ?? new Date().toISOString());
          else setErreur(r.erreur);
        } catch {
          setErreur('Connexion au serveur impossible. Réessayez dans un instant.');
        }
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor="su-mdp" className={labelClass}>
          Mot de passe (confirmation)
        </label>
        <input id="su-mdp" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={inputClass} />
      </div>
      {erreur && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erreur}
        </p>
      )}
      <button type="submit" disabled={envoi} className="flex w-full items-center justify-center gap-2 min-h-12 px-6 rounded-full bg-red-700 text-white font-semibold disabled:opacity-60">
        {envoi && <Loader2 className="w-4 h-4 animate-spin" />} Supprimer mon compte et mes données
      </button>
    </form>
  );
}
