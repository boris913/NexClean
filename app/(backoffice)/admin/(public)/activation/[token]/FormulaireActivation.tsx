'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { activer } from './actions';

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
      action={async (form) => {
        setEnvoi(true);
        setResultat(await activer(jeton, String(form.get('password') ?? ''), String(form.get('confirmation') ?? '')));
        setEnvoi(false);
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
