// RG-10 : libellés des statuts d'évaluation de l'agent.
export const STATUTS_EVALUATION = {
  en_cours: { libelle: 'En cours', ton: 'bleu' },
  reussie: { libelle: 'Réussie', ton: 'vert' },
  echouee: { libelle: 'Échouée', ton: 'rouge' },
  erreur: { libelle: 'Erreur', ton: 'orange' },
} as const;

export const statutEvaluation = (s: string) => STATUTS_EVALUATION[s as keyof typeof STATUTS_EVALUATION] ?? STATUTS_EVALUATION.erreur;
