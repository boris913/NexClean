// ⚠️ Avis à vérifier : passer `verified: true` pour chaque avis réel et autorisé.
export interface Testimonial {
  id: number;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
  date: string;
  /**
   * true UNIQUEMENT si l'avis est réel, traçable (WhatsApp, Google, e-mail…)
   * et que le client a autorisé la publication de son nom / entreprise.
   * Seuls les avis vérifiés sont affichés sur le site.
   */
  verified: boolean;
}

export const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Marie K.',
    location: 'Bonapriso',
    rating: 5,
    comment: 'Service impeccable ! Mon appartement est resplendissant. L\'agent était ponctuel et très professionnel. Je recommande vivement NexClean.',
    service: 'Nettoyage appartement 2 chambres',
    verified: false,
    date: '2026-01-15',
  },
  {
    id: 2,
    name: 'Dr. Nguena',
    location: 'Akwa',
    rating: 5,
    comment: 'Excellent travail pour mon cabinet médical. La désinfection est parfaite et mes patients apprécient la propreté. Abonnement mensuel très pratique.',
    service: 'Nettoyage professionnel + désinfection',
    verified: false,
    date: '2026-01-20',
  },
  {
    id: 3,
    name: 'Paul M.',
    location: 'Bonanjo',
    rating: 5,
    comment: 'Après mes travaux de rénovation, NexClean a tout remis en état. Plus une trace de poussière ! Prix correct et équipe sérieuse.',
    service: 'Nettoyage après travaux',
    verified: false,
    date: '2026-01-18',
  },
  {
    id: 4,
    name: 'Ets. SOGECO',
    location: 'Bali',
    rating: 5,
    comment: 'Nous faisons appel à NexClean 2 fois par semaine pour nos bureaux. Toujours à l\'heure, toujours propre. Très satisfaits !',
    service: 'Abonnement bureau',
    verified: false,
    date: '2026-01-22',
  },
  {
    id: 5,
    name: 'Claire T.',
    location: 'Makepe',
    rating: 5,
    comment: 'Mes vitres n\'ont jamais été aussi propres ! Sans traces, brillantes. Je prends maintenant l\'abonnement mensuel.',
    service: 'Nettoyage vitres',
    verified: false,
    date: '2026-01-25',
  },
  {
    id: 6,
    name: 'Kossi D.',
    location: 'Bonaberi',
    rating: 4,
    comment: 'NexClean a fait un excellent travail pour ma maison. Les sols sont désormais impeccables. Je recommande vivement !',
    service: 'Nettoyage maison',
    verified: false,
    date: '2026-02-28',
  },
];

export const verifiedTestimonials = testimonials.filter((t) => t.verified);
