// API candidature (MVP2-02 RG-07, RG-11, RG-12 ; ADR 0022) : enregistrement en base.
//   - candidat connecté (session candidat, ADR 0024) : Candidature avec motivation facultative ;
//   - visiteur : formulaire court → compte candidat léger + Candidature, puis session ouverte.
// La notification interne (in-app + e-mail, sans pièce jointe ni CV) part au responsable de l'offre.
// Plus d'envoi du CV par e-mail ni de copie vers un tableur externe. Le formulaire ne bascule sur
// WhatsApp qu'en cas d'erreur serveur (réponse 5xx ou réseau).
//
// Entrée multipart/form-data :
//   offre        slug de l'offre (content/jobs-data.ts)
//   motivation   facultatif (candidat connecté)
//   donnees      JSON du formulaire court (BrouillonCandidature), visiteur seulement
//   motDePasse   visiteur seulement
//   resterConnecte « 1 » pour une session de 30 jours
//   cv           fichier facultatif (PDF, DOCX, JPEG, PNG ≤ 5 Mo, type réel contrôlé)
//   siteWeb      champ piège anti-robot
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ipDepuisEnTetes } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { MESSAGE_DEBIT, controlerEnvoi } from '@/lib/dossiers/anti-abus';
import { declencherEnvoi } from '@/lib/notifications';
import { postuler, postulerAvecCompteLeger } from '@/lib/candidats/candidatures';
import {
  MESSAGE_DEJA_POSTULE,
  MESSAGE_OFFRE_INCONNUE,
  MESSAGE_OFFRE_POURVUE,
  brouillonCandidatureVide,
  type BrouillonCandidature,
  type CodeRefusCandidature as CodeRefus,
  type ReponseCandidature,
} from '@/lib/candidats/formulaire-candidature';
import { MESSAGE_DEJA_INSCRIT } from '@/lib/candidats/service';
import { candidatConnecte, ouvrirSession } from '@/lib/candidats/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const refus = (erreur: string, code: CodeRefus, status: number) => NextResponse.json<ReponseCandidature>({ ok: false, erreur, code }, { status });

function code(message: string): { code: CodeRefus; status: number } {
  if (message === MESSAGE_DEJA_INSCRIT) return { code: 'deja_inscrit', status: 409 };
  if (message === MESSAGE_DEJA_POSTULE) return { code: 'deja_postule', status: 409 };
  if (message === MESSAGE_OFFRE_POURVUE || message === MESSAGE_OFFRE_INCONNUE) return { code: 'offre_fermee', status: 410 };
  return { code: 'invalide', status: 400 };
}

/** Le brouillon vient du navigateur : on repart d'un brouillon vide pour garantir la forme. */
function brouillon(texte: FormDataEntryValue | null): BrouillonCandidature {
  try {
    const lu: unknown = JSON.parse(typeof texte === 'string' ? texte : '{}');
    return { ...brouillonCandidatureVide(), ...(lu && typeof lu === 'object' ? lu : {}) } as BrouillonCandidature;
  } catch {
    return brouillonCandidatureVide();
  }
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return refus('Formulaire invalide ou fichier trop volumineux.', 'invalide', 400);
  }
  const ip = ipDepuisEnTetes(req.headers);
  const offre = String(form.get('offre') ?? '');

  try {
    const bloque = await controlerEnvoi('candidature', form.get('siteWeb'), ip);
    if (bloque) return refus(bloque, bloque === MESSAGE_DEBIT ? 'debit' : 'invalide', bloque === MESSAGE_DEBIT ? 429 : 400);

    const session = await candidatConnecte();
    if (session) {
      await postuler(session.id, offre, form.get('motivation'), ip);
      declencherEnvoi();
      return NextResponse.json<ReponseCandidature>({ ok: true, mode: 'connecte' });
    }

    const fichier = form.get('cv');
    const cv = fichier instanceof File && fichier.size > 0 ? { nom: fichier.name, octets: new Uint8Array(await fichier.arrayBuffer()) } : null;
    const r = await postulerAvecCompteLeger(brouillon(form.get('donnees')), String(form.get('motDePasse') ?? ''), offre, cv, { ip });
    await ouvrirSession(r.candidatId, form.get('resterConnecte') === '1', ip);
    declencherEnvoi();
    return NextResponse.json<ReponseCandidature>({ ok: true, mode: 'compte_leger', cvEnregistre: r.cvEnregistre, erreurCv: r.erreurCv });
  } catch (e) {
    if (e instanceof ErreurMetier) {
      const c = code(e.message);
      return refus(e.message, c.code, c.status);
    }
    if (e instanceof z.ZodError) return refus(e.issues.map((i) => i.message).join(' · '), 'invalide', 400);
    console.error('Candidature : erreur serveur', e);
    return NextResponse.json({ ok: false, erreur: 'erreur_serveur' }, { status: 500 });
  }
}
