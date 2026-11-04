// Réponses des routes CV / attestation de la page de suivi et des liens temporaires
// (specs/MVP2-03 RG-09, RG-15) : contrôle du jeton + cookie de vérification, affichage inline,
// pas de cache, pas de détection de type.
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import * as client from '@/lib/propositions/client';

type Source = 'suivi' | 'profil';

const texte = (message: string, status: number) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

const fichier = (octets: Uint8Array, mime: string, nom: string) =>
  new Response(new Blob([new Uint8Array(octets)], { type: mime }), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

async function contexteVerifie(source: Source, jeton: string) {
  const ctx = source === 'profil' ? await client.chargerContexteAcces(jeton) : await client.chargerContexteSuivi(jeton);
  if (!ctx) return { erreur: texte('Lien invalide ou expiré.', 404) };
  if (!(await client.estVerifie(ctx))) return { erreur: texte('Vérification requise : revenez sur la page et saisissez les 4 derniers chiffres de votre numéro WhatsApp.', 403) };
  return { ctx };
}

export async function servirCv(source: Source, jeton: string, propositionId: string): Promise<Response> {
  const r = await contexteVerifie(source, jeton);
  if (!r.ctx) return r.erreur!;
  try {
    const cv = await client.lireCvTransmis(r.ctx, Number(propositionId), ipDepuisEnTetes(await headers()));
    if (!cv) return texte('Aucun CV disponible pour ce profil.', 404);
    return fichier(cv.octets, cv.mime, cv.nom);
  } catch (e) {
    if (e instanceof client.ErreurFiligrane) return texte(`${e.message} Contactez votre référent NEXCLEAN.`, 422);
    if (e instanceof ErreurMetier) return texte(e.message, 404);
    throw e;
  }
}

export async function servirAttestation(source: Source, jeton: string, placementId: string): Promise<Response> {
  const r = await contexteVerifie(source, jeton);
  if (!r.ctx) return r.erreur!;
  try {
    const a = await client.attestationPourClient(r.ctx, Number(placementId), ipDepuisEnTetes(await headers()));
    return fichier(a.octets, 'application/pdf', a.nom);
  } catch (e) {
    if (e instanceof ErreurMetier) return texte(e.message, 404);
    throw e;
  }
}
