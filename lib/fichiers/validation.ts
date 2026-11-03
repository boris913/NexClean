// Contrôle des fichiers téléversés (M1-DOC-02) : type réel vérifié par signature
// binaire, taille ≤ 5 Mo, DOCX à macros refusés. Fonction pure, testable.

export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;

export type TypeFichier = 'pdf' | 'jpeg' | 'png' | 'webp' | 'docx';

export const MIME: Record<TypeFichier, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const EXTENSIONS: Record<string, TypeFichier> = { pdf: 'pdf', jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', docx: 'docx' };

const commencePar = (b: Uint8Array, sig: number[], decalage = 0) => sig.every((octet, i) => b[decalage + i] === octet);

/** Détecte le type réel à partir du contenu ; null si non reconnu. */
export function detecterType(octets: Uint8Array): TypeFichier | null {
  if (commencePar(octets, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (commencePar(octets, [0x52, 0x49, 0x46, 0x46]) && commencePar(octets, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF....WEBP
  if (commencePar(octets, [0x50, 0x4b, 0x03, 0x04])) {
    // Un .docx est une archive ZIP contenant « word/ » ; une macro ajoute vbaProject.bin.
    const contenu = new TextDecoder('latin1').decode(octets);
    if (contenu.includes('word/') && !/vbaProject\.bin/i.test(contenu)) return 'docx';
  }
  return null;
}

export type ResultatValidation = { ok: true; type: TypeFichier; mime: string } | { ok: false; erreur: string };

export function validerFichier(nom: string, octets: Uint8Array): ResultatValidation {
  if (octets.byteLength === 0) return { ok: false, erreur: 'Fichier vide.' };
  if (octets.byteLength > TAILLE_MAX_OCTETS) return { ok: false, erreur: 'Fichier trop volumineux (5 Mo maximum).' };
  const extension = EXTENSIONS[nom.toLowerCase().split('.').pop() ?? ''];
  const type = detecterType(octets);
  // L'extension doit correspondre au contenu réel (un .pdf qui est un exécutable est refusé).
  if (!type || !extension || extension !== type) return { ok: false, erreur: 'Format de fichier non accepté.' };
  return { ok: true, type, mime: MIME[type] };
}
