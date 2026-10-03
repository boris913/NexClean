// ============================================================
// SEO CONFIGURATION — NexClean
// Toute la configuration SEO centralisée ici. Les données structurées
// sont générées à partir des fichiers de contenu (aucune duplication).
// ============================================================

import type { Metadata } from 'next';
import { CONTACT, SOCIAL_MEDIA, FAQ, PAYMENT_TERMS, CITIES_LABEL, ACTIVE_CITIES, getWhatsAppLink } from '@/lib/constants';
import { services, getServiceHref, type Service } from '@/content/services-data';
import { activeZones } from '@/content/zones-coverage';
import type { Product } from '@/content/products-data';

export const SITE_URL = 'https://nexclean.xyz';
export const SITE_NAME = 'NexClean';
export const SITE_LOCALE = 'fr_CM';

// ─── Métadonnées globales ────────────────────────────────────
export const DEFAULT_TITLE = `NexClean — Nettoyage professionnel & entretien à ${CITIES_LABEL}, Cameroun`;
export const DEFAULT_DESCRIPTION = `NexClean : nettoyage de maisons et bureaux, fin de chantier, vitres, entretien d'espaces verts et produits d'entretien à ${CITIES_LABEL}. Devis gratuit sur WhatsApp.`;

export const TITLE_TEMPLATE = '%s | NexClean';

// ─── Mots-clés ciblés (longue traîne + locaux) ───────────────
export const DEFAULT_KEYWORDS = [
  'nettoyage Douala',
  'entreprise nettoyage Douala',
  'nettoyage professionnel Douala',
  'nettoyage maison Douala',
  'nettoyage bureau Douala',
  'nettoyage fin de chantier Douala',
  'nettoyage vitres Douala',
  'entretien espaces verts Douala',
  'désinfection Douala',
  'produit nettoyage Cameroun',
  'recrutement agent de nettoyage Douala',
  'nettoyage professionnel Cameroun',
  'NexClean',
].join(', ');

// ─── Open Graph Image ────────────────────────────────────────
// URL absolue obligatoire pour Facebook, WhatsApp, LinkedIn.
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: DEFAULT_TITLE,
};

/** Métadonnées standard d'une page interne (titre, description, canonical, OG). */
export function pageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title: `${title} | NexClean`,
      description,
      url: `${SITE_URL}${path}`,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [image ? { url: `${SITE_URL}${image}` } : { url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
    },
  };
}

// ─── Schema.org — LocalBusiness ──────────────────────────────
// Pas d'aggregateRating : à ajouter uniquement à partir d'avis réels et traçables.
export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#organization`,
  name: 'NexClean',
  legalName: 'NEXCLEAN SARL',
  description: DEFAULT_DESCRIPTION,
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  image: `${SITE_URL}/opengraph-image`,
  telephone: CONTACT.phone,
  email: CONTACT.email,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Douala',
    addressRegion: 'Littoral',
    addressCountry: 'CM',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '4.0511',
    longitude: '9.7679',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '07:00',
      closes: '19:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday'],
      opens: '08:00',
      closes: '17:00',
    },
  ],
  priceRange: 'FCFA',
  currenciesAccepted: 'XAF',
  paymentAccepted: PAYMENT_TERMS.methods.join(', '),
  areaServed: [
    ...ACTIVE_CITIES.map((c) => ({ '@type': 'City', name: c })),
    ...activeZones.map((z) => ({ '@type': 'Place', name: `${z.name}, ${z.city}` })),
  ],
  sameAs: [SOCIAL_MEDIA.facebook, SOCIAL_MEDIA.instagram, SOCIAL_MEDIA.tiktok, SOCIAL_MEDIA.linkedin].filter(Boolean),
};

export const serviceSchema = (s: Service) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: s.name,
  description: s.seo.description,
  url: `${SITE_URL}${getServiceHref(s)}`,
  provider: { '@id': `${SITE_URL}/#organization` },
  areaServed: ACTIVE_CITIES.map((c) => ({ '@type': 'City', name: c })),
});

// ─── Schema.org — Services ───────────────────────────────────
export const SERVICES_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Services NexClean',
  itemListElement: services.map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: serviceSchema(s),
  })),
};

export const productSchema = (p: Product) => {
  const priced = p.formats.filter((f) => f.price !== null);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.images.map((img) => `${SITE_URL}${img.src}`),
    brand: { '@type': 'Brand', name: 'NexClean' },
    url: `${SITE_URL}/boutique/${p.slug}`,
    ...(priced.length > 0 && {
      offers: priced.map((f) => ({
        '@type': 'Offer',
        name: f.label,
        price: f.price,
        priceCurrency: 'XAF',
        availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `${SITE_URL}/boutique/${p.slug}`,
      })),
    }),
  };
};

export const faqSchema = (items: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
});

export const FAQ_SCHEMA = faqSchema(FAQ);

export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Accueil', path: '' }, ...items].map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `${SITE_URL}${item.path}`,
  })),
});

// ─── Schema.org — WebSite ────────────────────────────────────
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NexClean',
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  potentialAction: {
    '@type': 'ContactAction',
    target: getWhatsAppLink(),
    name: 'Contacter NexClean sur WhatsApp',
  },
};
