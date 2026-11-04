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
  // Modèles candidat (MVP2-02) : proposés sur la fiche candidat, jamais dans un dossier.
  'candidat.prenom': 'Prénom du candidat',
  'candidat.nom': 'Nom du candidat',
  'candidat.lien_espace': 'Lien de l’espace candidat',
  'candidat.lien_profil': 'Lien pour compléter le profil candidat',
  'candidat.lien_reinitialisation': 'Lien de réinitialisation du mot de passe (généré par le référent)',
  // Modèles de proposition (MVP2-03) : proposés sur une Proposition du dossier, jamais ailleurs.
  'poste.intitule': 'Intitulé du poste proposé',
  'proposition.client': 'Client de la proposition',
  'proposition.candidat': 'Candidat proposé (prénom et initiale du nom)',
  'proposition.lien_profil': 'Lien d’accès temporaire au profil (généré à l’envoi, 7 jours)',
  'entretien.date': 'Date et heure de l’entretien',
  'entretien.lieu': 'Lieu de l’entretien',
  'placement.date': 'Date de prise de poste prévue',
  'placement.lien_attestation': 'Lien d’accès temporaire à l’attestation de prise de poste (généré à l’envoi)',
} as const;

export type Variable = keyof typeof VARIABLES;
export type ContexteMessage = Partial<Record<Variable, string>>;

const RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export const variablesDe = (texte: string) => [...texte.matchAll(RE)].map((m) => m[1]!);

/** Première variable inconnue du texte, ou null (RG-15 : bloque l'enregistrement). */
export function variableInconnue(texte: string): string | null {
  return variablesDe(texte).find((v) => !(v in VARIABLES)) ?? null;
}

/** Modèle destiné aux candidats : il utilise au moins une variable `candidat.*` (MVP2-02). */
export const estModeleCandidat = (texte: string) => variablesDe(texte).some((v) => v.startsWith('candidat.'));

const PREFIXES_PROPOSITION = ['poste.', 'proposition.', 'entretien.', 'placement.'];

/**
 * Modèle lié à une Proposition (MVP2-03) : il utilise une variable `poste.*`, `proposition.*`,
 * `entretien.*` ou `placement.*`. Il n'est proposé que sur une Proposition (au candidat s'il utilise
 * aussi une variable `candidat.*`, sinon au client), jamais dans la liste du dossier ni de la fiche candidat.
 */
export const estModeleProposition = (texte: string) => variablesDe(texte).some((v) => PREFIXES_PROPOSITION.some((p) => v.startsWith(p)));

/** Remplace les variables ; une valeur absente donne une chaîne vide. */
export const rendreMessage = (texte: string, ctx: ContexteMessage) => texte.replace(RE, (_, v: string) => ctx[v as Variable] ?? '');
