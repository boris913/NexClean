'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import * as geo from '@/lib/geo/service';
import { revaliderCouverture } from '@/lib/geo/couverture';

/** Back-Office et site public (villes couvertes, quartiers affichés : M1-GEO-05) à jour immédiatement. */
function rafraichir() {
  revalidatePath('/admin/referentiel');
  revaliderCouverture();
}

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'referentiel.gerer' });
  return { id: c.id, ip: c.ip };
}

export async function ajouterVille(nom: string, couverte: boolean) {
  return executer(async () => {
    await geo.ajouterVille({ nom, couverte }, await auteur());
    rafraichir();
    return 'Ville ajoutée.';
  });
}

export async function ajouterArrondissement(villeId: number, nom: string) {
  return executer(async () => {
    await geo.ajouterArrondissement({ villeId, nom }, await auteur());
    rafraichir();
    return 'Arrondissement ajouté.';
  });
}

export async function ajouterQuartier(villeId: number, arrondissementId: number | null, nom: string) {
  return executer(async () => {
    await geo.ajouterQuartier({ villeId, arrondissementId, nom }, await auteur());
    rafraichir();
    return 'Quartier ajouté.';
  });
}

export async function modifier(
  entite: 'ville' | 'arrondissement' | 'quartier',
  id: number,
  changements: { nom?: string; actif?: boolean; couverte?: boolean; afficheSite?: boolean; latitude?: number | null; longitude?: number | null },
) {
  return executer(async () => {
    await geo.modifierEntree(entite, id, changements, await auteur());
    rafraichir();
    return 'Modification enregistrée.';
  });
}

/** M1-GEO-04 : rattache une saisie « Autre quartier » à un quartier existant ou à un nouveau quartier. */
export async function convertirSaisie(donnees: {
  villeId: number;
  saisie: string;
  quartierId?: number | null;
  nouveau?: { nom: string; arrondissementId: number | null } | null;
}) {
  return executer(async () => {
    const { dossiers } = await geo.convertirSaisieAutre(donnees, await auteur());
    rafraichir();
    revalidatePath('/admin/referentiel/saisies');
    revalidatePath('/admin/dossiers', 'layout');
    return `${dossiers} dossier(s) rattaché(s) au quartier.`;
  });
}
