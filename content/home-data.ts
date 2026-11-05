// ============================================================
// ACCUEIL — données typées des sections (docs/decisions.md D-04, docs/contenu.md).
// Textes seuls : la mise en page relève des composants. Les icônes sont des noms
// d'icônes lucide-react (chaînes), résolus par les composants.
// Tous les href pointent vers des routes existantes (aucune URL ne change, D-05).
// Les villes ne sont jamais écrites en dur : les textes concernés sont des fonctions de `villes`
// (libellé du référentiel, ex. « Douala et Yaoundé »).
// ============================================================

import { BRAND, WHATSAPP_MESSAGE_DEFAUT, WHATSAPP_MESSAGE_RECRUTEMENT } from '@/lib/constants';

export type CleePilier = 'proprete' | 'recrutement' | 'espaces-verts' | 'emploi' | 'boutique';

export interface Lien {
  label: string;
  href: string;
}

export interface Porte {
  titre: string;
  texte: string;
  icon: string;
  cta: Lien;
  /** Lien secondaire facultatif, sous le CTA. */
  lienSecondaire?: Lien;
}

export interface Pilier {
  cle: CleePilier;
  titre: string;
  accroche: string;
  benefice: string;
  /** 3 ou 4 éléments courts. */
  liste: string[];
  icon: string;
  href: string;
  cta: string;
}

export interface Etape {
  titre: string;
  texte: string;
  icon: string;
}

export interface EnTeteSection {
  surtitre: string;
  titre: string;
  sousTitre: string;
}

// ─── 1. Hero + 3 portes ──────────────────────────────────────
export const HERO = {
  h1: BRAND.promesse,
  sousTitre: (villes: string) => BRAND.sousTitre(villes),
  photo: { src: '/images/team/equipe-nexclean.jpg', alt: "L'équipe NEXCLEAN" },
  portes: [
    {
      titre: "J'ai besoin d'un service",
      texte: "Propreté, espaces verts ou abonnement d'entretien, pour votre logement ou vos locaux.",
      icon: 'Building2',
      cta: { label: 'Voir les services', href: '/services' },
      lienSecondaire: { label: 'Espaces verts', href: '/espaces-verts' },
    },
    {
      titre: 'Je recrute du personnel',
      texte: 'Décrivez vos postes en quelques minutes et obtenez une estimation immédiate.',
      icon: 'UserCheck',
      cta: { label: 'Demander du personnel', href: '/recrutement/demander-du-personnel' },
      lienSecondaire: { label: 'Comment ça marche', href: '/recrutement#placement' },
    },
    {
      titre: 'Je cherche un emploi',
      texte: 'Consultez nos offres et créez votre profil candidat, gratuitement.',
      icon: 'Briefcase',
      cta: { label: 'Voir les offres', href: '/recrutement' },
      lienSecondaire: { label: 'Créer mon profil', href: '/candidat/inscription' },
    },
  ] satisfies Porte[],
};

// ─── 2. Piliers ──────────────────────────────────────────────
export const PILIERS_EN_TETE: EnTeteSection = {
  surtitre: 'Nos services',
  titre: 'Un seul interlocuteur pour vos espaces et vos équipes',
  sousTitre: 'Entreprises et particuliers : choisissez le service dont vous avez besoin.',
};

export const PILIERS: Pilier[] = [
  {
    cle: 'proprete',
    titre: 'Propreté & hygiène',
    accroche: 'Maisons, bureaux, commerces et fins de chantier.',
    benefice: 'Matériel et produits fournis, devis clair en FCFA.',
    liste: ['Nettoyage maison et bureaux', 'Fin de chantier et vitres', 'Désinfection', "Abonnements d'entretien"],
    icon: 'SprayCan',
    href: '/services',
    cta: 'Voir les prestations',
  },
  {
    cle: 'recrutement',
    titre: 'Recrutement & placement',
    accroche: 'Du personnel présélectionné pour votre entreprise ou votre domicile.',
    benefice: 'Une commission par personne, facturée sur les seuls placements confirmés.',
    liste: ['Estimation immédiate en ligne', 'Candidats présélectionnés', 'Profils proposés sur votre page de suivi'],
    icon: 'UserCheck',
    href: '/recrutement/demander-du-personnel',
    cta: 'Demander du personnel',
  },
  {
    cle: 'espaces-verts',
    titre: 'Espaces verts',
    accroche: 'Jardins, cours, résidences et sites d’entreprise.',
    benefice: 'Intervention ponctuelle ou contrat régulier, après état des lieux.',
    liste: ['Tonte de pelouse', 'Débroussaillage et désherbage', 'Taille de haies', 'Ramassage des déchets verts'],
    icon: 'Trees',
    href: '/espaces-verts',
    cta: 'Demander un état des lieux',
  },
  {
    cle: 'emploi',
    titre: 'Emploi',
    accroche: 'Des offres publiées et un espace candidat personnel.',
    benefice: 'Inscription, candidature et mise en relation 100 % gratuites.',
    liste: ['Offres en cours', 'Candidature en ligne', 'Espace candidat pour suivre vos démarches'],
    icon: 'Briefcase',
    href: '/recrutement',
    cta: 'Voir les offres',
  },
  {
    cle: 'boutique',
    titre: 'Boutique',
    accroche: "Les produits d'entretien utilisés par nos équipes.",
    benefice: 'Commande simple sur WhatsApp, paiement à la livraison ou au retrait.',
    liste: ['Savon liquide multi-usage', 'Tarifs revendeurs sur demande'],
    icon: 'ShoppingBag',
    href: '/boutique',
    cta: 'Voir la boutique',
  },
];

