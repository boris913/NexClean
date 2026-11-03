'use server';
// Actions de gestion des collaborateurs. Chaque action revérifie les droits côté serveur.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import * as svc from '@/lib/collaborateurs/service';
import type { Role } from '@/lib/domain/referentiels';

async function auteur(permission: 'collaborateurs.gerer' | 'collaborateurs.attributs') {
  const c = await exigerCollaborateur({ permission });
  return { id: c.id, ip: c.ip };
}

const rafraichir = (id?: string) => {
  revalidatePath('/admin/collaborateurs');
  if (id) revalidatePath(`/admin/collaborateurs/${id}`);
};

export async function creer(nom: string, email: string, roles: Role[]) {
  return executer(async () => {
    const { userId, lienActivation } = await svc.creerCollaborateur({ nom, email, roles }, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return `${userId}|${lienActivation}`;
  });
}

export async function modifierRoles(userId: string, roles: Role[]) {
  return executer(async () => {
    await svc.definirRoles(userId, roles, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return 'Rôles enregistrés.';
  });
}

export async function modifierAttributs(userId: string, attributs: svc.Attributs) {
  return executer(async () => {
    await svc.definirAttributs(userId, attributs, await auteur('collaborateurs.attributs'));
    rafraichir(userId);
    return 'Attributs enregistrés.';
  });
}

export async function desactiver(userId: string) {
  return executer(async () => {
    const a = await auteur('collaborateurs.gerer');
    if (a.id === userId) throw new svc.ErreurMetier('Vous ne pouvez pas désactiver votre propre compte.');
    await svc.desactiverCollaborateur(userId, a);
    rafraichir(userId);
    return 'Compte désactivé. Ses sessions ont été fermées.';
  });
}

export async function reactiver(userId: string) {
  return executer(async () => {
    await svc.reactiverCollaborateur(userId, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return 'Compte réactivé.';
  });
}

export async function regenererLien(userId: string) {
  return executer(async () => {
    const lien = await svc.regenererActivation(userId, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return lien;
  });
}

export async function reinitialiser2FA(userId: string) {
  return executer(async () => {
    await svc.reinitialiser2FA(userId, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return 'Double authentification réinitialisée. Le collaborateur devra la réactiver.';
  });
}

export async function changerEmail(userId: string, email: string) {
  return executer(async () => {
    await svc.changerEmail(userId, email, await auteur('collaborateurs.gerer'));
    rafraichir(userId);
    return 'E-mail modifié.';
  });
}
