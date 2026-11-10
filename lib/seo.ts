// ============================================================
// SEO CONFIGURATION — NexClean
// Toute la configuration SEO centralisée ici. Les données structurées
// sont générées à partir des fichiers de contenu (aucune duplication).
// Positionnement : services aux entreprises et aux particuliers (docs/decisions.md D-03, D-08).
// ============================================================

import type { Metadata } from 'next';
import { BRAND, CONTACT, SOCIAL_MEDIA, FAQ, PAYMENT_TERMS, getWhatsAppLink } from '@/lib/constants';
import { services, getServiceHref, type Service } from '@/content/services-data';
import { products, type Product } from '@/content/products-data';
import type { Job } from '@/content/jobs-data';
import type { Couverture } from '@/lib/geo/couverture';

export const SITE_URL = 'https://nexclean.xyz';
export const SITE_NAME = 'NEXCLEAN SARL';
export const SITE_LOCALE = 'fr_CM';

// ─── Métadonnées globales ────────────────────────────────────
// Les villes viennent du référentiel géographique (M1-GEO-05, lib/geo/couverture.ts).
// Le test e2e attend « Douala et Yaoundé » dans le titre de l'accueil : garder `${villes}`.
export const titreParDefaut = (villes: string) =>
  `NEXCLEAN — Propreté, recrutement & espaces verts à ${villes}, Cameroun`;
export const descriptionParDefaut = (villes: string) =>
  `${BRAND.signature} à ${villes} : propreté, recrutement et placement de personnel, espaces verts, offres d'emploi. Suivi des demandes en ligne.`;

export const TITLE_TEMPLATE = '%s | NEXCLEAN SARL';

// ─── Mots-clés ciblés (multi-piliers, locaux) ────────────────
export const DEFAULT_KEYWORDS = [
  // Recrutement & placement
  'recrutement Douala',
  'recrutement Yaoundé',
  'agence de placement Douala',
  'cabinet de recrutement Cameroun',
  'placement de personnel Douala',
  'recruter du personnel Douala',
  'recrutement personnel de maison Douala',
  // Emploi
  'offres d’emploi Douala',
  'emploi Douala',
  'emploi Yaoundé',
  // Propreté & hygiène
  'nettoyage Douala',
  'entreprise de nettoyage Douala',
  'nettoyage bureaux Douala',
  'nettoyage maison Douala',
  'nettoyage fin de chantier Douala',
  'désinfection Douala',
  'nettoyage Yaoundé',
  // Espaces verts
  'entretien espaces verts Douala',
  'jardinage Douala',
  // Boutique
  'produits d’entretien Cameroun',
  // Marque
  'NEXCLEAN',
  'NEXCLEAN SARL',
].join(', ');

// ─── Open Graph Image ────────────────────────────────────────
// URL absolue obligatoire pour Facebook, WhatsApp, LinkedIn.
export const OG_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: BRAND.ogAlt,
};

/**
 * Métadonnées standard d'une page interne : titre, description, canonical, Open Graph et Twitter.
 * `twitter` permet de surcharger le titre, la description ou le format de carte propres à X/Twitter ;
 * sans surcharge, la carte reprend le titre et la description de la page (et non plus le défaut global).
 * `noindex` retire la page des moteurs (pages techniques, espace candidat…).
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  twitter,
  noindex,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  twitter?: { title?: string; description?: string; card?: 'summary' | 'summary_large_image' };
  noindex?: boolean;
}): Metadata {
  const titreComplet = `${title} | ${SITE_NAME}`;
  const imageUrl = image ? `${SITE_URL}${image}` : OG_IMAGE.url;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title: titreComplet,
      description,
      url: `${SITE_URL}${path}`,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [image ? { url: imageUrl } : { url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
    },
    twitter: {
      card: twitter?.card ?? 'summary_large_image',
      title: twitter?.title ?? titreComplet,
      description: twitter?.description ?? description,
      images: [imageUrl],
    },
    ...(noindex && { robots: { index: false, follow: false } }),
  };
}

// ─── Piliers de l'offre (D-01) ───────────────────────────────
/** Domaines de compétence déclarés dans le JSON-LD (`knowsAbout`). */
export const KNOWS_ABOUT = [
  'Propreté et hygiène des locaux',
  'Nettoyage de maisons et de bureaux',
  'Nettoyage de fin de chantier',
  'Désinfection',
  'Recrutement et placement de personnel',
  'Entretien des espaces verts',
  "Offres d'emploi et mise en relation de candidats",
  "Produits d'entretien",
];

const PROVIDER = { '@id': `${SITE_URL}/#organization` };

const offreService = (name: string, description: string, path: string) => ({
  '@type': 'Offer',
  itemOffered: { '@type': 'Service', name, description, url: `${SITE_URL}${path}`, provider: PROVIDER },
});

