'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import * as geo from '@/lib/geo/service';

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'referentiel.gerer' });
  return { id: c.id, ip: c.ip };
}

export async function ajouterVille(nom: string, couverte: boolean) {
  return executer(async () => {
    await geo.ajouterVille({ nom, couverte }, await auteur());
    revalidatePath('/admin/referentiel');
    return 'Ville ajoutée.';
  });
}

export async function ajouterArrondissement(villeId: number, nom: string) {
  return executer(async () => {
    await geo.ajouterArrondissement({ villeId, nom }, await auteur());
    revalidatePath('/admin/referentiel');
    return 'Arrondissement ajouté.';
  });
}

export async function ajouterQuartier(villeId: number, arrondissementId: number | null, nom: string) {
  return executer(async () => {
    await geo.ajouterQuartier({ villeId, arrondissementId, nom }, await auteur());
    revalidatePath('/admin/referentiel');
    return 'Quartier ajouté.';
  });
}

export async function modifier(
  entite: 'ville' | 'arrondissement' | 'quartier',
  id: number,
  changements: { nom?: string; actif?: boolean; couverte?: boolean; latitude?: number | null; longitude?: number | null },
) {
  return executer(async () => {
    await geo.modifierEntree(entite, id, changements, await auteur());
    revalidatePath('/admin/referentiel');
    return 'Modification enregistrée.';
  });
}
