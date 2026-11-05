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
  name: 'NEXCLEAN SARL',
  legalName: 'NEXCLEAN SARL',
  // Renseigner uniquement des informations officielles (laisser vide sinon : non affiché).
  rccm: '',
  niu: '',
  director: '',
  foundedYear: '',
};

/**
 * Plateforme de marque (docs/decisions.md D-03, docs/contenu.md).
 * NEXCLEAN est une offre de services aux entreprises et aux particuliers, pas seulement du nettoyage.
 */
export const BRAND = {
  name: 'NEXCLEAN',
  /** Promesse, proposée comme h1 de l'accueil. */
  promesse: 'Vos espaces et vos équipes, entre de bonnes mains.',
  /** Signature courte : meta, OG, footer. */
  signature: 'Services aux entreprises et aux particuliers',
  /** Sous-titre de l'accueil, paramétré par les villes du référentiel (« Douala et Yaoundé »). */
  sousTitre: (villes: string) =>
    `Propreté, recrutement de personnel et espaces verts à ${villes}, avec un suivi de chaque demande en ligne.`,
  /** Texte alternatif de l'image de partage (OG / Twitter). */
  ogAlt: 'NEXCLEAN — Services aux entreprises et aux particuliers au Cameroun : propreté, recrutement, espaces verts',
};

/** Liens vides = icône masquée automatiquement. */
export const SOCIAL_MEDIA = {
  facebook: 'https://www.facebook.com/profile.php?id=61585203135726',
  instagram: 'https://www.instagram.com/nexclean',
  tiktok: '',
  linkedin: '',
};

// Villes d'intervention : référentiel géographique en base (M1-GEO-05), voir lib/geo/couverture.ts.

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
    'Commande confirmée sur WhatsApp. Paiement en espèces ou Mobile Money à la livraison ou au retrait. Frais de livraison en sus.',
  /** Recrutement & placement (ADR 0008 à 0011). */
  placement:
    "Une commission par personne placée, seul prix payé à NEXCLEAN : le salaire est versé directement par vous. Un acompte, dont le taux figure sur le devis, lance la recherche. Le montant final ne compte que les placements confirmés à la prise de poste ; l'acompte en est déduit.",
};

/** Atouts transverses (section « Pourquoi NEXCLEAN », page À propos). */
export const WHY_US = [
  {
    title: 'Un référent par dossier',
    description: 'Chaque demande est confiée à un interlocuteur qui la suit du premier échange à la clôture.',
    icon: 'UserCheck',
  },
  {
    title: 'Des devis clairs',
    description: 'Montants en FCFA, conditions de paiement écrites ; pour un recrutement, devis à accepter en ligne.',
    icon: 'FileText',
  },
  {
    title: 'Un suivi en ligne',
    description: 'Statut et documents réunis sur une page de suivi, sans compte à créer ; devis, factures et reçus pour un recrutement.',
    icon: 'ClipboardCheck',
  },
  {
    title: 'Réactivité',
    description: 'Échange direct sur WhatsApp pour planifier une intervention ou préciser un besoin de personnel.',
    icon: 'MessageCircle',
  },
];

// ─── FAQ ─────────────────────────────────────────────────────
// Réponses exactes au regard de CONTEXT.md et des ADR 0008 à 0011, 0014. Ne rien affirmer de ce qui y est
// marqué « à confirmer » (garantie de remplacement, non-contournement) : ces sujets sont volontairement absents.
// Ces textes alimentent aussi le JSON-LD FAQPage : pas de placeholder ici.

export interface FaqItem {
  question: string;
  answer: string;
}

/** Questions générales sur l'offre. */
export const FAQ_GENERAL: FaqItem[] = [
  {
    question: 'Quels services propose NEXCLEAN ?',
    answer:
      "NEXCLEAN accompagne les entreprises et les particuliers : propreté et hygiène (maisons, bureaux, fins de chantier, vitres, désinfection, abonnements d'entretien), recrutement et placement de personnel, entretien des espaces verts et produits d'entretien en boutique. Les demandeurs d'emploi peuvent aussi consulter nos offres et créer leur profil candidat.",
  },
  {
    question: 'Dans quelles villes intervenez-vous ?',
    answer:
      "Nous intervenons à Douala et Yaoundé. Les quartiers desservis sont indiqués dans la section Zones du site. Pour un autre quartier, contactez-nous : nous étudions chaque demande (des frais de déplacement peuvent s'appliquer).",
  },
  {
    question: 'Comment faire une demande ?',
    answer:
      "Remplissez le formulaire adapté à votre besoin sur le site, ou écrivez-nous sur WhatsApp. Votre demande est enregistrée avec un numéro de dossier, puis un conseiller revient vers vous pour préciser le besoin et établir le devis.",
  },
];

