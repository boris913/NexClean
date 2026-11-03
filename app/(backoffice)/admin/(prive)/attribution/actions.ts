'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { reaffecter, reaffecterEnMasse } from '@/lib/dossiers/attribution';

async function direction() {
  const c = await exigerCollaborateur({ permission: 'dossier.reaffecter' });
  return { id: c.id, roles: c.roles, ip: c.ip };
}

export async function attribuer(dossierId: number, referentId: string, motif: string) {
  return executer(async () => {
    const r = await reaffecter(dossierId, referentId, motif, await direction());
    revalidatePath('/admin/attribution');
    revalidatePath('/admin/dossiers');
    return r.avertissements.length ? `Dossier attribué (attention : ${r.avertissements.join(', ')}).` : 'Dossier attribué.';
  });
}

export async function reaffecterSelection(dossierIds: number[], referentId: string, motif: string) {
  return executer(async () => {
    const r = await reaffecterEnMasse(dossierIds, referentId, motif, await direction());
    revalidatePath('/admin/attribution');
    revalidatePath('/admin/dossiers');
    const echecs = r.filter((x) => !x.ok);
    return echecs.length
      ? `${r.length - echecs.length} dossier(s) réaffecté(s), ${echecs.length} en échec : ${echecs.map((x) => x.erreur).join(' ; ')}`
      : `${r.length} dossier(s) réaffecté(s).`;
  });
}
