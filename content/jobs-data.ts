// ============================================================
// RECRUTEMENT — offres d'emploi.
// Passer `status` à 'open' / 'closed' pour ouvrir ou fermer une offre.
// ============================================================

export const JOB_CATEGORIES = [
  'Agent de nettoyage',
  "Chef d'équipe",
  'Commercial',
  'Community manager',
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
    requirements: ['Expérience en encadrement', 'Sens de l\'organisation', 'Rigueur sur la qualité'],
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
