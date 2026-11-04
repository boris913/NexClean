// Réponses des routes CV / attestation / documents de la page de suivi et des liens temporaires
// (specs/MVP2-03 RG-09, RG-15 ; MVP2-04 RG-19 ; MVP2-05 RG-04) : contrôle du jeton + cookie de vérification,
// affichage inline, pas de cache, pas de détection de type.
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import * as client from '@/lib/propositions/client';
import * as devisClient from '@/lib/devis/client';
import { pdfRecuClient } from '@/lib/encaissements/suivi';

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

export type DocumentSuivi = { type: 'accuse_reception' } | { type: 'devis'; id: string } | { type: 'facture'; id: string } | { type: 'recu'; id: string };

/** MVP2-04 RG-19, MVP2-05 RG-04 : accusé de réception, PDF d'un devis, d'une facture ou d'un reçu du Dossier (page de suivi uniquement). */
export async function servirDocumentSuivi(jeton: string, doc: DocumentSuivi): Promise<Response> {
  const r = await contexteVerifie('suivi', jeton);
  if (!r.ctx) return r.erreur!;
  const ip = ipDepuisEnTetes(await headers());
  try {
    const f =
      doc.type === 'accuse_reception'
        ? await devisClient.accuseReceptionClient(r.ctx, ip)
        : doc.type === 'devis'
          ? await devisClient.pdfDevisClient(r.ctx, Number(doc.id), ip)
          : doc.type === 'facture'
            ? await devisClient.pdfFactureClient(r.ctx, Number(doc.id), ip)
            : await pdfRecuClient(r.ctx, Number(doc.id), ip);
    return fichier(f.octets, 'application/pdf', f.nom);
  } catch (e) {
    if (e instanceof ErreurMetier) return texte(e.message, 404);
    console.error(e);
    return texte('Document momentanément indisponible. Réessayez plus tard ou contactez votre référent NEXCLEAN.', 503);
  }
}
