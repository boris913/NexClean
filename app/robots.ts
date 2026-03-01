import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt généré automatiquement.
 * Accessible sur : /robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Bloquer les URLs internes Next.js inutiles pour le crawl
        disallow: [
          '/api/',
          '/_next/',
          '/static/',
        ],
      },
      // Autoriser explicitement Googlebot (images incluses)
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
      // Autoriser Googlebot-Image pour les photos de réalisations
      {
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
    ],
    // Sitemap déclaré dans robots.txt — Google l'indexe automatiquement
    sitemap: `${SITE_URL}/sitemap.xml`,
    // Host canonique (évite duplicate content www vs non-www)
    host: SITE_URL,
  };
}
