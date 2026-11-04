'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { authClient } from '@/lib/auth/client';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle } from '@/components/backoffice/ui';

/** Message lisible selon l'erreur Better Auth, au lieu d'un « Mot de passe incorrect » systématique. */
function messageErreur(error: { code?: string; status?: number } | null | undefined, motDePasse: boolean): string {
  if (error?.status === 429) return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  if (error?.code === 'INVALID_PASSWORD') return 'Mot de passe incorrect. Saisissez le mot de passe de votre compte (pas un code à 6 chiffres).';
  if (!motDePasse && error?.code === 'INVALID_CODE') return 'Code incorrect. Vérifiez que l’heure de votre téléphone est automatique et réessayez.';
  if (error?.status === 0 || error?.status === undefined) return 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';
  return motDePasse ? 'Impossible de vérifier votre mot de passe. Réessayez.' : 'Code refusé. Réessayez avec le code actuel de votre application.';
}

type Etape = { nom: 'repos' } | { nom: 'scan'; qr: string; secret: string; codes: string[] } | { nom: 'codes'; codes: string[] };

export default function DeuxFacteurs({ active, obligatoire }: { active: boolean; obligatoire: boolean }) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>({ nom: 'repos' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function demarrer(form: FormData) {
    setEnvoi(true);
    setErreur(null);
    const { data, error } = await authClient.twoFactor.enable({ password: String(form.get('password') ?? '') });
    setEnvoi(false);
    if (error || !data) return setErreur(messageErreur(error, true));
    if (data.method !== 'totp') return setErreur('Méthode de double authentification inattendue.');
    const secret = new URL(data.totpURI).searchParams.get('secret') ?? '';
    setEtape({ nom: 'scan', qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }), secret, codes: data.backupCodes });
  }

  async function confirmer(form: FormData) {
    if (etape.nom !== 'scan') return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: String(form.get('code') ?? '').replace(/\s/g, '') });
    setEnvoi(false);
    if (error) return setErreur(messageErreur(error, false));
    setEtape({ nom: 'codes', codes: etape.codes });
  }

  async function regenererCodes(form: FormData) {
    setEnvoi(true);
    setErreur(null);
    const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: String(form.get('password') ?? '') });
    setEnvoi(false);
    if (error || !data) return setErreur(messageErreur(error, true));
    setEtape({ nom: 'codes', codes: data.backupCodes });
  }

  async function desactiver(form: FormData) {
    setEnvoi(true);
    setErreur(null);
    const { error } = await authClient.twoFactor.disable({ password: String(form.get('password') ?? '') });
    setEnvoi(false);
    if (error) return setErreur(messageErreur(error, true));
    router.refresh();
  }

  if (etape.nom === 'codes')
    return (
      <Carte titre="Vos codes de secours">
        <p className="text-sm text-ink-700 mb-3">
          Notez ou imprimez ces 10 codes et rangez-les en lieu sûr. Chacun permet <strong>une seule</strong> connexion si vous perdez votre téléphone. Ils ne seront plus affichés.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm mb-4">
          {etape.codes.map((c) => (
            <li key={c} className="bg-ink-50 border border-ink-100 rounded-md px-2 py-1.5 text-center">{c}</li>
          ))}
        </ul>
        <button type="button" className={classeBouton('principal', true)} onClick={() => { setEtape({ nom: 'repos' }); router.replace('/admin'); router.refresh(); }}>
          J’ai noté mes codes
        </button>
      </Carte>
    );

  if (etape.nom === 'scan')
    return (
      <Carte titre="Étape 2 sur 2 : scannez le code QR">
        {erreur && <div className="mb-3"><Alerte>{erreur}</Alerte></div>}
        <ol className="text-sm text-ink-700 list-decimal pl-5 space-y-1 mb-4">
          <li>Installez une application d’authentification (Google Authenticator, Microsoft Authenticator…).</li>
          <li>Scannez ce code avec l’application.</li>
          <li>Saisissez le code à 6 chiffres affiché.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={etape.qr} alt="Code QR de double authentification" width={220} height={220} className="mx-auto mb-3" />
        <p className="text-xs text-ink-500 text-center mb-4 break-all">Saisie manuelle : <span className="font-mono">{etape.secret}</span></p>
        <form action={confirmer} className="space-y-3">
          <div>
            <label htmlFor="code" className={classeLibelle}>Code à 6 chiffres</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={classeChamp} />
          </div>
          <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>{envoi ? 'Vérification…' : 'Activer'}</button>
        </form>
      </Carte>
    );

  return (
    <div className="space-y-4">
      {erreur && <Alerte>{erreur}</Alerte>}
      {active ? (
        <>
          <Carte titre="Double authentification">
            <Alerte type="succes">Activée. Un code de votre application est demandé à chaque connexion.</Alerte>
          </Carte>
          <Carte titre="Nouveaux codes de secours">
            <form action={regenererCodes} className="space-y-3">
              <p className="text-sm text-ink-600">Les anciens codes ne fonctionneront plus.</p>
              <input name="password" type="password" required placeholder="Votre mot de passe" autoComplete="current-password" className={classeChamp} />
              <button type="submit" disabled={envoi} className={classeBouton('secondaire', true)}>Générer de nouveaux codes</button>
            </form>
          </Carte>
          {!obligatoire && (
            <Carte titre="Désactiver">
              <form action={desactiver} className="space-y-3">
                <input name="password" type="password" required placeholder="Votre mot de passe" autoComplete="current-password" className={classeChamp} />
                <button type="submit" disabled={envoi} className={classeBouton('danger', true)}>Désactiver la double authentification</button>
              </form>
            </Carte>
          )}
        </>
      ) : (
        <Carte titre="Étape 1 sur 2 : confirmez votre mot de passe">
          <form action={demarrer} className="space-y-3">
            <p className="text-sm text-ink-600">
              La double authentification ajoute un code à 6 chiffres, généré par votre téléphone, à chaque connexion.
              {obligatoire ? ' Elle est obligatoire pour votre rôle.' : ''}
            </p>
            <p className="text-sm text-ink-600">Saisissez le mot de passe de votre compte : le code QR à scanner s’affiche à l’étape suivante.</p>
            <input name="password" type="password" required placeholder="Mot de passe de votre compte" autoComplete="current-password" className={classeChamp} />
            <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>{envoi ? '…' : 'Continuer'}</button>
          </form>
        </Carte>
      )}
    </div>
  );
}
