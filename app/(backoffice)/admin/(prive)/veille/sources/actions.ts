'use server';
// COM4-01 RG-04, RG-05 : administration des sources de veille (Direction), journalisée.
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { iaActive } from '@/lib/ia/client';
import { collecterSource, enregistrerSource, listerSources, type schemaSource } from '@/lib/veille/sources';
import type { z } from 'zod';

async function auteur() {
  const c = await exigerCollaborateur({ permission: 'veille.gerer' });
  return { id: c.id, ip: c.ip };
}

export async function enregistrer(id: number | null, entree: z.input<typeof schemaSource>) {
  return executer(async () => {
    await enregistrerSource(id, entree, await auteur());
    revalidatePath('/admin/veille/sources');
    return 'Source enregistrée.';
  });
}

/** Collecte immédiate d'une source (essai), avec qualification par l'IA des nouveaux éléments. */
export async function collecterMaintenant(id: number) {
  return executer(async () => {
    await auteur();
    if (!iaActive()) throw new ErreurMetier('La clé de l’API IA n’est pas configurée : la collecte automatique est inactive.');
    const s = (await listerSources()).find((x) => x.id === id);
    if (!s) throw new ErreurMetier('Source introuvable.');
    const b = await collecterSource(s);
    revalidatePath('/admin/veille/sources');
    revalidatePath('/admin/veille');
    return `${b.lus} élément(s) lu(s), ${b.retenus} correspondant aux requêtes, ${b.pistes} nouvelle(s) piste(s).`;
  });
}
