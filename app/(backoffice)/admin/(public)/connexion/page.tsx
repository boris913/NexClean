'use client';
// M1-AUT-01/02/06 : connexion e-mail + mot de passe, puis code de double authentification si activée.
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { Alerte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';
import CadreAuth from '@/components/backoffice/CadreAuth';

/**
 * Session ouverte : navigation complète. Un `router.replace` suivi de `router.refresh` pouvait
 * laisser l'utilisateur sur la page de connexion (le rafraîchissement de la page courante
 * annulait la navigation en cours).
 */
const entrer = () => window.location.replace('/admin');

export default function PageConnexion() {
  const [etape, setEtape] = useState<'identifiants' | '2fa'>('identifiants');
  const [codeSecours, setCodeSecours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function connexion(form: FormData) {
    setEnvoi(true);
    setErreur(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });
    setEnvoi(false);
    if (error) {
      setErreur(error.status === 429 || error.status === 403 ? (error.message ?? 'Connexion impossible.') : 'E-mail ou mot de passe incorrect.');
      return;
    }
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      setEtape('2fa');
      return;
    }
    entrer();
  }

  async function verifier(form: FormData) {
    setEnvoi(true);
    setErreur(null);
    const code = String(form.get('code') ?? '').replace(/\s/g, '');
    const { error } = codeSecours ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code });
    setEnvoi(false);
    if (error) {
      setErreur('Code incorrect ou expiré.');
      return;
    }
    entrer();
  }

  return (
    <CadreAuth
      titre={etape === 'identifiants' ? 'Connexion' : 'Vérification en deux étapes'}
      sousTitre={etape === 'identifiants' ? 'Accédez à votre espace de travail.' : codeSecours ? 'Saisissez l’un de vos codes de secours.' : 'Saisissez le code affiché par votre application.'}
    >
          {erreur && <Alerte>{erreur}</Alerte>}
          {etape === 'identifiants' ? (
            <form action={connexion} className="space-y-4">
              <div>
                <label htmlFor="email" className={classeLibelle}>E-mail</label>
                <input id="email" name="email" type="email" autoComplete="username" required className={classeChamp} />
              </div>
              <div>
                <label htmlFor="password" className={classeLibelle}>Mot de passe</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required className={classeChamp} />
              </div>
              <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
                {envoi ? 'Connexion…' : 'Se connecter'}
              </button>
              <Link href="/admin/mot-de-passe-oublie" className="block text-center text-sm font-medium text-primary hover:text-primary-dark py-1">
                Mot de passe oublié ?
              </Link>
            </form>
          ) : (
            <form action={verifier} className="space-y-4">
              <div>
                <label htmlFor="code" className={classeLibelle}>
                  {codeSecours ? 'Code de secours' : 'Code de votre application d’authentification'}
                </label>
                <input
                  id="code"
                  name="code"
                  inputMode={codeSecours ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  className={classeChamp}
                />
              </div>
              <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
                {envoi ? 'Vérification…' : 'Vérifier le code'}
              </button>
              <button type="button" onClick={() => setCodeSecours((v) => !v)} className="block w-full text-center text-sm font-medium text-primary hover:text-primary-dark py-1">
                {codeSecours ? 'Utiliser l’application d’authentification' : 'Téléphone perdu ? Utiliser un code de secours'}
              </button>
            </form>
          )}
    </CadreAuth>
  );
}