// ─── 3. Comment ça marche (parcours commun) ──────────────────
export const PARCOURS_EN_TETE: EnTeteSection = {
  surtitre: 'Comment ça marche',
  titre: 'Un même parcours pour chaque demande',
  sousTitre: 'Service, espaces verts ou recrutement : vous savez toujours où en est votre dossier.',
};

export const PARCOURS: Etape[] = [
  {
    titre: 'Vous faites votre demande',
    texte: 'Sur le site ou par WhatsApp. Elle est enregistrée avec un numéro de dossier.',
    icon: 'Send',
  },
  {
    titre: 'Nous établissons le devis',
    texte: 'Un référent précise votre besoin avec vous, puis vous envoie un devis.',
    icon: 'FileText',
  },
  {
    titre: 'Nous réalisons',
    texte: 'Intervention planifiée, ou recherche et présentation de candidats pour un recrutement.',
    icon: 'ClipboardCheck',
  },
  {
    titre: 'Vous suivez en ligne',
    texte: 'Statut et documents sur votre page de suivi personnelle ; pour un recrutement, devis, factures et reçus aussi.',
    icon: 'MonitorSmartphone',
  },
];

// ─── 4. Focus recrutement ────────────────────────────────────
// N'affirmer ni garantie de remplacement ni non-contournement (à confirmer, CONTEXT.md).
export const FOCUS_RECRUTEMENT = {
  surtitre: 'Recrutement & placement',
  titre: 'Recrutez du personnel, payez les placements confirmés',
  texte:
    "Agents d'entretien, serveurs, cuisiniers, gardiens, nounous… Décrivez vos postes : nous recherchons, présélectionnons et vous présentons des candidats, avec leur accord. Vous embauchez et versez directement le salaire.",
  points: [
    { titre: 'Une commission par personne', texte: 'Seul prix payé à NEXCLEAN. Le montant en vigueur apparaît dans votre estimation, puis sur le devis.' },
    { titre: 'Un acompte au devis', texte: 'Il lance la recherche et est déduit du montant final.' },
    { titre: 'Facturé sur placements confirmés', texte: 'Un placement compte à la prise de poste, sur attestation que vous validez.' },
    { titre: 'Profils proposés en ligne', texte: 'Les candidats retenus pour vous apparaissent sur votre page de suivi.' },
  ],
  icon: 'UserCheck',
  cta: { label: 'Demander du personnel', href: '/recrutement/demander-du-personnel' } satisfies Lien,
  lienSecondaire: { label: 'En savoir plus sur le placement', href: '/recrutement#placement' } satisfies Lien,
  whatsappMessage: WHATSAPP_MESSAGE_RECRUTEMENT,
};

// ─── 5. Focus propreté (condensé) ────────────────────────────
export const FOCUS_PROPRETE: EnTeteSection & { abonnementsTitre: string; abonnementsNote: string; cta: Lien; lienSecondaire: Lien } = {
  surtitre: 'Propreté & hygiène',
  titre: 'Des interventions préparées et contrôlées',
  sousTitre: "Avant / après de nos interventions et formules d'entretien régulier.",
  abonnementsTitre: "Formules d'entretien régulier",
  abonnementsNote: 'Tarifs indicatifs : le prix final dépend de la surface, de l’état et de la fréquence.',
  cta: { label: 'Voir les réalisations', href: '/realisations' },
  lienSecondaire: { label: 'Découvrir les abonnements', href: '/abonnements' },
};

