'use client';
// M1-AUT-07 : choix du nouveau mot de passe à partir du lien reçu par e-mail.
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Alerte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';
import CadreAuth from '@/components/backoffice/CadreAuth';

function Formulaire() {
  const token = useSearchParams().get('token');
  const [etat, setEtat] = useState<'saisie' | 'fait'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider(form: FormData) {
    const motDePasse = String(form.get('password') ?? '');
    if (motDePasse.length < 10) return setErreur(`Le mot de passe doit contenir au moins 10 caractères (actuellement ${motDePasse.length}).`);
    if (motDePasse !== String(form.get('confirmation') ?? '')) return setErreur('Les deux mots de passe ne correspondent pas.');
    const { error } = await authClient.resetPassword({ newPassword: motDePasse, token: token ?? '' });
    if (error) return setErreur(error.code === 'PASSWORD_TOO_SHORT' ? 'Au moins 10 caractères.' : 'Lien invalide ou expiré. Refaites une demande.');
    setEtat('fait');
  }

  if (!token) return <Alerte>Lien invalide ou expiré.</Alerte>;
  if (etat === 'fait')
    return (
      <Alerte type="succes">
        Mot de passe modifié. <Link href="/admin/connexion" className="underline">Se connecter</Link>
      </Alerte>
    );
  return (
    <form action={valider} noValidate className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      <div>
        <label htmlFor="password" className={classeLibelle}>Nouveau mot de passe (10 caractères minimum)</label>
        <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className={classeChamp} />
      </div>
      <div>
        <label htmlFor="confirmation" className={classeLibelle}>Confirmation</label>
        <input id="confirmation" name="confirmation" type="password" minLength={10} required autoComplete="new-password" className={classeChamp} />
      </div>
      <button type="submit" className={classeBouton('principal', true)}>Enregistrer</button>
    </form>
  );
}

export default function PageNouveauMotDePasse() {
  return (
    <CadreAuth titre="Nouveau mot de passe" sousTitre="Choisissez le mot de passe de votre compte.">
        <Suspense>
          <Formulaire />
        </Suspense>
    </CadreAuth>
  );
}
