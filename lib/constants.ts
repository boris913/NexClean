// ============================================================
// COORDONNÉES & INFORMATIONS NEXCLEAN — SOURCE UNIQUE DE VÉRITÉ
// Toute modification ici se répercute automatiquement dans
// l'en-tête, le pied de page, les formulaires, les pages et le SEO.
// ⚠️ À faire valider par la direction avant mise en production.
// ============================================================

export const CONTACT = {
  phone: '+237696370479',
  phoneDisplay: '+237 6 96 37 04 79',
  whatsapp: '+237696370479',
  email: 'nexcleanservice@gmail.com',
  address: 'Douala, Cameroun',
};

export const COMPANY = {
  name: 'NexClean',
  legalName: 'NEXCLEAN SARL',
  // Renseigner uniquement des informations officielles (laisser vide sinon : non affiché).
  rccm: '',
  niu: '',
  director: '',
  foundedYear: '',
};

/** Liens vides = icône masquée automatiquement. */
export const SOCIAL_MEDIA = {
  facebook: 'https://www.facebook.com/profile.php?id=61585203135726',
  instagram: 'https://www.instagram.com/nexclean',
  tiktok: '',
  linkedin: '',
};

/** Villes d'intervention. Passer `active: true` uniquement si la zone est réellement opérationnelle. */
export const CITIES = [
  { name: 'Douala', active: true },
  { name: 'Yaoundé', active: false },
];

export const ACTIVE_CITIES = CITIES.filter((c) => c.active).map((c) => c.name);
export const CITIES_LABEL = ACTIVE_CITIES.join(' et ');

export const BUSINESS_HOURS = {
  weekdays: 'Lundi – Vendredi : 7h00 – 19h00',
  saturday: 'Samedi : 8h00 – 17h00',
  sunday: 'Dimanche : Sur rendez-vous',
};

export const PROMO = {
  active: true,
  title: 'Offre de Lancement',
  discount: '-20%',
  description: 'sur votre première prestation',
  condition: 'Pour les 50 premiers clients',
};

/**
 * Conditions de paiement affichées sur le site.
 * ⚠️ À faire valider par la direction : ce sont les seules formulations utilisées partout.
 */
export const PAYMENT_TERMS = {
  methods: ['Espèces', 'Mobile Money', 'Virement bancaire'],
  ponctuel:
    "Paiement selon les conditions indiquées sur votre devis. Un acompte peut être demandé à la validation pour certaines prestations, le solde étant réglé après l'intervention.",
  abonnement: "Règlement mensuel selon les termes du contrat d'abonnement.",
  produits:
    'Commande confirmée sur WhatsApp. Paiement en espèces ou Mobile Money à la livraison ou au retrait.',
};

export const WHY_US = [
  {
    title: 'Une équipe encadrée',
    description: "Des agents briefés avant chaque intervention et accompagnés d'un responsable d'équipe.",
    icon: 'Users',
  },
  {
    title: 'Matériel professionnel',
    description: 'Nous venons avec le matériel et les produits adaptés à vos surfaces.',
    icon: 'Sparkles',
  },
  {
    title: 'Contrôle qualité',
    description: "Vérification du travail en fin d'intervention, avec vous lorsque c'est possible.",
    icon: 'ClipboardCheck',
  },
  {
    title: 'Réactivité',
    description: 'Échange direct sur WhatsApp pour planifier rapidement votre intervention.',
    icon: 'MessageCircle',
  },
];

export const FAQ = [
  {
    question: 'Dans quelles zones intervenez-vous ?',
    answer:
      'Nous intervenons principalement à Douala : Bonapriso, Akwa, Bonanjo, Bali, Makepe, Bonamoussadi, Deido et New Bell. Pour les autres quartiers, contactez-nous : nous étudions chaque demande (des frais de déplacement peuvent s\'appliquer).',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer: `Moyens acceptés : ${PAYMENT_TERMS.methods.join(', ')}. Prestation ponctuelle : ${PAYMENT_TERMS.ponctuel} Abonnement : ${PAYMENT_TERMS.abonnement}`,
  },
  {
    question: 'Fournissez-vous le matériel et les produits ?',
    answer:
      "Oui. Nous venons avec le matériel professionnel et les produits de nettoyage nécessaires. Vous n'avez rien à prévoir.",
  },
  {
    question: 'Quel est le délai pour obtenir une intervention ?',
    answer:
      "Il dépend de notre planning et de l'ampleur du chantier. Contactez-nous sur WhatsApp : nous vous proposons le premier créneau disponible. Les interventions le jour même sont possibles selon les disponibilités.",
  },
  {
    question: 'Quelle est la différence entre prestation ponctuelle et abonnement ?',
    answer:
      "La prestation ponctuelle est un service unique. L'abonnement prévoit des passages réguliers (par exemple 4 ou 8 par mois) avec un tarif préférentiel et, autant que possible, la même équipe.",
  },
  {
    question: 'Comment acheter vos produits de nettoyage ?',
    answer: `Choisissez votre produit dans la Boutique puis cliquez sur « Commander sur WhatsApp ». ${PAYMENT_TERMS.produits}`,
  },
  {
    question: 'Puis-je annuler ou reporter une intervention ?',
    answer:
      "Oui, prévenez-nous le plus tôt possible sur WhatsApp ou par téléphone pour reporter ou annuler. Les conditions applicables en cas d'annulation tardive sont précisées sur le devis.",
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

export const TEL_LINK = `tel:${CONTACT.phone}`;

/** Message WhatsApp prérempli adapté à la page consultée. */
export const getPageWhatsAppMessage = (pathname: string) => {
  if (pathname.startsWith('/espaces-verts'))
    return "Bonjour NexClean, je souhaite un état des lieux / devis pour l'entretien d'un espace vert.";
  if (pathname.startsWith('/professionnels'))
    return 'Bonjour NexClean, je souhaite une visite technique / un devis professionnel.';
  if (pathname.startsWith('/abonnements'))
    return "Bonjour NexClean, je souhaite des informations sur vos formules d'abonnement.";
  if (pathname.startsWith('/boutique'))
    return 'Bonjour NexClean, je souhaite commander vos produits de nettoyage.';
  if (pathname.startsWith('/recrutement'))
    return 'Bonjour NexClean, j\'ai une question concernant le recrutement.';
  if (pathname.startsWith('/realisations'))
    return "Bonjour NexClean, j'ai vu vos réalisations et je souhaite un devis.";
  return 'Bonjour NexClean, je souhaite obtenir un devis pour un service de nettoyage.';
};
