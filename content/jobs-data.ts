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

export interface Salary {
  base?: string;
  bonus?: string;
  target?: string;
  note?: string;
  /** true = salaire fixe (pas de prime liée aux objectifs) */
  fixed?: boolean;
}

export interface Job {
  slug: string;
  title: string;
  category: JobCategory;
  location: string;
  contract: string;
  status: 'open' | 'closed';
  /** Résumé court affiché sur la carte de la page /recrutement. */
  description: string;
  /** Liste courte des exigences affichée sur la carte. */
  requirements: string[];
  /** Paragraphe d'introduction détaillé (page de détail). */
  intro?: string;
  missions?: string[];
  profile?: string[];
  salary?: Salary;
  schedule?: string[];
  sector?: string;
  /** Nombre de postes à pourvoir (défaut : 1). */
  positions?: number;
}

export const jobs: Job[] = [
  // ────────────────────────────────────────────────────────────
  // OFFRES OUVERTES
  // ────────────────────────────────────────────────────────────
  {
    slug: 'community-manager-prospection',
    title: 'Community Manager & Chargé(e) de prospection commerciale',
    category: 'Community manager',
    location: 'Douala, Cameroun',
    contract: 'À préciser',
    status: 'open',
    description:
      "Développer la visibilité de NEXCLEAN SARL sur les réseaux sociaux et identifier de nouveaux clients via le numérique et le terrain.",
    requirements: [
      'Sérieux, honnête et véritable conscience professionnelle',
      'Maîtrise de Facebook, TikTok, WhatsApp Business',
      "À l'aise dans la prospection commerciale",
      'Orienté(e) résultats',
    ],
    intro:
      "NEXCLEAN SARL, entreprise camerounaise de nettoyage professionnel, recrute un(e) Community Manager & Chargé(e) de prospection commerciale pour renforcer sa présence numérique et développer son portefeuille clients à Douala. Rejoignez une entreprise ambitieuse et participez activement à son développement !",
    missions: [
      'Assurer la veille commerciale et identifier de nouveaux clients chaque jour.',
      'Prospecter sur le terrain, par téléphone, WhatsApp et les réseaux sociaux.',
      'Gérer et animer les réseaux sociaux de NEXCLEAN SARL.',
      'Présenter nos prestations et obtenir des rendez-vous commerciaux.',
      'Transformer les prospects en clients et développer les contrats mensuels.',
      'Assurer le suivi des prospects et produire un rapport hebdomadaire des résultats.',
      'Collaborer avec les responsables des opérations.',
    ],
    profile: [
      "Sérieux, honnête et doté(e) d'une véritable conscience professionnelle.",
      "Orienté(e) résultats, motivé(e) par la réussite collective et la satisfaction des clients.",
      'Organisé(e), autonome, ponctuel(le) et capable de travailler en équipe.',
      "À l'aise dans la communication, la négociation et la prospection commerciale.",
      'Maîtrisant WhatsApp Business, Facebook, TikTok et les outils numériques courants.',
      "Capable de prendre des initiatives et d'atteindre des objectifs mensuels.",
      'Une expérience en prospection commerciale ou en community management serait un atout.',
    ],
    salary: {
      base: '40 000 FCFA/mois',
      bonus: "Jusqu'à 11 000 FCFA/mois selon les objectifs",
      target: '51 000 FCFA/mois',
      note: "Les objectifs et les conditions d'attribution des primes seront précisés lors de l'entretien et dans le contrat.",
    },
  },
  {
    slug: 'agent-caisse-akwa',
    title: 'Agent de caisse (H/F) — 2 postes',
    category: 'Agent de caisse',
    location: 'Akwa, Douala (secteur bureaux de transport)',
    contract: 'À préciser',
    status: 'open',
    positions: 2,
    sector: 'Cave – Vente de boissons',
    description:
      "Accueillir les clients, encaisser les paiements, tenir la caisse avec rigueur et transparence dans une cave à Akwa.",
    requirements: [
      'Conscience professionnelle, loyauté et honnêteté',
      'Bonne communication et sens du service client',
      'Ponctualité, organisation, bienveillance et sourire',
      'Expérience en caisse ou vente de boissons (atout)',
    ],
    intro:
      "NEXCLEAN SARL recrute en urgence 2 agents de caisse pour une cave située à Akwa, secteur des bureaux de transport à Douala. Vous serez en charge de l'accueil des clients et de la gestion rigoureuse de la caisse.",
    missions: [
      'Accueillir les clients avec bienveillance, courtoisie et sourire.',
      'Encaisser les paiements et rendre correctement la monnaie.',
      'Enregistrer les ventes et vérifier les montants encaissés.',
      'Assurer une gestion rigoureuse et transparente de la caisse.',
      "Effectuer le point de caisse à chaque changement d'équipe.",
      'Signaler immédiatement toute anomalie au responsable.',
      'Maintenir son poste de travail propre et organisé.',
      'Respecter les consignes et contribuer à la satisfaction des clients.',
    ],
    profile: [
      'Conscience professionnelle : accomplir ses missions avec sérieux et responsabilité.',
      "Loyauté et honnêteté : respecter l'entreprise, les clients et les règles de gestion de caisse.",
      'Motivation : aimer son travail et avoir la volonté de bien faire.',
      "Bonne communication : savoir écouter, s'exprimer clairement et travailler en équipe.",
      'Bienveillance et sourire : accueillir chaque client avec respect et bonne humeur.',
      'Ponctualité : respecter les horaires et les engagements professionnels.',
      'Organisation : savoir gérer les priorités et tenir une caisse correctement.',
      'Une expérience en caisse ou dans la vente de boissons constitue un atout.',
    ],
    salary: {
      base: '50 000 FCFA/mois',
      fixed: true,
      note: 'Salaire mensuel fixe, sans condition de prime de performance.',
    },
    schedule: [
      'Équipe de jour : 08h00 – 18h00',
      'Équipe de nuit : 18h00 – 08h00',
      'Rotation selon le planning établi ; horaires effectifs, pauses, rotations et jours de repos organisés conformément à la réglementation applicable.',
    ],
  },
  {
    slug: 'community-manager',
    title: 'Community Manager (H/F)',
    category: 'Community manager',
    location: 'Douala, Cameroun',
    contract: 'À préciser',
    status: 'open',
    description:
      "Gérer et animer les réseaux sociaux de NEXCLEAN SARL (Facebook, TikTok, WhatsApp Business), créer des contenus attractifs et générer des prospects qualifiés.",
    requirements: [
      'Sérieux, honnête, motivé(e) et créatif(ve)',
      'Excellente communication écrite et orale',
      'Maîtrise de Facebook, TikTok, WhatsApp Business',
      'Orienté(e) résultats',
    ],
    intro:
      "NEXCLEAN SARL renforce son équipe marketing et recrute un(e) Community Manager pour développer sa visibilité et générer de nouveaux clients grâce au numérique. Vous travaillerez sur Facebook, TikTok et WhatsApp Business pour promouvoir nos prestations de nettoyage professionnel.",
    missions: [
      'Gérer et animer nos pages Facebook, TikTok et nos autres réseaux sociaux.',
      'Créer des publications attractives présentant nos prestations et réalisations.',
      'Assurer une veille commerciale quotidienne sur Internet.',
      'Identifier des prospects à Douala, Yaoundé et Kribi.',
      'Contacter les prospects par WhatsApp, téléphone et réseaux sociaux.',
      'Répondre rapidement aux demandes des clients.',
      "Obtenir des rendez-vous commerciaux pour l'équipe opérationnelle.",
      "Suivre les prospects jusqu'à leur transformation en clients.",
      'Présenter chaque semaine un rapport des actions et résultats obtenus.',
    ],
    profile: [
      "Sérieux, honnête et doté(e) d'une véritable conscience professionnelle.",
      'Motivé(e), créatif(ve) et orienté(e) résultats.',
      'Loyal(e), organisé(e), autonome et ponctuel(le).',
      "Doté(e) d'une excellente communication écrite et orale.",
      'Bienveillant(e), respectueux(se) et capable de travailler en équipe.',
      'Maîtrisant Facebook, TikTok, WhatsApp Business et les outils de création de contenu.',
      "Nous privilégions les personnes qui prennent des initiatives et savent transformer leur travail en résultats concrets.",
    ],
    salary: {
      base: '40 000 FCFA/mois',
      bonus: "Jusqu'à 11 000 FCFA/mois selon les objectifs",
      target: '51 000 FCFA/mois',
      note: 'Les primes dépendront notamment des prospects qualifiés, des rendez-vous obtenus et des nouveaux clients acquis grâce aux actions numériques.',
    },
  },
  {
    slug: 'prospection-commerciale-terrain',
    title: 'Chargé(e) de prospection commerciale terrain (H/F)',
    category: 'Commercial',
    location: 'Douala, Cameroun',
    contract: 'À préciser',
    status: 'open',
    description:
      "Prospecter quotidiennement les entreprises, restaurants, hôtels, bureaux et commerces pour développer le portefeuille commercial de NEXCLEAN SARL.",
    requirements: [
      'Conscience professionnelle irréprochable',
      'Très motivé(e) et orienté(e) objectifs',
      "À l'aise dans la communication",
      'Disponible pour des déplacements quotidiens',
    ],
    intro:
      "NEXCLEAN SARL recrute un(e) Chargé(e) de prospection commerciale terrain pour développer son portefeuille clients à Douala. Vous prospecterez quotidiennement les entreprises, restaurants, hôtels, bureaux et commerces pour présenter nos prestations de nettoyage professionnel.",
    missions: [
      'Prospecter quotidiennement les entreprises, restaurants, hôtels, bureaux, commerces, résidences et autres établissements.',
      'Identifier les besoins des prospects en nettoyage et entretien.',
      'Présenter clairement les prestations et les avantages de NexClean.',
      'Distribuer les supports commerciaux et recueillir les contacts professionnels.',
      'Obtenir des rendez-vous pour les visites techniques et les devis.',
      "Relancer régulièrement les prospects jusqu'à l'obtention d'une réponse.",
      'Contribuer à la signature de nouveaux contrats mensuels.',
      'Développer des partenariats commerciaux durables.',
      'Renseigner le fichier de suivi commercial.',
      'Présenter chaque semaine un compte rendu des visites, rendez-vous et résultats.',
    ],
    profile: [
      "Doté(e) d'une conscience professionnelle irréprochable.",
      'Sérieux(se), honnête, loyal(e) et ponctuel(le).',
      'Très motivé(e) et capable de travailler avec des objectifs.',
      "À l'aise dans la communication et le contact avec les clients.",
      'Souriant(e), bienveillant(e), respectueux(se) et persuasif(ve).',
      'Organisé(e), autonome et capable de travailler en équipe.',
      'Persévérant(e) face aux refus et capable de prendre des initiatives.',
      'Disponible pour effectuer des déplacements quotidiens sur le terrain.',
      'Une expérience en prospection, vente ou développement commercial constitue un atout.',
    ],
    salary: {
      base: '40 000 FCFA/mois',
      bonus: "Jusqu'à 11 000 FCFA/mois selon les objectifs",
      target: '51 000 FCFA/mois',
      note: 'La prime sera liée à des objectifs commerciaux mesurables, notamment les rendez-vous qualifiés et les nouveaux contrats signés.',
    },
  },

  // ────────────────────────────────────────────────────────────
  // OFFRES FERMÉES (archives)
  // ────────────────────────────────────────────────────────────
  {
    slug: 'agent-nettoyage',
    title: 'Agent(e) de nettoyage',
    category: 'Agent de nettoyage',
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: 'Réaliser les prestations de nettoyage chez nos clients particuliers et professionnels.',
    requirements: ['Ponctualité et sérieux', 'Expérience en nettoyage appréciée', 'Disponibilité selon planning'],
  },
  {
    slug: 'chef-equipe',
    title: "Chef(fe) d'équipe",
    category: "Chef d'équipe",
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: "Encadrer une équipe d'agents, organiser les interventions et contrôler la qualité.",
    requirements: ['Expérience en encadrement', "Sens de l'organisation", 'Rigueur sur la qualité'],
  },
  {
    slug: 'agent-espaces-verts',
    title: 'Agent espaces verts',
    category: 'Agent espaces verts',
    location: 'Douala',
    contract: 'À préciser',
    status: 'closed',
    description: 'Tonte, débroussaillage, taille de haies et entretien des jardins de nos clients.',
    requirements: ['Expérience en jardinage / entretien', 'Bonne condition physique'],
  },
  {
    slug: 'commercial',
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

export const getJobBySlug = (slug: string) => jobs.find((j) => j.slug === slug);

export const CV_MAX_SIZE_MB = 4;