/** Suivi de dossier en ligne (ADR 0014). */
export const FAQ_SUIVI: FaqItem[] = [
  {
    question: 'Comment suivre ma demande en ligne ?',
    answer:
      "Après l'envoi de votre demande, vous recevez un numéro de dossier et un lien de suivi personnel, sans compte ni mot de passe. Cette page affiche le statut de votre dossier et, pour un recrutement, le devis à accepter, vos factures et reçus et les profils proposés. Les 4 derniers chiffres de votre numéro WhatsApp vous sont demandés avant d'afficher les documents. Ne partagez pas ce lien.",
  },
];

/** Recrutement & placement, côté employeur (ADR 0008 à 0011). */
export const FAQ_RECRUTEMENT: FaqItem[] = [
  {
    question: 'Comment fonctionne le recrutement de personnel ?',
    answer:
      "Décrivez les postes à pourvoir avec « Demander du personnel » : métier, nombre de personnes, missions, salaire, type de contrat. Vous obtenez une estimation immédiate. Un conseiller vous rappelle pour préciser le besoin et vous envoie un devis. Après acceptation, nous recherchons et présélectionnons des candidats, puis vous les présentons sur votre page de suivi, toujours avec leur accord. Entreprises et particuliers employeurs peuvent faire une demande.",
  },
  {
    question: 'Combien coûte un recrutement ?',
    answer:
      "Vous payez une commission par personne placée : c'est le seul prix payé à NEXCLEAN. Le salaire est versé directement par vous à la personne embauchée. L'estimation affichée après votre demande correspond à la commission en vigueur multipliée par le nombre de personnes demandées ; elle est indicative. Le devis fixe le montant de la commission.",
  },
  {
    question: 'Quand dois-je payer et que se passe-t-il si tous les postes ne sont pas pourvus ?',
    answer:
      "Après acceptation du devis, un acompte, dont le taux est indiqué sur le devis, lance la recherche pendant le délai prévu. Un placement est confirmé à la prise de poste, sur attestation que vous validez. À la clôture de la recherche, le montant final est calculé sur les seuls placements confirmés et l'acompte en est déduit : vous réglez le solde, ou le trop-perçu vous est remboursé ou converti en avoir.",
  },
];

/** Emploi, côté candidat (MENTION_GRATUITE, lib/candidats/domaine.ts). */
export const FAQ_EMPLOI: FaqItem[] = [
  {
    question: "Je cherche un emploi : comment m'inscrire ?",
    answer:
      "Créez votre profil candidat en ligne, puis postulez aux offres publiées sur la page Recrutement. Votre espace candidat vous permet de compléter votre profil et de suivre vos candidatures. Nous ne présentons jamais votre profil à un employeur sans votre accord pour ce poste.",
  },
  {
    question: "L'inscription candidat est-elle payante ?",
    answer: "Non. L'inscription, la candidature et la mise en relation sont 100 % gratuites pour les candidats.",
  },
];

