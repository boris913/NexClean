'use server';
// COM4-01 : actions de l'écran Veille (RG-06 à RG-11). Toutes journalisées dans le service.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import * as veille from '@/lib/veille/service';
import type { CanalContact, MotifEcart, StatutPiste } from '@/lib/veille/domaine';

async function acteur() {
  const c = await exigerCollaborateur({ permission: 'veille.utiliser' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

export async function ajouter(url: string, texte: string) {
  return executer(async () => {
    const r = await veille.ajouterPiste({ url, texte }, await acteur());
    revalidatePath('/admin/veille');
    if (r.issue === 'doublon') return `Déjà enregistrée : piste ${r.reference}.`;
    if (r.issue === 'client_existant') return `Ce contact est déjà client (${r.nom}) : la publication est rattachée à sa fiche, aucune piste créée.`;
    return r.statut === 'ecartee' ? `Piste ${r.reference} écartée d’office (hors services ou hors zone) : consultez-la dans « Écartées ».` : `Piste ${r.reference} ajoutée.`;
  });
}

export async function changerStatut(id: number, vers: StatutPiste, motif: MotifEcart | null = null) {
  return executer(async () => {
    const a = await acteur();
    const p = await veille.changerStatutPiste(id, vers, motif, a);
    // RG-07 : une piste retenue reçoit un message d'approche (si l'IA est disponible).
    if (vers === 'retenue' && !p.message) await veille.redigerApproche(id, veille.canalParDefaut(p), a).catch(() => null);
    revalidatePath('/admin/veille');
  });
}

export async function rediger(id: number, canal: CanalContact) {
  return executer(async () => {
    await veille.redigerApproche(id, canal, await acteur());
    revalidatePath('/admin/veille');
    return 'Message proposé : relisez-le avant de l’envoyer.';
  });
}

export async function enregistrerMessage(id: number, texte: string) {
  return executer(async () => {
    await veille.enregistrerMessage(id, texte, await acteur());
    revalidatePath('/admin/veille');
    return 'Message enregistré.';
  });
}

export async function marquerContactee(id: number, canal: CanalContact, texte: string) {
  return executer(async () => {
    const type = await veille.marquerContactee(id, { canal, texte }, await acteur());
    revalidatePath('/admin/veille');
    return type === 'premier' ? 'Contact enregistré.' : 'Relance enregistrée.';
  });
}

/** RG-08 : e-mail professionnel envoyé depuis le Back-Office à l'adresse publiée par l'auteur. */
export async function envoyerEmail(id: number, objet: string, texte: string) {
  return executer(async () => {
    const type = await veille.envoyerEmailApproche(id, { objet, texte }, await acteur());
    revalidatePath('/admin/veille');
    return type === 'premier' ? 'E-mail envoyé, contact enregistré.' : 'E-mail de relance envoyé.';
  });
}
