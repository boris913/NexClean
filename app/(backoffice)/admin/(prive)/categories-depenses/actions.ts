'use server';
// POST-03 RG-02 : catégories de dépenses (Direction, Administrateur).
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { changerActivationCategorie, creerCategorie, modifierCategorie, supprimerCategorie, type ActeurDepense } from '@/lib/depenses/service';
import type { EntreeCategorie } from '@/lib/depenses/domaine';
import type { ResultatAction } from '@/components/backoffice/ui';

async function acteur(): Promise<ActeurDepense> {
  const c = await exigerCollaborateur({ permission: 'depense.categories' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

const rafraichir = () => {
  revalidatePath('/admin/categories-depenses');
  revalidatePath('/admin/depenses');
};

export async function creer(entree: EntreeCategorie): Promise<ResultatAction> {
  return executer(async () => {
    await creerCategorie(entree, await acteur());
    rafraichir();
    return 'Catégorie ajoutée.';
  });
}

export async function modifier(id: number, entree: EntreeCategorie): Promise<ResultatAction> {
  return executer(async () => {
    await modifierCategorie(id, entree, await acteur());
    rafraichir();
    return 'Catégorie enregistrée.';
  });
}

export async function activer(id: number, actif: boolean): Promise<ResultatAction> {
  return executer(async () => {
    await changerActivationCategorie(id, actif, await acteur());
    rafraichir();
    return actif ? 'Catégorie réactivée.' : 'Catégorie désactivée : elle n’est plus proposée à la saisie.';
  });
}

export async function supprimer(id: number): Promise<ResultatAction> {
  return executer(async () => {
    await supprimerCategorie(id, await acteur());
    rafraichir();
    return 'Catégorie supprimée.';
  });
}
