// ============================================================
// RECRUTEMENT — offres d'emploi.
// Passer `status` à 'open' / 'closed' pour ouvrir ou fermer une offre.
// ============================================================

export const JOB_CATEGORIES = [
  'Agent de nettoyage',
  "Chef d'équipe",
  'Commercial',
  'Community manager',
  'Agent de caisse',
  'Administratif / RH',
  'Agent espaces verts',
  'Stage / Alternance',
  'Candidature spontanée',
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export interface Job {
  id: string;
  title: string;
  category: JobCategory;
  location: string;
  contract: string;
  status: 'open' | 'closed';
  description: string;
  requirements: string[];
}

export const jobs: Job[] = [
  // ────────────────────────────────────────────────────────────
  // OFFRES OUVERTES
  // ────────────────────────────────────────────────────────────
  {
    id: 'community-manager-prospection',
    title: 'Community Manager & Chargé(e) de prospection commerciale',
    category: 'Community manager',
    location: 'Douala',
    contract: 'À préciser',
    status: 'open',
    description:
      "Développer la visibilité de NEXCLEAN SARL sur les réseaux sociaux et identifier de nouveaux clients via le numérique et le terrain. Rémunération : 40 000 FCFA/mois + primes jusqu'à 11 000 FCFA (cible 51 000 FCFA/mois).",
    requirements: [
      'Sérieux, honnête et véritable conscience professionnelle',
      "Maîtrise de Facebook, TikTok, WhatsApp Business et des outils numériques courants",
      "À l'aise dans la communication, la négociation et la prospection commerciale",
      'Organisé(e), autonome, ponctuel(le) et orienté(e) résultats',
      'Expérience en prospection ou community management appréciée',
    ],
  },
  {
    id: 'agent-caisse-akwa',
    title: 'Agent de caisse (H/F) — 2 postes',
    category: 'Agent de caisse',
    location: 'Akwa, Douala (secteur bureaux de transport)',
    contract: 'À préciser',
    status: 'open',
    description:
      "Accueillir les clients, encaisser les paiements, tenir la caisse avec rigueur et transparence dans une cave à Akwa. Salaire fixe : 50 000 FCFA/mois. Rotation équipe de jour (08h–18h) et équipe de nuit (18h–08h).",
    requirements: [
      'Conscience professionnelle, loyauté et honnêteté',
      'Bonne communication et sens du service client',
      'Ponctualité, organisation, bienveillance et sourire',
      'Expérience en caisse ou vente de boissons (atout)',
      'Disponible pour les rotations jour / nuit',
    ],
  },
  {
    id: 'community-manager',
    title: 'Community Manager (H/F)',
    category: 'Community manager',
    location: 'Douala',
    contract: 'À préciser',
    status: 'open',
    description:
      "Gérer et animer les réseaux sociaux de NEXCLEAN SARL (Facebook, TikTok, WhatsApp Business), créer des contenus attractifs et générer des prospects qualifiés. Rémunération : 40 000 FCFA/mois + primes jusqu'à 11 000 FCFA (cible 51 000 FCFA/mois).",
    requirements: [
      'Sérieux, honnête, motivé(e) et créatif(ve)',
      'Excellente communication écrite et orale',
      'Maîtrise de Facebook, TikTok, WhatsApp Business et outils de création de contenu',
      'Organisé(e), autonome, ponctuel(le) et orienté(e) résultats',
      'Capacité à prendre des initiatives et à atteindre des objectifs mensuels',
    ],
  },
  {
    id: 'prospection-commerciale-terrain',
    title: 'Chargé(e) de prospection commerciale terrain (H/F)',
    category: 'Commercial',
    location: 'Douala',
    contract: 'À préciser',
    status: 'open',
    description:
      "Prospecter quotidiennement les entreprises, restaurants, hôtels, bureaux et commerces pour développer le portefeuille commercial de NEXCLEAN SARL. Rémunération : 40 000 FCFA/mois + primes jusqu'à 11 000 FCFA (cible 51 000 FCFA/mois).",
    requirements: [
      'Conscience professionnelle irréprochable, sérieux, honnête et loyal',
      "Très motivé(e), à l'aise au contact, souriant(e) et persévérant(e)",
      'Organisé(e), autonome et capable de travailler en équipe',
      'Disponible pour des déplacements quotidiens sur le terrain',
      'Expérience en prospection, vente ou développement commercial (atout)',
    ],
  },

  // ────────────────────────────────────────────────────────────
  // OFFRES FERMÉES (archives)
  // ────────────────────────────────────────────────────────────
  {
    id: 'agent-nettoyage',
    title: 'Agent(e) de nettoyage',
    category: 'Agent de nettoyage',
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: 'Réaliser les prestations de nettoyage chez nos clients particuliers et professionnels.',
    requirements: ['Ponctualité et sérieux', 'Expérience en nettoyage appréciée', 'Disponibilité selon planning'],
  },
  {
    id: 'chef-equipe',
    title: "Chef(fe) d'équipe",
    category: "Chef d'équipe",
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: "Encadrer une équipe d'agents, organiser les interventions et contrôler la qualité.",
    requirements: ['Expérience en encadrement', "Sens de l'organisation", 'Rigueur sur la qualité'],
  },
  {
    id: 'agent-espaces-verts',
    title: 'Agent espaces verts',
    category: 'Agent espaces verts',
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: 'Tonte, débroussaillage, taille de haies et entretien des jardins de nos clients.',
    requirements: ['Expérience en jardinage / entretien', 'Bonne condition physique'],
  },
  {
    id: 'commercial',
    title: 'Commercial(e)',
    category: 'Commercial',
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: 'Développer le portefeuille de clients professionnels et promouvoir les produits NexClean.',
    requirements: ['Aisance relationnelle', 'Expérience en prospection B2B appréciée'],
  },
];

export const openJobs = jobs.filter((j) => j.status === 'open');

export const CV_MAX_SIZE_MB = 4;
