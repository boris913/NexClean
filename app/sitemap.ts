import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Sitemap XML généré automatiquement par Next.js App Router.
 * Accessible sur : /sitemap.xml
 *
 * À soumettre dans Google Search Console après déploiement :
 * https://search.google.com/search-console → Sitemaps → Ajouter https://nexclean.cm/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    // ─── Page principale ──────────────────────────────────────
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },

    // ─── Sections de la page (ancres) ────────────────────────
    // Google comprend les ancres et les indexe comme contenu
    {
      url: `${SITE_URL}/#services`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/#tarifs`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/#realisations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/#temoignages`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/#contact`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/#faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