// ─── 6. Suivi de dossier en ligne ────────────────────────────
export const SUIVI_EN_LIGNE = {
  surtitre: 'Suivi en ligne',
  titre: 'Votre dossier, consultable à tout moment',
  texte:
    'Chaque demande reçoit un numéro de dossier et un lien de suivi personnel, envoyé par WhatsApp. Pas de compte à créer, pas de mot de passe à retenir.',
  points: [
    'Statut de votre dossier, étape par étape',
    'Pour un recrutement : devis à accepter en ligne',
    'Pour un recrutement : factures et reçus à télécharger',
    'Pour un recrutement : profils proposés',
  ],
  mention: 'Les 4 derniers chiffres de votre numéro WhatsApp protègent l’accès à vos documents.',
  icon: 'MonitorSmartphone',
  cta: { label: 'Faire une demande', href: '/contact' } satisfies Lien,
};

// ─── 7. Emploi / offres récentes ─────────────────────────────
export const EMPLOI_EN_TETE: EnTeteSection & { voirOffre: string; aucuneOffre: string; cta: Lien; lienSecondaire: Lien } = {
  surtitre: 'Emploi',
  titre: 'Vous cherchez un emploi ?',
  sousTitre: 'Consultez les offres en cours et créez votre profil candidat. C’est gratuit.',
  voirOffre: 'Voir l’offre et postuler',
  aucuneOffre: 'Aucune offre ouverte pour le moment : créez votre profil candidat pour être contacté(e) dès qu’une offre vous correspond.',
  cta: { label: 'Voir toutes les offres', href: '/recrutement' },
  lienSecondaire: { label: 'Créer mon profil', href: '/candidat/inscription' },
};

// ─── 8 à 10. En-têtes des sections existantes ────────────────
export const TEMOIGNAGES_EN_TETE: EnTeteSection = {
  surtitre: 'Avis clients',
  titre: 'Ils nous ont fait confiance',
  sousTitre: 'Seuls les avis vérifiés et autorisés par nos clients sont publiés.',
};

/**
 * Chiffres de preuve (audit design Q6), affichés en mono au-dessus de l'encart avis.
 * ⚠️ PROVISOIRE (décision du 2026-11-05) : valeurs fictives de lancement, sauf « villes couvertes ».
 * À remplacer par les chiffres réels de la direction dès qu'ils sont disponibles
 * (requête Back-Office : dossiers traités, placements confirmés, délai moyen de première réponse).
 * Tableau vide = bandeau masqué.
 */
export const CHIFFRES: { valeur: string; libelle: string }[] = [
  { valeur: '250+', libelle: 'dossiers traités' }, // PROVISOIRE
  { valeur: '120', libelle: 'placements confirmés' }, // PROVISOIRE
  { valeur: '24 h', libelle: 'délai moyen de première réponse' }, // PROVISOIRE
  { valeur: '2', libelle: 'villes couvertes : Douala et Yaoundé' },
];

/** Affiché seul tant qu'aucun avis n'est vérifié (docs/contenu.md, accueil). */
export const AVIS_ENCART = {
  titre: 'Vous avez fait appel à NEXCLEAN ?',
  texte: 'Votre avis nous aide à progresser et rassure nos futurs clients.',
  cta: 'Laisser un avis',
  whatsappMessage: 'Bonjour NEXCLEAN, je souhaite laisser un avis sur votre prestation :',
};

export const ZONES_EN_TETE = {
  surtitre: 'Zones',
  /** Le texte « Nous intervenons à {villes} » de CoverageSection est figé (test e2e) : ne pas le remplacer. */
  sousTitre: 'Propreté, espaces verts et recrutement : mêmes zones, même suivi.',
};

export const FAQ_EN_TETE: EnTeteSection = {
  surtitre: 'Questions fréquentes',
  titre: 'Vos questions, nos réponses',
  sousTitre: 'Services, recrutement, emploi et suivi en ligne.',
};

// ─── 11. CTA final ───────────────────────────────────────────
export const CTA_FINAL = {
  titre: 'Un service, du personnel ou un emploi ?',
  texte: 'Décrivez votre besoin : nous revenons vers vous sur WhatsApp avec la suite à donner.',
  cta: { label: 'Faire une demande', href: '/contact' } satisfies Lien,
  whatsapp: { label: 'Écrire sur WhatsApp', message: WHATSAPP_MESSAGE_DEFAUT },
};
