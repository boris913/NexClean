'use server';
// Actions de la liste des candidats (MVP2-02). Les droits sont revérifiés à chaque appel :
// accès au vivier (Direction, ou Référent avec le service Recrutement) puis contrôle par candidat
// dans changerStatutCandidat (un Référent ne traite que ses candidats).
import { revalidatePath } from 'next/cache';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { exigerAccesVivier } from '@/lib/candidats/acces-page';
import { changerStatutCandidat, STATUTS_TRAITEMENT_FILE } from '@/lib/candidats/attribution';
import { STATUTS_CANDIDAT, type StatutCandidat } from '@/lib/candidats/domaine';

/** RG-02 : traitement rapide depuis la file « Nouveaux candidats ». */
export async function traiterDepuisFile(candidatId: number, statut: StatutCandidat) {
  return executer(async () => {
    if (!Number.isInteger(candidatId) || candidatId <= 0) throw new ErreurMetier('Candidat introuvable.');
    if (!STATUTS_TRAITEMENT_FILE.includes(statut)) throw new ErreurMetier('Statut non proposé depuis la file.');
    const c = await exigerAccesVivier('candidat.traiter', { candidatId });
    await changerStatutCandidat(candidatId, statut, { id: c.id, roles: c.roles, ip: c.ip });
    revalidatePath('/admin/candidats');
    revalidatePath('/admin');
    return statut === 'nouveau' ? 'Le candidat reste dans la file.' : `Statut : ${STATUTS_CANDIDAT[statut]}.`;
  });
}
