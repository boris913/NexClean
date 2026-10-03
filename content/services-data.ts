// ============================================================
// SERVICES NEXCLEAN — modifier ici pour mettre à jour les cartes,
// les pages /services/[slug], les formulaires et le SEO.
// Les prix sont INDICATIFS : ils varient selon surface, état, accès,
// fréquence et moyens nécessaires.
// ============================================================

export type Audience = 'particulier' | 'professionnel';

export interface Service {
  slug: string;
  name: string;
  icon: string;
  priceRange: string;
  description: string;
  includes: string[];
  audiences: Audience[];
  /** Page dédiée (sinon /services/[slug]). */
  href?: string;
  seo: {
    title: string;
    description: string;
    h1: string;
    intro: string;
  };
  idealFor: string[];
}

export const services: Service[] = [
  {
    slug: 'nettoyage-maison-douala',
    name: 'Nettoyage Maison & Appartement',
    icon: 'Home',
    priceRange: 'À partir de 8 000 FCFA (indicatif)',
    description:
      'Nettoyage complet de votre maison, appartement ou studio. Sols, surfaces, sanitaires et cuisine.',
    includes: ['Sols et carrelages', 'Dépoussiérage complet', 'Sanitaires et cuisine', 'Grand nettoyage, emménagement / déménagement'],
    audiences: ['particulier'],
    seo: {
      title: 'Nettoyage maison et appartement à Douala',
      description:
        'Nettoyage de maisons, appartements et studios à Douala par NexClean : sols, sanitaires, cuisine, grand nettoyage et emménagement. Devis rapide sur WhatsApp.',
      h1: 'Nettoyage maison & appartement à Douala',
      intro:
        "Que ce soit pour un entretien ponctuel, un grand nettoyage ou avant/après un déménagement, nos équipes remettent votre logement au propre avec le matériel et les produits adaptés.",
    },
    idealFor: ['Studios et appartements', 'Maisons et villas', 'Emménagement / déménagement', 'Grand nettoyage saisonnier'],
  },
  {
    slug: 'nettoyage-bureaux-douala',
    name: 'Nettoyage de Bureaux',
    icon: 'Building2',
    priceRange: 'À partir de 15 000 FCFA (indicatif)',
    description:
      'Espaces de travail propres et sains pour vos équipes et vos visiteurs. Bureaux, commerces, cabinets.',
    includes: ['Espaces de travail', 'Salles de réunion', 'Sanitaires', 'Accueil et zones communes'],
    audiences: ['professionnel'],
    seo: {
      title: 'Nettoyage de bureaux à Douala',
      description:
        "Entretien de bureaux, commerces et cabinets à Douala : passages ponctuels ou réguliers, horaires adaptés à votre activité. Visite technique et devis professionnel.",
      h1: 'Nettoyage de bureaux à Douala',
      intro:
        "Un espace de travail propre améliore le confort de vos équipes et l'image donnée à vos clients. Nous intervenons selon une fréquence et des horaires adaptés à votre activité.",
    },
    idealFor: ['Bureaux et open spaces', 'Cabinets et agences', 'Commerces et boutiques', 'Établissements scolaires'],
  },
  {
    slug: 'nettoyage-fin-de-chantier-douala',
    name: 'Nettoyage Fin de Chantier',
    icon: 'HardHat',
    priceRange: 'À partir de 20 000 FCFA (indicatif)',
    description:
      'Remise en état après construction ou rénovation : poussière, traces de peinture, résidus et débris.',
    includes: ['Évacuation des résidus légers', 'Dépoussiérage en profondeur', 'Vitres et sols', 'Finitions avant livraison'],
    audiences: ['particulier', 'professionnel'],
    seo: {
      title: 'Nettoyage fin de chantier à Douala',
      description:
        'Nettoyage après travaux et fin de chantier à Douala : dépoussiérage, sols, vitres, traces de peinture. État des lieux et devis sur mesure par NexClean.',
      h1: 'Nettoyage fin de chantier à Douala',
      intro:
        "Après des travaux, la poussière et les résidus s'infiltrent partout. Nous préparons vos locaux pour une remise des clés ou un emménagement dans de bonnes conditions.",
    },
    idealFor: ['Appartements rénovés', 'Constructions neuves', 'Locaux commerciaux', 'Promoteurs et entreprises du BTP'],
  },
  {
    slug: 'nettoyage-vitres-douala',
    name: 'Nettoyage de Vitres',
    icon: 'Minimize2',
    priceRange: 'À partir de 5 000 FCFA (indicatif)',
    description: 'Vitres, baies vitrées, miroirs et vitrines, à l\'intérieur comme à l\'extérieur (selon accès).',
    includes: ['Vitres intérieures', 'Vitres extérieures accessibles', 'Miroirs', 'Baies vitrées et vitrines'],
    audiences: ['particulier', 'professionnel'],
    seo: {
      title: 'Nettoyage de vitres à Douala',
      description:
        'Nettoyage de vitres, baies vitrées et vitrines à Douala pour particuliers et professionnels. Devis selon surface et accessibilité.',
      h1: 'Nettoyage de vitres à Douala',
      intro:
        'Des vitres propres apportent de la lumière et soignent votre image. Le tarif dépend de la surface vitrée et de son accessibilité.',
    },
    idealFor: ['Maisons et appartements', 'Vitrines de commerces', 'Bureaux', 'Résidences'],
  },
  {
    slug: 'desinfection-douala',
    name: 'Désinfection',
    icon: 'ShieldCheck',
    priceRange: 'À partir de 10 000 FCFA (indicatif)',
    description: 'Désinfection des surfaces de contact et des zones sensibles de vos locaux.',
    includes: ['Surfaces de contact', 'Sanitaires', 'Poignées et interrupteurs', 'Zones à fort passage'],
    audiences: ['particulier', 'professionnel'],
    seo: {
      title: 'Désinfection de locaux à Douala',
      description:
        'Désinfection de maisons, bureaux et commerces à Douala : surfaces de contact, sanitaires, zones à fort passage. Devis rapide par NexClean.',
      h1: 'Désinfection de locaux à Douala',
      intro:
        'Nous traitons en priorité les surfaces les plus touchées et les zones sanitaires, en complément ou en dehors d\'un nettoyage classique.',
    },
    idealFor: ['Cabinets et structures de santé', 'Bureaux', 'Commerces', 'Logements'],
  },
  {
    slug: 'entretien-espaces-verts-douala',
    name: 'Entretien Espaces Verts',
    icon: 'Trees',
    priceRange: 'Sur devis après état des lieux',
    description:
      'Tonte, débroussaillage, désherbage, taille de haies et ramassage des déchets verts.',
    includes: ['Tonte de pelouse', 'Débroussaillage et désherbage', 'Taille de haies', 'Ramassage des déchets verts'],
    audiences: ['particulier', 'professionnel'],
    href: '/espaces-verts',
    seo: {
      title: 'Entretien espaces verts à Douala',
      description:
        "Entretien d'espaces verts à Douala : tonte, débroussaillage, désherbage, taille de haies. Interventions ponctuelles ou contrats réguliers.",
      h1: 'Entretien des espaces verts à Douala',
      intro: '',
    },
    idealFor: ['Jardins et cours', 'Résidences', 'Entreprises et hôtels', 'Administrations'],
  },
  {
    slug: 'abonnement-entretien-regulier',
    name: 'Entretien Régulier (Abonnement)',
    icon: 'CalendarCheck',
    priceRange: 'À partir de 30 000 FCFA/mois (indicatif)',
    description: 'Passages réguliers planifiés avec un tarif préférentiel et, autant que possible, la même équipe.',
    includes: ['Planning personnalisé', 'Tarif préférentiel', 'Priorité de planification', 'Équipe habituelle'],
    audiences: ['particulier', 'professionnel'],
    href: '/abonnements',
    seo: {
      title: 'Abonnement nettoyage à Douala',
      description: 'Formules d\'entretien régulier pour particuliers et professionnels à Douala.',
      h1: 'Entretien régulier',
      intro: '',
    },
    idealFor: [],
  },
];

export const getServiceHref = (s: Service) => s.href ?? `/services/${s.slug}`;

/** Services disposant d'une page /services/[slug]. */
export const servicePages = services.filter((s) => !s.href);

export const getServiceBySlug = (slug: string) => servicePages.find((s) => s.slug === slug);

export const serviceNames = services.map((s) => s.name);
