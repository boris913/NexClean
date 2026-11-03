'use server';
// MVP1-04 RG-01 : enregistrement d'une demande de devis avant l'ouverture de WhatsApp.
import { headers } from 'next/headers';
import { ipDepuisEnTetes } from '@/lib/audit';
import { listesLieux } from '@/lib/geo/service';
import { soumettreDemandeDevis, type ResultatDevis } from '@/lib/dossiers/demande-devis';

export async function enregistrerDemandeDevis(entree: unknown): Promise<ResultatDevis> {
  try {
    return await soumettreDemandeDevis(entree, { ip: ipDepuisEnTetes(await headers()) });
  } catch (e) {
    console.error('Demande de devis : échec de l’enregistrement', e);
    return { ok: false, erreur: 'Enregistrement impossible.' };
  }
}

/** Listes Ville → Quartier du référentiel pour les formulaires des pages statiques. */
export async function chargerLieux() {
  return listesLieux();
}
