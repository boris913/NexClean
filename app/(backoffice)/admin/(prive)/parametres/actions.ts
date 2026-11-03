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
