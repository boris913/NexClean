// Archivage des documents générés dans les Documents du Dossier (specs/MVP2-04 RG-16, RG-19).
// Appelé **après** la transaction métier : un échec d'archivage ne fait jamais échouer
// l'opération (journalisé en console, le document reste régénérable).
import { archiverPdf, type AuteurEffet } from '@/lib/devis/effets';
import { donneesAttestation, nomFichierAttestation } from '@/lib/propositions/client';
import { genererAttestation } from '@/lib/propositions/pdf';
import { genererAccuseReception } from './rendu';

async function sansEchec<T>(quoi: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error(`Archivage impossible (${quoi}) :`, e);
    return null;
  }
}

/** RG-16 : attestation de prise de poste pré-remplie, archivée à l'annonce du Placement. */
export function archiverAttestation(placementId: number, auteur: AuteurEffet): Promise<{ documentId: number; empreinte: string } | null> {
  return sansEchec(`attestation du placement ${placementId}`, async () => {
    const d = await donneesAttestation(placementId);
    if (!d) throw new Error('Placement introuvable.');
    return archiverPdf(d.dossierId, nomFichierAttestation(d.numeroDossier, d.candidatPrenom), await genererAttestation(d), 'attestation', auteur);
  });
}

/** RG-16 : accusé de réception d'un Dossier REC (à appeler après sa création). */
export function archiverAccuseReception(dossierId: number, numeroDossier: string, auteur: AuteurEffet): Promise<{ documentId: number; empreinte: string } | null> {
  return sansEchec(`accusé de réception du dossier ${dossierId}`, async () => archiverPdf(dossierId, `Accuse-de-reception-${numeroDossier}.pdf`, await genererAccuseReception(dossierId), 'accuse_reception', auteur));
}
