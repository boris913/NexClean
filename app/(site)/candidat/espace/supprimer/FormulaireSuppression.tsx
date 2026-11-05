'use client';
import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
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
      <div role="status" className="rounded-2xl border border-success-border bg-success-soft p-4 text-ink-800">
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
      <p className="pt-2 border-t border-ink-100">
        <Link href="/candidat/connexion" className="text-primary underline font-semibold">
          Connectez-vous
        </Link>{' '}
        pour demander la suppression de votre compte.
      </p>
    );

  return (
    <form
      noValidate
      className="space-y-3 pt-2 border-t border-ink-100"
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
        <p role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      {/* Bouton destructif : Button n'a pas de variante « danger » (à ajouter dans components/ui). */}
      <Button type="submit" variant="secondary" fullWidth loading={envoi} className="!bg-danger hover:!bg-danger">
        Supprimer mon compte et mes données
      </Button>
    </form>
  );
}
