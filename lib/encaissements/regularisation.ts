// Clôture financière, trop-perçu, remboursements, crédit client, impayés (specs/MVP2-05 §3, §4).
// Implémenté par le lot B ; ce fichier expose dès le socle le point d'appel utilisé par
// `changerStatut` (lot A) lors d'un passage à « Sans suite ».
import type { AuteurEffet, Tx } from '@/lib/devis/effets';

/**
 * Cas limite « Dossier Sans suite après acompte » : traité comme une clôture de recherche
 * anticipée avec motif (placements confirmés dus, le reste suit RG-10). Appelé **dans la
 * transaction** de `changerStatut` avant le passage à « Sans suite » d'un Dossier REC.
 * À IMPLÉMENTER (lot B) — sans effet tant que non implémenté.
 */
export async function regulariserSansSuite(_tx: Tx, _dossierId: number, _motif: string, _auteur: AuteurEffet): Promise<void> {}