/** Propreté, espaces verts et boutique. */
export const FAQ_PROPRETE: FaqItem[] = [
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

/**
 * FAQ générale (accueil, /contact) : couvre tous les piliers.
 * Les pages thématiques peuvent utiliser FAQ_PROPRETE, FAQ_RECRUTEMENT, FAQ_EMPLOI ou FAQ_SUIVI.
 */
export const FAQ: FaqItem[] = [
  ...FAQ_GENERAL,
  FAQ_RECRUTEMENT[0]!,
  FAQ_RECRUTEMENT[1]!,
  FAQ_EMPLOI[1]!,
  FAQ_SUIVI[0]!,
  FAQ_PROPRETE[0]!,
  FAQ_PROPRETE[1]!,
];

// ─── WhatsApp ────────────────────────────────────────────────
// Le préfixe « Bonjour NexClean,\n\n*{subject}* » des formulaires (lib/dossiers/formulaire-devis.ts) ne change pas.

/** Message par défaut, neutre (D-05). */
export const WHATSAPP_MESSAGE_DEFAUT = "Bonjour NEXCLEAN, j'ai une demande…";
/** Service : propreté, espaces verts, abonnement. */
export const WHATSAPP_MESSAGE_SERVICE =
  'Bonjour NEXCLEAN, je souhaite un devis pour un service (propreté, espaces verts ou abonnement).';
/** Recrutement, côté employeur. */
export const WHATSAPP_MESSAGE_RECRUTEMENT = 'Bonjour NEXCLEAN, je recherche du personnel. Postes et nombre de personnes : …';
/** Emploi, côté candidat. */
export const WHATSAPP_MESSAGE_EMPLOI =
  "Bonjour NEXCLEAN, je cherche un emploi et j'ai une question sur une offre ou mon profil candidat.";
/** Suivi d'un dossier existant. */
export const WHATSAPP_MESSAGE_SUIVI = "Bonjour NEXCLEAN, j'ai une question sur le suivi de mon dossier. Numéro de dossier : …";

/** Messages par contexte, pour les pages et composants. */
export const WHATSAPP_MESSAGES = {
  defaut: WHATSAPP_MESSAGE_DEFAUT,
  service: WHATSAPP_MESSAGE_SERVICE,
  recrutement: WHATSAPP_MESSAGE_RECRUTEMENT,
  emploi: WHATSAPP_MESSAGE_EMPLOI,
  suivi: WHATSAPP_MESSAGE_SUIVI,
  espacesVerts: "Bonjour NEXCLEAN, je souhaite un état des lieux / devis pour l'entretien d'un espace vert.",
  professionnels: 'Bonjour NEXCLEAN, je souhaite une visite technique / un devis professionnel.',
  abonnements: "Bonjour NEXCLEAN, je souhaite des informations sur vos formules d'abonnement.",
  boutique: 'Bonjour NEXCLEAN, je souhaite commander vos produits d’entretien.',
  realisations: "Bonjour NEXCLEAN, j'ai vu vos réalisations et je souhaite un devis.",
  offres: "Bonjour NEXCLEAN, j'ai une question sur vos offres d'emploi ou sur une demande de personnel.",
} as const;

export type ContexteWhatsApp = keyof typeof WHATSAPP_MESSAGES;

/** Message par défaut, déjà encodé pour une URL. */
export const WHATSAPP_MESSAGE = encodeURIComponent(WHATSAPP_MESSAGE_DEFAUT);

export const getWhatsAppLink = (message?: string) => {
  const msg = message
    ? encodeURIComponent(message)
    : WHATSAPP_MESSAGE;
  return `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, '')}?text=${msg}`;
};

export const TEL_LINK = `tel:${CONTACT.phone}`;

/** Message WhatsApp prérempli adapté à la page consultée. */
export const getPageWhatsAppMessage = (pathname: string) => {
  if (pathname.startsWith('/espaces-verts')) return WHATSAPP_MESSAGES.espacesVerts;
  if (pathname.startsWith('/professionnels')) return WHATSAPP_MESSAGES.professionnels;
  if (pathname.startsWith('/abonnements')) return WHATSAPP_MESSAGES.abonnements;
  if (pathname.startsWith('/boutique')) return WHATSAPP_MESSAGES.boutique;
  if (pathname.startsWith('/realisations')) return WHATSAPP_MESSAGES.realisations;
  if (pathname.startsWith('/recrutement/demander-du-personnel')) return WHATSAPP_MESSAGES.recrutement;
  if (pathname === '/recrutement' || pathname === '/recrutement/') return WHATSAPP_MESSAGES.offres;
  if (pathname.startsWith('/recrutement/') || pathname.startsWith('/candidat')) return WHATSAPP_MESSAGES.emploi;
  if (pathname.startsWith('/suivi') || pathname.startsWith('/profil')) return WHATSAPP_MESSAGES.suivi;
  if (pathname.startsWith('/services') || pathname.startsWith('/particuliers') || pathname.startsWith('/tarifs'))
    return WHATSAPP_MESSAGES.service;
  return WHATSAPP_MESSAGE_DEFAUT;
};
