'use client';
// M1-AUT-07 : demande de lien de réinitialisation (30 min, usage unique).
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';
import { Alerte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';

export default function PageMotDePasseOublie() {
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function demander(form: FormData) {
    setEnvoi(true);
    // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
    await authClient.requestPasswordReset({ email: String(form.get('email') ?? ''), redirectTo: '/admin/mot-de-passe/nouveau' });
    setEnvoi(false);
    setEnvoye(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-ink-100 rounded-xl p-5 shadow-sm space-y-4">
        <h1 className="text-lg font-semibold">Mot de passe oublié</h1>
        {envoye ? (
          <Alerte type="succes">Si un compte existe pour cette adresse, un lien valable 30 minutes vient d’être envoyé.</Alerte>
        ) : (
          <form action={demander} className="space-y-4">
            <div>
              <label htmlFor="email" className={classeLibelle}>E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="username" className={classeChamp} />
            </div>
            <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
              {envoi ? 'Envoi…' : 'Recevoir un lien'}
            </button>
          </form>
        )}
        <Link href="/admin/connexion" className="block text-center text-sm text-primary py-1">
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
