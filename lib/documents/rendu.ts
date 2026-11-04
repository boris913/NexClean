// Rendu PDF des documents (specs/MVP2-04 RG-16, RG-19, RG-20). Points d'entrée partagés :
// les services (devis, factures, page de suivi) les appellent ; l'implémentation (pdf-lib,
// mise en page commune, en-tête et mentions légales) est dans ce fichier.
// Chaque fonction lit les données figées en base et renvoie les octets du PDF (A4 portrait,
// police ≥ 10 pt, < 300 Ko).

/** Devis ou avenant (DEV-AAAA-NNNNN, version) — valeurs figées de la ligne `devis`. */
export async function genererPdfDevis(_devisId: number): Promise<Uint8Array> {
  throw new Error('genererPdfDevis : à implémenter (MVP2-04, lot documents).');
}

/** Facture d'acompte, de solde ou avoir — valeurs figées de la ligne `facture`. */
export async function genererPdfFacture(_factureId: number): Promise<Uint8Array> {
  throw new Error('genererPdfFacture : à implémenter (MVP2-04, lot documents).');
}

/** Accusé de réception d'un Dossier REC (numéro de dossier). */
export async function genererAccuseReception(_dossierId: number): Promise<Uint8Array> {
  throw new Error('genererAccuseReception : à implémenter (MVP2-04, lot documents).');
}
