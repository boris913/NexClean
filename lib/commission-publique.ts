// Commission par personne affichée par le simulateur de l'accueil (audit design A1).
// Les pages publiques restent pré-générées : lecture mise en cache (10 min au plus), invalidée
// dès que la commission est modifiée dans le Back-Office (revaliderCommissionPublique).
// Base injoignable (build de l'image, incident) : on retombe sur la commission par défaut (ADR 0008).
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { COMMISSION_PAR_DEFAUT, lireParametre } from '@/lib/parametres';

const TAG = 'commission-publique';

const lireEnCache = unstable_cache(() => lireParametre('commission_par_personne'), [TAG], { tags: [TAG], revalidate: 600 });

export async function lireCommissionPublique(): Promise<number> {
  try {
    return await lireEnCache();
  } catch {
    return COMMISSION_PAR_DEFAUT;
  }
}

/** À appeler après toute modification de la commission par personne. */
export function revaliderCommissionPublique() {
  revalidateTag(TAG);
  revalidatePath('/');
}