const estEspacesVerts = (s: Service) => s.href === '/espaces-verts';

/** Catalogue des offres, un sous-catalogue par pilier (`hasOfferCatalog`). */
export const offerCatalogSchema = () => ({
  '@type': 'OfferCatalog',
  name: 'Services NEXCLEAN',
  itemListElement: [
    {
      '@type': 'OfferCatalog',
      name: 'Propreté & hygiène',
      itemListElement: services
        .filter((s) => !estEspacesVerts(s))
        .map((s) => offreService(s.name, s.seo.description, getServiceHref(s))),
    },
    {
      '@type': 'OfferCatalog',
      name: 'Recrutement & placement',
      itemListElement: [
        offreService(
          'Recrutement et placement de personnel',
          'Recherche, présélection et présentation de candidats pour les entreprises et les particuliers employeurs. Commission par personne placée, calculée sur les placements confirmés.',
          '/recrutement/demander-du-personnel'
        ),
      ],
    },
    {
      '@type': 'OfferCatalog',
      name: 'Espaces verts',
      itemListElement: services
        .filter(estEspacesVerts)
        .map((s) => offreService(s.name, s.seo.description, getServiceHref(s))),
    },
    {
      '@type': 'OfferCatalog',
      name: 'Emploi',
      itemListElement: [
        {
          ...offreService(
            'Inscription candidat et candidature en ligne',
            "Profil candidat, candidature aux offres publiées et mise en relation avec des employeurs, gratuites pour les candidats.",
            '/candidat/inscription'
          ),
          price: '0',
          priceCurrency: 'XAF',
        },
      ],
    },
    {
      '@type': 'OfferCatalog',
      name: 'Boutique',
      itemListElement: products.map((p) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Product', name: p.name, url: `${SITE_URL}/boutique/${p.slug}` },
      })),
    },
  ],
});

// ─── Schema.org — Organization / LocalBusiness ───────────────
// Pas d'aggregateRating : à ajouter uniquement à partir d'avis réels et traçables.
export const localBusinessSchema = (c: Couverture) => ({
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: 'NEXCLEAN',
  legalName: 'NEXCLEAN SARL',
  slogan: BRAND.signature,
  description: descriptionParDefaut(c.libelle),
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand/logo-horizontal.png`,
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
    ...c.villes.map((v) => ({ '@type': 'City', name: v })),
    ...c.quartiers.flatMap((g) => g.noms.map((q) => ({ '@type': 'Place', name: `${q}, ${g.ville}` }))),
  ],
  knowsAbout: KNOWS_ABOUT,
  hasOfferCatalog: offerCatalogSchema(),
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: CONTACT.phone,
    email: CONTACT.email,
    contactType: 'customer service',
    availableLanguage: ['French'],
    areaServed: 'CM',
  },
  sameAs: [SOCIAL_MEDIA.facebook, SOCIAL_MEDIA.instagram, SOCIAL_MEDIA.tiktok, SOCIAL_MEDIA.linkedin].filter(Boolean),
});

export const serviceSchema = (s: Service, villes: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: s.name,
  description: s.seo.description,
  url: `${SITE_URL}${getServiceHref(s)}`,
  provider: PROVIDER,
  areaServed: villes.map((v) => ({ '@type': 'City', name: v })),
});

/** Page d'une ville (specs/COM1-01 RG-11) : chaque prestation, servie dans la ville et ses quartiers. */
export const villeServicesSchema = (ville: string, quartiers: string[], path: string) => {
  const zone = [{ '@type': 'City', name: ville }, ...quartiers.map((q) => ({ '@type': 'Place', name: `${q}, ${ville}` }))];
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Services NEXCLEAN à ${ville}`,
    url: `${SITE_URL}${path}`,
    itemListElement: services.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { ...serviceSchema(s, [ville]), '@context': undefined, areaServed: zone },
    })),
  };
};

/** Service de recrutement & placement (page /recrutement/demander-du-personnel). */
export const recrutementServiceSchema = (villes: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'Recrutement et placement de personnel',
  name: 'Recrutement et placement de personnel',
  description:
    'Recherche, présélection et présentation de candidats pour les entreprises et les particuliers employeurs. Commission par personne placée, calculée sur les placements confirmés à la prise de poste.',
  url: `${SITE_URL}/recrutement/demander-du-personnel`,
  provider: PROVIDER,
  areaServed: villes.map((v) => ({ '@type': 'City', name: v })),
});

// ─── Schema.org — Services ───────────────────────────────────
export const servicesSchema = (villes: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Services NEXCLEAN',
  itemListElement: [...services.map((s) => serviceSchema(s, villes)), recrutementServiceSchema(villes)].map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item,
  })),
});

