// Navigation du site public (docs/decisions.md D-05, docs/contenu.md §2).
// Partagée par le Header et le Footer. Aucune URL ne change.
// Libellés à ne pas modifier sans relire les notes d'intégration : « Espace candidat » et
// « Créer mon profil » évitent toute collision avec les liens testés sur /recrutement.

import { CTA_FINAL, type Lien } from '@/content/home-data';

export interface MenuNav {
  id: string;
  label: string;
  liens: Lien[];
  /** Le menu contient-il la page courante ? */
  actif: (pathname: string) => boolean;
}

const commencePar = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const DEMANDE_PERSONNEL = '/recrutement/demander-du-personnel';

export const MENUS_NAV: MenuNav[] = [
  {
    id: 'services',
    label: 'Services',
    liens: [
      { label: 'Propreté', href: '/services' },
      { label: 'Espaces verts', href: '/espaces-verts' },
      { label: 'Abonnements', href: '/abonnements' },
      { label: 'Particuliers', href: '/particuliers' },
      { label: 'Professionnels', href: '/professionnels' },
    ],
    actif: (p) => commencePar(p, ['/services', '/espaces-verts', '/abonnements', '/particuliers', '/professionnels']),
  },
  {
    id: 'recrutement',
    label: 'Recrutement',
    liens: [
      { label: 'Demander du personnel', href: DEMANDE_PERSONNEL },
      { label: 'Le placement en bref', href: '/recrutement#placement' },
    ],
    actif: (p) => commencePar(p, [DEMANDE_PERSONNEL]),
  },
  {
    id: 'emploi',
    label: 'Emploi',
    liens: [
      { label: "Offres d'emploi", href: '/recrutement' },
      { label: 'Créer mon profil', href: '/candidat/inscription' },
      { label: 'Espace candidat', href: '/candidat/connexion' },
    ],
    actif: (p) => commencePar(p, ['/recrutement', '/candidat']) && !commencePar(p, [DEMANDE_PERSONNEL]),
  },
];

export const LIENS_NAV: Lien[] = [
  { label: 'Boutique', href: '/boutique' },
  { label: 'Réalisations', href: '/realisations' },
  { label: 'À propos', href: '/a-propos' },
];

/** CTA global, libellé unique (header, barre mobile, footer, CTA final). */
export const CTA_DEMANDE: Lien = CTA_FINAL.cta;

export const estLienActif = (pathname: string, href: string) => commencePar(pathname, [href]);

export const FOOTER_COLONNES: { titre: string; liens: Lien[] }[] = [
  { titre: 'Services', liens: MENUS_NAV[0].liens },
  {
    titre: 'Recrutement & emploi',
    liens: [
      { label: 'Demander du personnel', href: DEMANDE_PERSONNEL },
      { label: "Offres d'emploi", href: '/recrutement' },
      { label: 'Créer mon profil', href: '/candidat/inscription' },
      { label: 'Espace candidat', href: '/candidat/connexion' },
    ],
  },
  {
    titre: 'Entreprise',
    liens: [
      { label: 'À propos', href: '/a-propos' },
      { label: 'Réalisations', href: '/realisations' },
      { label: 'Blog', href: '/blog' },
      { label: 'Tarifs', href: '/tarifs' },
      { label: 'Boutique', href: '/boutique' },
    ],
  },
];

export const FOOTER_LEGAL: Lien[] = [
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'Confidentialité', href: '/confidentialite' },
  { label: 'CGV', href: '/cgv' },
];
