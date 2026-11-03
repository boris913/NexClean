'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { definirParametre } from '@/lib/parametres';

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'tarifs.modifier' });
  return { id: c.id, ip: c.ip };
}

export async function enregistrerCommission(montant: number) {
  return executer(async () => {
    await definirParametre('commission_par_personne', montant, await auteur());
    revalidatePath('/admin/parametres');
    revalidatePath('/recrutement/demander-du-personnel');
    return 'Commission enregistrée. Les demandes déjà reçues conservent leur estimation.';
  });
}

export async function enregistrerMetiers(texte: string) {
  return executer(async () => {
    const liste = texte.split('\n').map((l) => l.trim()).filter(Boolean);
    await definirParametre('metiers', liste, await auteur());
    revalidatePath('/admin/parametres');
    return `${liste.length} métiers enregistrés.`;
  });
}

/** MVP1-05 RG-06, RG-07, RG-11 : heures ouvrées, délai d'escalade, seuil « sans action ». */
export async function enregistrerAttribution(heures: unknown, delai: number, jours: number) {
  return executer(async () => {
    const a = await auteur();
    await definirParametre('heures_ouvrees', heures, a);
    await definirParametre('delai_escalade_heures', delai, a);
    await definirParametre('jours_sans_action', jours, a);
    revalidatePath('/admin/parametres');
    return 'Paramètres d’attribution enregistrés.';
  });
}
