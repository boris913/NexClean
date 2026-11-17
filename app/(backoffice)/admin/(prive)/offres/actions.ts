'use server';
// ADR 0013 : administration des offres d'emploi (Direction, Référents du service Recrutement).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { executer } from '@/lib/actions';
import { changerStatutOffre, creerOffre, modifierOffre, supprimerBrouillon, type ActeurOffre } from '@/lib/offres/service';
import { revaliderOffres } from '@/lib/offres/publiques';
import type { EntreeOffre, StatutOffre } from '@/lib/offres/domaine';
import type { ResultatAction } from '@/components/backoffice/ui';

async function acteur(): Promise<ActeurOffre> {
  const c = await exigerAccesVivier('offre.gerer');
  return { id: c.id, roles: c.roles, ip: c.ip };
}

export async function creer(entree: EntreeOffre): Promise<ResultatAction> {
  let id: number | null = null;
  const r = await executer(async () => {
    id = await creerOffre(entree, await acteur());
    revalidatePath('/admin/offres');
  });
  if (r.ok && id !== null) redirect(`/admin/offres/${id}?cree=1`);
  return r;
}

export async function modifier(id: number, slug: string, entree: EntreeOffre): Promise<ResultatAction> {
  return executer(async () => {
    await modifierOffre(id, entree, await acteur());
    revalidatePath('/admin/offres');
    revalidatePath(`/admin/offres/${id}`);
    revaliderOffres(slug);
    return 'Offre enregistrée.';
  });
}

export async function changerStatut(id: number, vers: StatutOffre, motif: string | null): Promise<ResultatAction> {
  return executer(async () => {
    const { slug } = await changerStatutOffre(id, vers, motif, await acteur());
    revalidatePath('/admin/offres');
    revalidatePath(`/admin/offres/${id}`);
    revaliderOffres(slug);
    return vers === 'publiee' ? 'Offre publiée : elle est visible sur le site.' : 'Offre fermée : elle reste consultable, sans possibilité de postuler.';
  });
}

export async function supprimer(id: number): Promise<ResultatAction> {
  const r = await executer(async () => {
    await supprimerBrouillon(id, await acteur());
    revalidatePath('/admin/offres');
  });
  if (r.ok) redirect('/admin/offres');
  return r;
}
