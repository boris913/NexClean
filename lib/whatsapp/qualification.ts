// COM2-01 RG-06 : pré-qualification d'un premier message WhatsApp — module pur.
// Le type et le lieu sont des suppositions : le référent les corrige (RG-07, changement de type).
import type { DossierType } from '@/lib/domain/referentiels';

const normaliser = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** Mots-clés par type, du plus spécifique au plus général (le premier qui correspond l'emporte). */
const MOTS: [DossierType, string[]][] = [
  ['RCL', ['reclamation', 'plainte', 'pas satisfait', 'mecontent', 'rembours']],
  ['PAR', ['partenariat', 'partenaire', 'collaboration', 'sous traitance']],
  ['ABO', ['abonnement', 'chaque semaine', 'chaque mois', 'contrat mensuel', 'forfait mensuel']],
  ['EV', ['jardin', 'gazon', 'pelouse', 'espaces verts', 'espace vert', 'elagage', 'debroussaill', 'haie', 'arrosage', 'paysag']],
  ['MAD', ['mise a disposition', 'interim', 'agent d entretien pour', 'personnel temporaire', 'renfort']],
  ['REC', ['menagere', 'menager', 'nounou', 'baby sitter', 'gardien', 'chauffeur', 'cuisiniere', 'cuisinier', 'aide menagere', 'domestique', 'recrut', 'employe', 'employee', 'personnel', 'serveur', 'serveuse', 'vigile', 'agent de securite', 'caissiere', 'receptionniste', 'cherche une fille', 'cherche un gars']],
  ['NET', ['menage', 'nettoyage', 'nettoyer', 'proprete', 'vitres', 'desinfect', 'fin de chantier', 'grand nettoyage', 'bureaux', 'moquette', 'canape']],
];

/** Type de dossier le plus probable d'après le texte ; Nettoyage par défaut (activité principale). */
export function typeProbable(texte: string): DossierType {
  const t = normaliser(texte);
  for (const [type, mots] of MOTS) if (mots.some((m) => t.includes(` ${m}`))) return type;
  return 'NET';
}

/** Intitulés reconnus pour un premier poste de recrutement (un Dossier REC exige au moins un poste). */
const POSTES: [string, string][] = [
  ['aide menagere', 'Aide ménagère'],
  ['menagere', 'Ménagère'],
  ['menager', 'Agent ménager'],
  ['nounou', 'Nounou'],
  ['baby sitter', 'Baby-sitter'],
  ['gardien', 'Gardien'],
  ['vigile', 'Vigile'],
  ['agent de securite', 'Agent de sécurité'],
  ['chauffeur', 'Chauffeur'],
  ['cuisiniere', 'Cuisinière'],
  ['cuisinier', 'Cuisinier'],
  ['serveuse', 'Serveuse'],
  ['serveur', 'Serveur'],
  ['caissiere', 'Caissière'],
  ['receptionniste', 'Réceptionniste'],
];

/** Intitulé du poste cité, sinon « Poste à préciser » (le référent complète). */
export function posteProbable(texte: string): string {
  const t = normaliser(texte);
  return POSTES.find(([m]) => t.includes(` ${m}`))?.[1] ?? 'Poste à préciser';
}

export interface ListeLieux {
  id: number;
  nom: string;
  quartiers: { id: number; nom: string }[];
}

/**
 * Ville et quartier cités dans le texte, comparés au référentiel. Un quartier dont le nom existe
 * dans plusieurs villes n'est retenu que si la ville est aussi citée.
 */
export function lieuProbable(texte: string, lieux: ListeLieux[]): { villeId: number | null; quartierId: number | null } {
  const t = normaliser(texte);
  const cite = (nom: string) => {
    const n = normaliser(nom).trim();
    return n.length >= 3 && t.includes(` ${n} `);
  };
  const villes = lieux.filter((v) => cite(v.nom));
  const quartiers = lieux.flatMap((v) => v.quartiers.filter((q) => cite(q.nom)).map((q) => ({ villeId: v.id, quartierId: q.id })));
  const dansVilleCitee = quartiers.filter((q) => villes.some((v) => v.id === q.villeId));
  const choix = dansVilleCitee[0] ?? (new Set(quartiers.map((q) => q.villeId)).size === 1 ? quartiers[0] : undefined);
  if (choix) return choix;
  return { villeId: villes.length === 1 ? villes[0]!.id : null, quartierId: null };
}
