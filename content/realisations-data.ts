// ============================================================
// RÉALISATIONS — chaque entrée est une mini preuve commerciale :
// AVANT → problème → intervention → APRÈS → type → lieu → durée → avis.
// N'utiliser que des photos NexClean réelles (pas d'images générées).
// ============================================================

export const REALISATION_FILTERS = [
  'Nettoyage intérieur',
  'Bureaux',
  'Fin de chantier',
  'Espaces verts',
  'Haute pression',
  'Vitres',
  'Autres',
] as const;

export type RealisationFilter = (typeof REALISATION_FILTERS)[number];

export interface Realisation {
  id: string;
  title: string;
  filter: RealisationFilter;
  serviceType: string;
  location: string;
  duration?: string;
  problem: string;
  intervention: string;
  before?: { src: string; alt: string };
  during?: { src: string; alt: string };
  after?: { src: string; alt: string };
  /** Avis client — uniquement avec son autorisation. */
  review?: { text: string; author: string };
}

export const realisations: Realisation[] = [
  {
    id: 'chambre-douala',
    title: "Remise en propreté d'une chambre",
    filter: 'Nettoyage intérieur',
    serviceType: 'Nettoyage maison',
    location: 'Douala',
    problem: 'Chambre poussiéreuse, toiles d\'araignée en hauteur et traces sur les murs.',
    intervention: 'Dépoussiérage des hauteurs et des rideaux, nettoyage des murs accessibles et lavage des sols.',
    before: { src: '/images/blog/avant-intervention.jpeg', alt: 'Chambre avant intervention NexClean à Douala' },
    during: { src: '/images/blog/pendant.jpeg', alt: 'Agent NexClean dépoussiérant les hauteurs d\'une chambre' },
  },
];

/** Photos d'équipe en intervention (réelles). */
export const fieldPhotos = [
  { src: '/images/team/equipe-nexclean1.jpeg', alt: 'Agent NexClean en intervention' },
  { src: '/images/team/equipe-nexclean2.jpeg', alt: 'Équipe NexClean au travail' },
  { src: '/images/team/equipe-nexclean3.jpeg', alt: 'Intervention NexClean' },
  { src: '/images/team/equipe-nexclean4.jpeg', alt: 'Matériel NexClean en intervention' },
  { src: '/images/team/equipe-nexclean6.jpeg', alt: 'Équipe NexClean en intervention' },
  { src: '/images/team/equipe-nexclean8.jpeg', alt: 'Nettoyage par NexClean' },
];
