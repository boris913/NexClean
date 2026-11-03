'use server';
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { soumettreDemandePersonnel, type ResultatEnvoi } from '@/lib/dossiers/demande-personnel';

export async function envoyerDemandePersonnel(entree: unknown): Promise<ResultatEnvoi> {
  try {
    return await soumettreDemandePersonnel(entree, { ip: ipDepuisEnTetes(await headers()) });
  } catch (e) {
    console.error('Demande de personnel : échec de l’envoi', e);
    return { ok: false, erreur: 'L’envoi a échoué. Vos informations sont conservées : réessayez ou envoyez votre demande sur WhatsApp.' };
  }
}
