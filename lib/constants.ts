export const CONTACT = {
  phone: '+237696370479',
  whatsapp: '+237696370479',
  email: 'nexcleanservice@gmail.com',
  address: 'Douala, Cameroun',
};

export const SOCIAL_MEDIA = {
  facebook: 'https://www.facebook.com/profile.php?id=61585203135726',
  instagram: 'https://www.instagram.com/nexclean',
};

export const BUSINESS_HOURS = {
  weekdays: 'Lundi – Vendredi : 7h00 – 19h00',
  saturday: 'Samedi : 8h00 – 17h00',
  sunday: 'Dimanche : Sur rendez-vous',
  response: 'Réponse sous 1 heure',
};

export const PROMO = {
  active: true,
  title: 'Offre de Lancement',
  discount: '-20%',
  description: 'sur votre première prestation',
  condition: 'Pour les 50 premiers clients',
};

export const GUARANTEES = [
  'Satisfaction garantie ou intervention gratuite',
  'Agents formés et équipés professionnellement',
  'Produits de qualité certifiés',
  'Ponctualité assurée',
];

export const WHY_US = [
  {
    title: 'Disponibilité rapide',
    description: 'Intervention sous 24h, y compris le week-end sur rendez-vous.',
    icon: 'Clock',
  },
  {
    title: 'Expertise prouvée',
    description: "Agents formés, équipés de matériel professionnel et de produits certifiés.",
    icon: 'ShieldCheck',
  },
  {
    title: 'Satisfaction garantie',
    description: "Si le résultat ne vous convient pas, nous revenons gratuitement.",
    icon: 'ThumbsUp',
  },
];

export const FAQ = [
  {
    question: 'Quels quartiers de Douala couvrez-vous ?',
    answer:
      'Nous intervenons principalement à Bonapriso, Akwa, Bonanjo, Bali, Makepe, Bonamoussadi, Deido et New Bell. Bonaberi et PK8-PK12 seront bientôt couverts.',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer:
      'Nous acceptons le paiement en cash, Mobile Money (MTN, Orange) et virement bancaire. Le paiement se fait après la prestation pour votre tranquillité.',
  },
  {
    question: 'Puis-je avoir le même agent à chaque passage ?',
    answer:
      "Oui ! Avec nos abonnements mensuels, nous vous affectons un agent dédié qui connaîtra vos préférences et habitudes.",
  },
  {
    question: 'Fournissez-vous le matériel et les produits ?',
    answer:
      "Absolument ! Nous arrivons avec tout le matériel professionnel et les produits de nettoyage nécessaires. Vous n'avez rien à prévoir.",
  },
  {
    question: 'Puis-je réserver pour le jour même ?',
    answer:
      "Oui, selon nos disponibilités. Contactez-nous sur WhatsApp pour une intervention rapide. Nous nous efforçons de répondre aux urgences.",
  },
  {
    question: 'Quelle est la différence entre prestation ponctuelle et abonnement ?',
    answer:
      "La prestation ponctuelle est un service unique. L'abonnement vous offre des passages réguliers (4 ou 8 par mois) avec un tarif réduit et un agent dédié.",
  },
];

export const WHATSAPP_MESSAGE = encodeURIComponent(
  'Bonjour NexClean, je souhaite obtenir un devis pour un service de nettoyage.'
);

export const getWhatsAppLink = (message?: string) => {
  const msg = message
    ? encodeURIComponent(message)
    : WHATSAPP_MESSAGE;
  return `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, '')}?text=${msg}`;
};
