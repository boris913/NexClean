// Couverture annoncée par le site public (M1-GEO-05) : villes couvertes et quartiers mis en avant,
// lus dans le référentiel géographique. Remplace CITIES (lib/constants.ts) et content/zones-coverage.ts.
//
// Les pages publiques restent pré-générées : la lecture est mise en cache (10 min au plus) et
// invalidée dès qu'une entrée du référentiel change (revaliderCouverture, appelée par le Back-Office).
// Base injoignable (build de l'image, incident) : on retombe sur COUVERTURE_PAR_DEFAUT.
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { couverturePublique, type CouverturePublique } from '@/lib/geo/service';

export interface Couverture extends CouverturePublique {
  /** « Douala », « Douala et Yaoundé », « Douala, Yaoundé et Kribi »… */
  libelle: string;
}

const TAG = 'couverture-publique';
export const DUREE_CACHE_COUVERTURE = 600;

/** Liste lisible en français : « A », « A et B », « A, B et C ». Sans ville : « Cameroun ». */
export function libelleVilles(villes: string[]): string {
  if (villes.length === 0) return 'Cameroun';
  if (villes.length === 1) return villes[0]!;
  return `${villes.slice(0, -1).join(', ')} et ${villes.at(-1)}`;
}

/** Valeur de secours, alignée sur le référentiel de production au moment de l'écriture. */
export const COUVERTURE_PAR_DEFAUT: Couverture = {
  villes: ['Douala', 'Yaoundé'],
  libelle: 'Douala et Yaoundé',
  quartiers: [{ ville: 'Douala', noms: ['Akwa', 'Bali', 'Bonamoussadi', 'Bonanjo', 'Bonapriso', 'Deido', 'Makepe', 'New Bell'] }],
};

const lireEnCache = unstable_cache(couverturePublique, [TAG], { tags: [TAG], revalidate: DUREE_CACHE_COUVERTURE });

export async function lireCouverture(): Promise<Couverture> {
  try {
    const c = await lireEnCache();
    return { ...c, libelle: libelleVilles(c.villes) };
  } catch {
    return COUVERTURE_PAR_DEFAUT;
  }
}

/** À appeler après toute modification du référentiel : le site public reflète le changement immédiatement. */
export function revaliderCouverture() {
  revalidateTag(TAG);
  revalidatePath('/', 'layout');
}
