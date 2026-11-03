'use server';
// Actions de l'espace candidat (MVP2-01). Chaque action vérifie elle-même la session candidat
// (ADR 0024) ; aucune n'accepte une session du Back-Office.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ipDepuisEnTetes } from '@/lib/audit';
import { executer } from '@/lib/actions';
import type { ResultatAction } from '@/components/backoffice/ui';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { controlerEnvoi } from '@/lib/dossiers/anti-abus';
import { brouillonCandidatVide, type BrouillonCandidat } from '@/lib/candidats/domaine';
import * as svc from '@/lib/candidats/service';
import { candidatConnecte, exigerCandidat, fermerSession, ouvrirSession } from '@/lib/candidats/session';

const ip = async () => ipDepuisEnTetes(await headers());
/** Le brouillon vient du navigateur : on repart d'un brouillon vide pour garantir la forme. */
const brouillon = (entree: unknown): BrouillonCandidat => ({ ...brouillonCandidatVide(), ...(entree && typeof entree === 'object' ? entree : {}) }) as BrouillonCandidat;

export async function inscrire(entree: { brouillon: unknown; motDePasse: string; resterConnecte: boolean; siteWeb?: string }): Promise<ResultatAction & { dejaInscrit?: boolean }> {
  const adresse = await ip();
  const refus = await controlerEnvoi('inscription_candidat', entree.siteWeb, adresse);
  if (refus) return { ok: false, erreur: refus };
  const r = await executer(async () => {
    const { candidatId } = await svc.inscrireCandidat(brouillon(entree.brouillon), String(entree.motDePasse ?? ''), { ip: adresse });
    await ouvrirSession(candidatId, !!entree.resterConnecte, adresse);
  });
  return !r.ok && r.erreur === svc.MESSAGE_DEJA_INSCRIT ? { ...r, dejaInscrit: true } : r;
}

/** Téléversement d'un document, un fichier par appel (≤ 5 Mo, limite des actions : 6 Mo). */
export async function televerser(form: FormData): Promise<ResultatAction> {
  return executer(async () => {
    const c = await candidatConnecte();
    if (!c) throw new ErreurMetier('Session expirée : reconnectez-vous pour ajouter vos documents.');
    const fichier = form.get('fichier');
    const categorie = form.get('categorie') === 'cv' ? 'cv' : 'justificatif';
    if (!(fichier instanceof File) || fichier.size === 0) throw new ErreurMetier('Choisissez un fichier.');
    await svc.ajouterDocument(c.id, categorie, fichier.name, new Uint8Array(await fichier.arrayBuffer()), await ip());
    return categorie === 'cv' ? 'CV enregistré.' : 'Justificatif enregistré.';
  });
}

export async function supprimerDocument(documentId: number): Promise<ResultatAction> {
  return executer(async () => {
    const c = await exigerCandidat();
    await svc.supprimerDocument(c.id, documentId, await ip());
    return 'Document supprimé.';
  });
}

export async function connecter(entree: { telephone: string; motDePasse: string; resterConnecte: boolean }): Promise<ResultatAction> {
  return executer(async () => {
    const adresse = await ip();
    const id = await svc.verifierConnexion(String(entree.telephone ?? ''), String(entree.motDePasse ?? ''), adresse);
    await ouvrirSession(id, !!entree.resterConnecte, adresse);
  });
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
  redirect('/candidat/connexion');
}

export async function demanderReinitialisation(entree: { telephone: string; siteWeb?: string }): Promise<ResultatAction> {
  const adresse = await ip();
  const refus = await controlerEnvoi('reinitialisation_candidat', entree.siteWeb, adresse);
  if (refus) return { ok: false, erreur: refus };
  return executer(async () => {
    await svc.demanderReinitialisation(String(entree.telephone ?? ''), adresse);
  });
}

export async function reinitialiser(jeton: string, motDePasse: string, confirmation: string): Promise<ResultatAction> {
  return executer(async () => {
    if (motDePasse !== confirmation) throw new ErreurMetier('Les deux mots de passe ne correspondent pas.');
    await svc.reinitialiserMotDePasse(jeton, motDePasse, await ip());
  });
}

export async function modifierProfil(entree: unknown): Promise<ResultatAction> {
  return executer(async () => {
    const c = await exigerCandidat();
    await svc.modifierProfil(c.id, brouillon(entree), await ip());
    return 'Profil enregistré.';
  });
}

export async function definirRecherche(enRecherche: boolean): Promise<ResultatAction> {
  return executer(async () => {
    const c = await exigerCandidat();
    await svc.definirRecherche(c.id, enRecherche, await ip());
    return enRecherche ? 'Vous êtes de nouveau visible pour les offres.' : 'Vous n’êtes plus proposé(e) pour des offres.';
  });
}

export async function demanderSuppression(motDePasse: string): Promise<ResultatAction> {
  const r = await executer(async () => {
    const c = await exigerCandidat();
    const { prevueLe } = await svc.demanderSuppression(c.id, String(motDePasse ?? ''), await ip());
    return prevueLe.toISOString();
  });
  if (r.ok) await fermerSession();
  return r;
}
