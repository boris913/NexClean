import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllPostSlugs } from '@/lib/blog';
import { servicePages } from '@/content/services-data';
import { products } from '@/content/products-data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllPostSlugs();
  const now = new Date();

  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page('', 1.0, 'weekly'),
    page('/services', 0.9),
    ...servicePages.map((s) => page(`/services/${s.slug}`, 0.9)),
    page('/espaces-verts', 0.9),
    page('/particuliers', 0.8),
    page('/professionnels', 0.8),
    page('/abonnements', 0.8),
    page('/realisations', 0.7, 'weekly'),
    page('/boutique', 0.8, 'weekly'),
    ...products.map((p) => page(`/boutique/${p.slug}`, 0.7)),
    page('/tarifs', 0.8),
    page('/a-propos', 0.6),
    page('/recrutement', 0.7, 'weekly'),
    page('/contact', 0.8, 'yearly'),
    page('/blog', 0.7, 'daily'),
    ...slugs.map((slug) => page(`/blog/${slug}`, 0.6, 'monthly')),
    page('/mentions-legales', 0.2, 'yearly'),
    page('/confidentialite', 0.2, 'yearly'),
    page('/cgv', 0.2, 'yearly'),
  ];
}
