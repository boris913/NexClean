'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { activer } from './actions';

// Même valeur que LONGUEUR_MIN_COLLABORATEUR (lib/auth/mot-de-passe.ts, module serveur : Argon2).
const LONGUEUR_MIN = 10;

export default function FormulaireActivation({ jeton }: { jeton: string }) {
  const [resultat, setResultat] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (resultat?.ok)
    return (
      <Alerte type="succes">
        Compte activé. <Link href="/admin/connexion" className="underline font-medium">Se connecter</Link>
      </Alerte>
    );

  return (
    <form
      // Validation dans la page plutôt que par les bulles du navigateur, faciles à manquer
      // (surtout sur mobile) : l'utilisateur doit toujours voir pourquoi rien ne part.
      noValidate
      action={async (form) => {
        const motDePasse = String(form.get('password') ?? '');
        const confirmation = String(form.get('confirmation') ?? '');
        if (motDePasse.length < LONGUEUR_MIN)
          return setResultat({ ok: false, erreur: `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères (actuellement ${motDePasse.length}).` });
        if (motDePasse !== confirmation)
          return setResultat({ ok: false, erreur: 'Les deux mots de passe ne correspondent pas.' });
        setEnvoi(true);
        try {
          setResultat(await activer(jeton, motDePasse, confirmation));
        } catch {
          setResultat({ ok: false, erreur: 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.' });
        } finally {
          setEnvoi(false);
        }
      }}
      className="space-y-4"
    >
      {resultat && !resultat.ok && <Alerte>{resultat.erreur}</Alerte>}
      <div>
        <label htmlFor="password" className={classeLibelle}>Mot de passe (10 caractères minimum)</label>
        <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className={classeChamp} />
      </div>
      <div>
        <label htmlFor="confirmation" className={classeLibelle}>Confirmation</label>
        <input id="confirmation" name="confirmation" type="password" minLength={10} required autoComplete="new-password" className={classeChamp} />
      </div>
      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
        {envoi ? 'Activation…' : 'Activer mon compte'}
      </button>
    </form>
  );
}
