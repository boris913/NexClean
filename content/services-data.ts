export interface Service {
  id: number;
  name: string;
  icon: string;
  priceRange: string;
  description: string;
  includes: string[];
  category: 'particulier' | 'professionnel';
}

export const services: Service[] = [
  {
    id: 1,
    name: 'Nettoyage Maison',
    icon: 'Home',
    priceRange: '8 000 – 25 000 FCFA',
    description: 'Nettoyage complet de votre maison ou appartement. Sols, surfaces, sanitaires et cuisine impeccables.',
    includes: ['Sols et carrelages', 'Dépoussiérage complet', 'Sanitaires et cuisine', 'Désinfection basique'],
    category: 'particulier',
  },
  {
    id: 2,
    name: 'Nettoyage Bureau',
    icon: 'Building2',
    priceRange: '15 000 – 50 000 FCFA',
    description: 'Espace de travail professionnel et sain pour vos équipes. Adapté aux bureaux et commerces.',
    includes: ['Espaces de travail', 'Salles de réunion', 'Sanitaires professionnels', 'Désinfection renforcée'],
    category: 'professionnel',
  },
  {
    id: 3,
    name: 'Nettoyage Vitres',
    icon: 'Minimize2',
    priceRange: '5 000 – 15 000 FCFA',
    description: 'Vitres brillantes sans traces. Intérieur et extérieur pour une clarté maximale.',
    includes: ['Vitres intérieures', 'Vitres extérieures', 'Miroirs', 'Baies vitrées'],
    category: 'particulier',
  },
  {
    id: 4,
    name: 'Désinfection Complète',
    icon: 'ShieldCheck',
    priceRange: '10 000 – 30 000 FCFA',
    description: 'Désinfection professionnelle de tous les espaces. Protection sanitaire maximale.',
    includes: ['Désinfection surfaces', 'Sanitaires', 'Poignées et interrupteurs', 'Zones à risque'],
    category: 'professionnel',
  },
  {
    id: 5,
    name: 'Après Travaux',
    icon: 'HardHat',
    priceRange: '20 000 – 60 000 FCFA',
    description: 'Remise en état après construction ou rénovation. Élimination complète de la poussière et des débris.',
    includes: ['Retrait poussière', 'Nettoyage profond', 'Vitres et sols', 'Finitions'],
    category: 'particulier',
  },
  {
    id: 6,
    name: 'Abonnement Mensuel',
    icon: 'CalendarCheck',
    priceRange: 'À partir de 30 000 FCFA/mois',
    description: 'Passages réguliers avec tarifs préférentiels. Propreté garantie toute l\'année.',
    includes: ['Planning personnalisé', 'Prix réduits', 'Priorité intervention', 'Agent dédié'],
    category: 'particulier',
  },
];
