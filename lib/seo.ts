// ============================================================
// SEO CONFIGURATION — NexClean
// Toute la configuration SEO centralisée ici.
// ============================================================

export const SITE_URL = 'https://nexclean.cm';
export const SITE_NAME = 'NexClean';
export const SITE_LOCALE = 'fr_CM';

// ─── Métadonnées globales ────────────────────────────────────
export const DEFAULT_TITLE = 'NexClean — Service de Nettoyage Professionnel à Douala';
export const DEFAULT_DESCRIPTION =
  'NexClean, la propreté nouvelle génération à Douala. Nettoyage professionnel pour maisons, bureaux et commerces au Cameroun. Intervention sous 24h, satisfaction garantie. Devis gratuit.';

export const TITLE_TEMPLATE = '%s | NexClean Douala';

// ─── Mots-clés ciblés (longue traîne + locaux) ───────────────
export const DEFAULT_KEYWORDS = [
  // Locaux primaires
  'nettoyage Douala',
  'service nettoyage Douala',
  'entreprise nettoyage Douala',
  'nettoyage professionnel Douala',
  // Services
  'nettoyage maison Douala',
  'nettoyage bureau Douala',
  'nettoyage vitres Douala',
  'désinfection Douala',
  'nettoyage après travaux Douala',
  'femme de ménage Douala',
  // Géographique
  'nettoyage Bonapriso',
  'nettoyage Akwa',
  'nettoyage Bonanjo',
  'nettoyage Bali Douala',
  'nettoyage Makepe',
  'nettoyage Bonamoussadi',
  // Cameroun
  'service nettoyage Cameroun',
  'nettoyage professionnel Cameroun',
  // Brand
  'NexClean',
  'NexClean Douala',
  'NexClean Cameroun',
].join(', ');

// ─── Open Graph Image ────────────────────────────────────────
export const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: 'NexClean — Service de Nettoyage Professionnel à Douala, Cameroun',
};

// ─── Schema.org — LocalBusiness ──────────────────────────────
export const LOCAL_BUSINESS_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#organization`,
  name: 'NexClean',
  alternateName: 'NexClean Douala',
  description:
    'Service de nettoyage professionnel à Douala, Cameroun. Maisons, bureaux, désinfection, après travaux.',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/images/logo.png`,
    width: 400,
    height: 100,
  },
  image: `${SITE_URL}/og-image.png`,
  telephone: '+237696370479',
  email: 'contact@nexclean.cm',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Douala',
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
  priceRange: '8 000 – 120 000 FCFA',
  currenciesAccepted: 'XAF',
  paymentAccepted: 'Cash, Mobile Money, Virement Bancaire',
  areaServed: [
    {
      '@type': 'Place',
      name: 'Bonapriso, Douala',
    },
    {
      '@type': 'Place',
      name: 'Akwa, Douala',
    },
    {
      '@type': 'Place',
      name: 'Bonanjo, Douala',
    },
    {
      '@type': 'Place',
      name: 'Bali, Douala',
    },
    {
      '@type': 'Place',
      name: 'Makepe, Douala',
    },
    {
      '@type': 'Place',
      name: 'Bonamoussadi, Douala',
    },
    {
      '@type': 'Place',
      name: 'Deido, Douala',
    },
    {
      '@type': 'Place',
      name: 'New Bell, Douala',
    },
  ],
  hasMap: 'https://www.google.com/maps?q=Douala,Cameroun',
  sameAs: [
    'https://www.facebook.com/nexclean',
    'https://www.instagram.com/nexclean',
  ],
  // Aggregate rating — à mettre à jour avec vos vrais avis
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    bestRating: '5',
    worstRating: '1',
    ratingCount: '100',
  },
};

// ─── Schema.org — Services (Service Schema) ──────────────────
export const SERVICES_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Services NexClean',
  description: 'Liste des services de nettoyage professionnel proposés par NexClean à Douala',
  url: `${SITE_URL}/#services`,
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      item: {
        '@type': 'Service',
        name: 'Nettoyage Maison',
        description:
          'Nettoyage complet de maisons et appartements à Douala. Sols, surfaces, sanitaires et cuisine.',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: 'Douala, Cameroun',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'XAF',
          priceSpecification: {
            '@type': 'PriceSpecification',
            minPrice: '8000',
            maxPrice: '25000',
            priceCurrency: 'XAF',
          },
        },
      },
    },
    {
      '@type': 'ListItem',
      position: 2,
      item: {
        '@type': 'Service',
        name: 'Nettoyage Bureau',
        description:
          'Nettoyage et entretien de bureaux et espaces professionnels à Douala.',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: 'Douala, Cameroun',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'XAF',
          priceSpecification: {
            '@type': 'PriceSpecification',
            minPrice: '15000',
            maxPrice: '50000',
            priceCurrency: 'XAF',
          },
        },
      },
    },
    {
      '@type': 'ListItem',
      position: 3,
      item: {
        '@type': 'Service',
        name: 'Désinfection Complète',
        description:
          'Désinfection professionnelle de locaux résidentiels et commerciaux à Douala.',
        provider: { '@id': `${SITE_URL}/#organization` },
        areaServed: 'Douala, Cameroun',
      },
    },
  ],
};

// ─── Schema.org — FAQ ────────────────────────────────────────
export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Quels quartiers de Douala couvrez-vous ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nous intervenons principalement à Bonapriso, Akwa, Bonanjo, Bali, Makepe, Bonamoussadi, Deido et New Bell. Bonaberi et PK8-PK12 seront bientôt couverts.',
      },
    },
    {
      '@type': 'Question',
      name: 'Comment se passe le paiement ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nous acceptons le paiement en cash, Mobile Money (MTN, Orange) et virement bancaire. Le paiement se fait après la prestation pour votre tranquillité.',
      },
    },
    {
      '@type': 'Question',
      name: 'Fournissez-vous le matériel et les produits de nettoyage ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolument ! Nous arrivons avec tout le matériel professionnel et les produits de nettoyage nécessaires. Vous n\'avez rien à prévoir.',
      },
    },
    {
      '@type': 'Question',
      name: 'Puis-je réserver un nettoyage pour le jour même à Douala ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, selon nos disponibilités. Contactez-nous sur WhatsApp pour une intervention rapide. Nous nous efforçons de répondre aux urgences dans les meilleurs délais.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quels sont les tarifs pour un nettoyage de maison à Douala ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nos tarifs pour le nettoyage de maison à Douala commencent à 8 000 FCFA pour un studio et vont jusqu\'à 16 000 FCFA pour un appartement de 3 chambres et plus. Contactez-nous pour un devis personnalisé gratuit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quelle est la différence entre une prestation ponctuelle et un abonnement mensuel ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'La prestation ponctuelle est un service unique. L\'abonnement mensuel vous offre des passages réguliers (4 ou 8 par mois) avec un tarif réduit et un agent dédié qui connaît vos habitudes.',
      },
    },
  ],
};

// ─── Schema.org — Breadcrumb ─────────────────────────────────
export const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
      item: SITE_URL,
    },
  ],
};

// ─── Schema.org — WebSite (SearchAction pour Google Sitelinks) ─
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NexClean',
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  potentialAction: {
    '@type': 'ContactAction',
    target: `https://wa.me/237696370479`,
    name: 'Contacter NexClean sur WhatsApp',
  },
};
