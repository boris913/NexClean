// Adresse des pages par ville (specs/COM1-01 RG-11) : « Yaoundé » → /zones/yaounde.
// Pur : utilisable côté serveur, client et dans les tests.

/** « Yaoundé » → « yaounde », « Bafoussam II » → « bafoussam-ii ». */
export function slugVille(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Ville couverte correspondant au slug, ou null (ville inconnue ou plus couverte → 404). */
export function villeDepuisSlug(villes: readonly string[], slug: string): string | null {
  return villes.find((v) => slugVille(v) === slug) ?? null;
}

export const cheminVille = (nom: string) => `/zones/${slugVille(nom)}`;
