'use server';
// Actions du client sur la page de suivi et les liens temporaires (specs/MVP2-03 RG-07, RG-11,
// RG-16). Chaque action recharge le contexte depuis le jeton et, sauf la vérification
// elle-même, exige le cookie de vérification des 4 chiffres.
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { executer } from '@/lib/actions';
import type { ResultatAction } from '@/components/backoffice/ui';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import * as client from '@/lib/propositions/client';

export type Source = 'suivi' | 'profil';

const ip = async () => ipDepuisEnTetes(await headers());

async function contexte(source: Source, jeton: string) {
  const ctx = source === 'profil' ? await client.chargerContexteAcces(String(jeton ?? '')) : await client.chargerContexteSuivi(String(jeton ?? ''));
  if (!ctx) throw new ErreurMetier('Lien invalide ou expiré.');
  return ctx;
}

async function contexteVerifie(source: Source, jeton: string) {
  const ctx = await contexte(source, jeton);
  if (!(await client.estVerifie(ctx))) throw new ErreurMetier('Vérification expirée : saisissez de nouveau les 4 derniers chiffres de votre numéro WhatsApp.');
  return ctx;
}

/** RG-07 : vérification des 4 derniers chiffres du numéro WhatsApp du client. */
export async function verifierChiffres(source: Source, jeton: string, chiffres: string): Promise<ResultatAction> {
  return executer(async () => {
    const ctx = await contexte(source, jeton);
    const saisie = String(chiffres ?? '').replace(/\D/g, '');
    if (saisie.length !== 4) throw new ErreurMetier('Saisissez les 4 derniers chiffres de votre numéro WhatsApp.');
    const r = await client.verifierChiffres(ctx, saisie, await ip());
    if (!r.ok) throw new ErreurMetier(r.erreur);
    await client.poserVerification(ctx);
  });
}

/** RG-11 : « Je souhaite le / la rencontrer » ou « Ne correspond pas » (motif facultatif). */
export async function repondreProfil(source: Source, jeton: string, propositionId: number, retour: client.RetourClient, motif: string | null): Promise<ResultatAction> {
  return executer(async () => {
    const ctx = await contexteVerifie(source, jeton);
    await client.enregistrerRetourClient(ctx, Number(propositionId), retour, motif ? String(motif) : null, await ip());
    return retour === 'rencontrer' ? 'Merci, votre référent NEXCLEAN vous recontacte pour organiser la rencontre.' : 'Merci, votre réponse est transmise à votre référent NEXCLEAN.';
  });
}

/** RG-16 : confirmation de la prise de poste par le client. */
export async function confirmerPriseDePoste(
  source: Source,
  jeton: string,
  placementId: number,
  saisie: { signataireNom: string; signataireFonction: string; datePriseDePoste: string },
): Promise<ResultatAction> {
  return executer(async () => {
    const ctx = await contexteVerifie(source, jeton);
    await client.confirmerPriseDePoste(
      ctx,
      Number(placementId),
      { signataireNom: String(saisie?.signataireNom ?? ''), signataireFonction: String(saisie?.signataireFonction ?? ''), datePriseDePoste: String(saisie?.datePriseDePoste ?? '') },
      await ip(),
    );
    return 'Merci, la prise de poste est confirmée.';
  });
}
