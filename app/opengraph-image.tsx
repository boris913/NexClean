import { renderOgImage, OG_ALT, OG_SIZE } from '@/lib/og-image';
import { lireCouverture } from '@/lib/geo/couverture';

export const runtime = 'nodejs';
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

export const revalidate = 600; // = DUREE_CACHE_COUVERTURE (valeur littérale exigée par Next.js)

export default async function Image() {
  return renderOgImage((await lireCouverture()).libelle);
}
