'use server';
// Actions de la fiche candidat (MVP2-02). Accès au vivier revérifié à chaque appel (403 journalisé),
// puis contrôles métier dans lib/candidats/fiche.ts et lib/candidats/attribution.ts.
import { revalidatePath } from 'next/cache';
import { executer } from '@/lib/actions';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { changerStatutCandidat } from '@/lib/candidats/attribution';
import { STATUTS_CANDIDAT, type StatutCandidat } from '@/lib/candidats/domaine';
import * as fiche from '@/lib/candidats/fiche';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import type { ResultatAction } from '@/components/backoffice/ui';

async function acteur(permission: 'candidat.traiter' | 'candidat.reaffecter' = 'candidat.traiter') {
  const c = await exigerAccesVivier(permission);
  return { id: c.id, nom: c.nom, roles: c.roles, ip: c.ip };
}

const rafraichir = (id: number) => {
  revalidatePath(`/admin/candidats/${id}`);
  revalidatePath('/admin/candidats');
  revalidatePath('/admin/candidats/reinitialisations');
};

export async function changerStatut(id: number, vers: StatutCandidat, motif: string) {
  return executer(async () => {
    if (!(vers in STATUTS_CANDIDAT)) throw new ErreurMetier('Statut inconnu.');
    await changerStatutCandidat(id, vers, await acteur(), motif.trim().slice(0, 500) || null);
    rafraichir(id);
    return 'Statut mis à jour.';
  });
}

export async function noterWhatsApp(id: number, modele: string, texte: string) {
  return executer(async () => {
    await fiche.noterWhatsAppCandidat(id, modele, texte, await acteur());
    rafraichir(id);
    return 'Message noté au journal.';
  });
}

export type ResultatLien = { ok: true; lien: string; expireLe: string; message: string } | { ok: false; erreur: string };

/** Génère le lien de réinitialisation : renvoyé une seule fois, avec le message WhatsApp prérempli. */
export async function genererLienReinitialisation(id: number, elements: string[]): Promise<ResultatLien> {
  let resultat: { lien: string; expireLe: string; message: string } | null = null;
  const r: ResultatAction = await executer(async () => {
    const a = await acteur();
    const { lien, expireLe } = await fiche.genererLienReinitialisation(id, elements, a);
    const texte = await fiche.messageReinitialisation(id, lien, a);
    resultat = { lien, expireLe: expireLe.toISOString(), message: texte };
    rafraichir(id);
  });
  if (!r.ok) return r;
  return { ok: true, ...resultat! };
}

export async function changerNumero(id: number, numero: string, elements: string[]) {
  return executer(async () => {
    await fiche.changerNumeroCandidat(id, numero, elements, await acteur());
    rafraichir(id);
    return 'Numéro modifié. Le candidat doit se reconnecter avec son nouveau numéro.';
  });
}

export async function reaffecter(id: number, nouveauId: string, motif: string) {
  return executer(async () => {
    const r = await fiche.reaffecterCandidat(id, nouveauId, motif, await acteur('candidat.reaffecter'));
    rafraichir(id);
    return r.avertissements.length ? `Candidat réaffecté (attention : ${r.avertissements.join(', ')}).` : 'Candidat réaffecté.';
  });
}
