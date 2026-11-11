// Contrôles métier des sorties IA — module pur (specs/COM3-01 RG-07, RG-11).

// \s couvre aussi les espaces insécables (U+00A0, U+202F) des montants formatés en français.
const normaliserNombre = (s: string) => s.replace(/\s/g, '').replace(',', '.').replace(/^0+(?=\d)/, '');

/** Nombres cités dans un texte (« 12 », « 150 000 », « 40 % », « 2,5 »), normalisés. */
export function nombresCites(texte: string): string[] {
  return [...texte.matchAll(/\d{1,3}(?:\s\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g)].map((m) => normaliserNombre(m[0]));
}

/** Tous les nombres présents dans les agrégats (valeurs et textes), normalisés. */
export function nombresAutorises(agregats: unknown): Set<string> {
  const out = new Set<string>();
  const visiter = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.add(String(v));
    else if (typeof v === 'string') nombresCites(v).forEach((n) => out.add(n));
    else if (Array.isArray(v)) v.forEach(visiter);
    else if (v && typeof v === 'object') Object.values(v).forEach(visiter);
  };
  visiter(agregats);
  return out;
}

/**
 * RG-11 : un commentaire n'est accepté que si chaque nombre cité figure dans les agrégats fournis.
 * Renvoie la liste des nombres inventés (vide = accepté).
 */
export function nombresInventes(commentaire: string, agregats: unknown): string[] {
  const autorises = nombresAutorises(agregats);
  return [...new Set(nombresCites(commentaire).filter((n) => !autorises.has(n)))];
}

/** RG-07 / brouillons : jamais de prix dans un texte proposé par l'IA. */
export const contientMontant = (texte: string) => /\d[\d\s.]*\s?(f\s?cfa|fcfa|xaf|francs?)\b/i.test(texte);

/** « MOMENT : demain vers 10 h\n\nmessage » → { moment, message }. */
export function lireRelance(texte: string): { moment: string | null; message: string } {
  const m = texte.match(/^\s*MOMENT\s*:\s*(.+?)\s*\n\s*\n([\s\S]+)$/i);
  return m ? { moment: m[1]!.trim(), message: m[2]!.trim() } : { moment: null, message: texte.trim() };
}