export const productSchema = (p: Product) => {
  const priced = p.formats.filter((f) => f.price !== null);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.images.map((img) => `${SITE_URL}${img.src}`),
    brand: { '@type': 'Brand', name: 'NEXCLEAN' },
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

// ─── Schema.org — JobPosting ─────────────────────────────────
// Source des offres : content/jobs-data.ts (ADR 0023), type `Job`.

const echapperHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const listeHtml = (titre: string, items?: string[]) =>
  items && items.length > 0
    ? `<p><strong>${echapperHtml(titre)}</strong></p><ul>${items.map((i) => `<li>${echapperHtml(i)}</li>`).join('')}</ul>`
    : '';

/** « 40 000 FCFA/mois » → { montant: 40000, unite: 'MONTH' } ; null si illisible. */
export function lireSalaire(texte?: string): { montant: number; unite: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' } | null {
  if (!texte) return null;
  const m = texte.match(/(\d[\d\s  .]*)\s*FCFA/i);
  if (!m) return null;
  const montant = Number(m[1]!.replace(/[^\d]/g, ''));
  if (!Number.isFinite(montant) || montant <= 0) return null;
  const unite = /heure/i.test(texte) ? 'HOUR' : /jour/i.test(texte) ? 'DAY' : /semaine/i.test(texte) ? 'WEEK' : /an\b|année/i.test(texte) ? 'YEAR' : 'MONTH';
  return { montant, unite };
}

/** Type de contrat libre → `employmentType` Schema.org ; undefined si non précisé. */
export function typeEmploi(contrat: string): string | undefined {
  if (/stage|alternance/i.test(contrat)) return 'INTERN';
  if (/temps partiel/i.test(contrat)) return 'PART_TIME';
  if (/CDD|temporaire|mission/i.test(contrat)) return 'TEMPORARY';
  if (/CDI|temps plein/i.test(contrat)) return 'FULL_TIME';
  return undefined;
}

/**
 * JSON-LD `JobPosting` d'une offre de `content/jobs-data.ts`, pour `/recrutement/[slug]`.
 * Renvoie null pour une offre fermée (page en noindex, l'offre ne doit plus être diffusée).
 * `hiringOrganization` = NEXCLEAN : les offres issues d'un dossier client sont anonymisées (ADR 0013).
 * `datePosted` est requis par Google : il n'est émis que si l'offre porte `datePosted`.
 */
export function jobPostingSchema(offre: Job): Record<string, unknown> | null {
  if (offre.status !== 'open') return null;
  const yaounde = /yaound/i.test(offre.location);
  const salaire = lireSalaire(offre.salary?.base);
  const emploi = typeEmploi(offre.contract);
  const description = [
    `<p>${echapperHtml(offre.intro ?? offre.description)}</p>`,
    listeHtml('Missions', offre.missions),
    listeHtml('Profil recherché', offre.profile ?? offre.requirements),
    listeHtml('Horaires', offre.schedule),
  ].join('');
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: offre.title,
    description,
    identifier: { '@type': 'PropertyValue', name: SITE_NAME, value: offre.slug },
    ...(offre.datePosted && { datePosted: offre.datePosted }),
    ...(offre.validThrough && { validThrough: offre.validThrough }),
    ...(emploi && { employmentType: emploi }),
    ...(offre.sector && { industry: offre.sector }),
    occupationalCategory: offre.category,
    totalJobOpenings: offre.positions ?? 1,
    directApply: true,
    url: `${SITE_URL}/recrutement/${offre.slug}`,
    hiringOrganization: {
      '@type': 'Organization',
      name: SITE_NAME,
      sameAs: SITE_URL,
      logo: `${SITE_URL}/images/brand/logo-horizontal.png`,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: yaounde ? 'Yaoundé' : 'Douala',
        addressRegion: yaounde ? 'Centre' : 'Littoral',
        addressCountry: 'CM',
      },
    },
    ...(salaire && {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'XAF',
        value: { '@type': 'QuantitativeValue', value: salaire.montant, unitText: salaire.unite },
      },
    }),
  };
}

// ─── Schema.org — FAQ ────────────────────────────────────────
export const faqSchema = (items: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
});

/** FAQ générale multi-piliers (accueil), alignée sur `FAQ` de lib/constants.ts. */
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
export const websiteSchema = (villes: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: 'NEXCLEAN',
  url: SITE_URL,
  inLanguage: 'fr-CM',
  description: descriptionParDefaut(villes),
  publisher: PROVIDER,
  potentialAction: {
    '@type': 'ContactAction',
    target: getWhatsAppLink(),
    name: 'Contacter NEXCLEAN sur WhatsApp',
  },
});
