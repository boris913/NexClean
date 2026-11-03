'use server';
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { enregistrerModele, type schemaModele } from '@/lib/modeles/service';
import type { z } from 'zod';

export async function enregistrer(id: number | null, entree: z.input<typeof schemaModele>) {
  return executer(async () => {
    const c = await exigerCollaborateur({ permission: 'modeles.gerer' });
    await enregistrerModele(id, entree, { id: c.id, ip: c.ip });
    revalidatePath('/admin/modeles');
    return id === null ? 'Modèle créé.' : 'Modèle enregistré.';
  });
}
