// Variables des modèles de messages WhatsApp (MVP1-05 RG-15). Module pur.

export const VARIABLES = {
  'client.contact': 'Nom du contact (ou du client)',
  'client.nom': 'Nom du client / de l’entreprise',
  'dossier.numero': 'Numéro du dossier',
  'dossier.type': 'Type de dossier',
  'dossier.ville': 'Ville du dossier',
  'dossier.lien_suivi': 'Lien de la page de suivi',
  'referent.prenom': 'Prénom du référent',
  'referent.telephone': 'Téléphone du référent',
  'postes.resume': 'Résumé des postes (recrutement)',
} as const;

export type Variable = keyof typeof VARIABLES;
export type ContexteMessage = Partial<Record<Variable, string>>;

const RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export const variablesDe = (texte: string) => [...texte.matchAll(RE)].map((m) => m[1]!);

/** Première variable inconnue du texte, ou null (RG-15 : bloque l'enregistrement). */
export function variableInconnue(texte: string): string | null {
  return variablesDe(texte).find((v) => !(v in VARIABLES)) ?? null;
}

/** Remplace les variables ; une valeur absente donne une chaîne vide. */
export const rendreMessage = (texte: string, ctx: ContexteMessage) => texte.replace(RE, (_, v: string) => ctx[v as Variable] ?? '');
