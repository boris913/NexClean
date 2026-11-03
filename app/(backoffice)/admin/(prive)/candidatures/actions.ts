'use server';
// Actions de la liste « Candidatures » (MVP2-02 RG-09, RG-10). Chaque action vérifie l'accès au
// vivier (journalisé en cas de refus) ; le service contrôle en plus la portée (référent / Direction).
import { revalidatePath } from 'next/cache';
import { executer } from '@/lib/actions';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { changerStatutCandidature, definirResponsablesOffre } from '@/lib/candidats/candidatures';
import { ErreurMetier } from '@/lib/collaborateurs/service';

export async function traiterCandidature(candidatureId: number, vers: 'retenue' | 'refusee') {
  return executer(async () => {
    if (vers !== 'retenue' && vers !== 'refusee') throw new ErreurMetier('Statut inconnu.');
    const c = await exigerAccesVivier('candidat.traiter', { candidatureId });
    await changerStatutCandidature(Number(candidatureId), vers, { id: c.id, roles: c.roles, ip: c.ip });
    revalidatePath('/admin/candidatures');
    return vers === 'retenue' ? 'Candidature retenue.' : 'Candidature refusée.';
  });
}

export async function enregistrerResponsables(slug: string, userIds: string[]) {
  return executer(async () => {
    const c = await exigerAccesVivier('offre.responsables', { offre: slug });
    await definirResponsablesOffre(String(slug), Array.isArray(userIds) ? userIds.map(String) : [], { id: c.id, roles: c.roles, ip: c.ip });
    revalidatePath('/admin/candidatures/offres');
    return 'Responsables enregistrés.';
  });
}
