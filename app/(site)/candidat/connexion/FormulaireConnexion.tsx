'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { connecter } from '../actions';

export default function FormulaireConnexion({ retour = '/candidat/espace' }: { retour?: string }) {
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
      className={cardClasses({ padding: 'sm', className: 'space-y-4' })}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!telephone.trim() || !motDePasse) return setErreur('Indiquez votre numéro et votre mot de passe.');
        setEnvoi(true);
        setErreur(null);
        try {
          const r = await connecter({ telephone, motDePasse, resterConnecte });
          if (r.ok) {
            router.replace(retour);
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
          <button type="button" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setVoir((v) => !v)} className="absolute right-0 top-0 h-full w-12 inline-flex items-center justify-center text-muted">
            {voir ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-3 min-h-11 text-sm text-ink-700">
        <input type="checkbox" checked={resterConnecte} onChange={(e) => setResterConnecte(e.target.checked)} className="h-5 w-5 accent-primary" />
        Rester connecté(e) sur ce téléphone
      </label>
      {erreur && (
        <p role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      <Button type="submit" fullWidth loading={envoi} loadingLabel="Connexion en cours…">
        Se connecter
      </Button>
      <p className="text-center text-sm">
        <Link href="/candidat/mot-de-passe-oublie" className="text-primary underline">
          Mot de passe oublié ?
        </Link>
      </p>
    </form>
  );
}
