'use server';
// MVP2-04 : actions de la section « Factures » d'un dossier. Droits revérifiés côté serveur
// (lib/devis/facturation.ts). Aucune modification de facture n'existe : une erreur se corrige
// par un avoir (Direction, RG-17).
import { revalidatePath } from 'next/cache';
import { exigerCollaborateur } from '@/lib/authz/session';
import { executer } from '@/lib/actions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { emettreAvoirCorrection, genererPdfFactureBackOffice } from '@/lib/devis/facturation';

const rafraichir = (dossierId: number) => revalidatePath(`/admin/dossiers/${dossierId}`);

export async function genererPdfFacture(dossierId: number, factureId: number) {
  return executer(async () => {
    const c = await exigerCollaborateur();
    await genererPdfFactureBackOffice(factureId, { id: c.id, roles: c.roles });
    rafraichir(dossierId);
    return 'PDF généré et archivé dans les documents du dossier.';
  });
}

export async function emettreAvoir(dossierId: number, factureId: number, motif: string) {
  return executer(async () => {
    const c = await exigerCollaborateur();
    if (motif.length > 500) throw new ErreurMetier('Motif trop long (500 caractères maximum).');
    const avoir = await emettreAvoirCorrection(factureId, motif, { id: c.id, roles: c.roles, ip: c.ip });
    rafraichir(dossierId);
    return `Avoir ${avoir.numero} émis.`;
  });
}
