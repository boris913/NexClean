// Offres lues par le site public (/recrutement, fiche, accueil, sitemap) : publiées et fermées,
// jamais les brouillons. Lecture mise en cache (10 min au plus) et invalidée par le Back-Office
// à chaque création, modification, publication ou fermeture (revaliderOffres), comme la couverture.
// Base injoignable (build de l'image, incident) : liste vide, la page reste lisible.
import { asc, desc, inArray, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getDb, schema } from '@/lib/db';
import { versPublique, type OffrePublique } from './domaine';

const TAG = 'offres-publiques';

async function lireDepuisBase(): Promise<OffrePublique[]> {
  const r = await getDb()
    .select()
    .from(schema.offre)
    .where(inArray(schema.offre.statut, ['publiee', 'fermee']))
    .orderBy(sql`case ${schema.offre.statut} when 'publiee' then 0 else 1 end`, asc(schema.offre.ordre), desc(schema.offre.publieeLe), desc(schema.offre.creeLe));
  return r.map(versPublique).filter((o): o is OffrePublique => o !== null);
}

const lireEnCache = unstable_cache(lireDepuisBase, [TAG], { tags: [TAG], revalidate: 600 });

/** Offres ouvertes d'abord (ordre choisi, puis les plus récentes), puis les fermées. */
export async function offresPubliques(): Promise<OffrePublique[]> {
  try {
    return await lireEnCache();
  } catch (e) {
    console.error('Offres indisponibles', e);
    return [];
  }
}

export async function offresOuvertes(): Promise<OffrePublique[]> {
  return (await offresPubliques()).filter((o) => o.status === 'open');
}

export async function offreParSlug(slug: string): Promise<OffrePublique | undefined> {
  return (await offresPubliques()).find((o) => o.slug === slug);
}

/** À appeler après toute écriture sur une offre : le site public reflète le changement immédiatement. */
export function revaliderOffres(slug?: string) {
  revalidateTag(TAG);
  revalidatePath('/recrutement');
  if (slug) revalidatePath(`/recrutement/${slug}`);
  revalidatePath('/');
  revalidatePath('/sitemap.xml');
}
