/**
 * Piliers d'activité (D-01) et leurs classes de couleur (D-06).
 * Les chaînes sont écrites en entier pour que Tailwind les détecte.
 * Texte/icône `pillar-*` : AA sur blanc et sur le fond doux (voir docs/design-system.md).
 */
export type PillarKey = 'proprete' | 'recrutement' | 'espaces-verts' | 'emploi' | 'boutique';

export interface PillarStyle {
  /** Libellé par défaut (badge). */
  label: string;
  /** Texte / icône. */
  text: string;
  /** Fond doux. */
  soft: string;
  /** Bordure / filet discret. */
  border: string;
  /** Filet supérieur des cartes de pilier. */
  accentBar: string;
  /** Survol d'une carte interactive. */
  hoverBorder: string;
}

export const PILLARS: Record<PillarKey, PillarStyle> = {
  proprete: {
    label: 'Propreté & hygiène',
    text: 'text-pillar-proprete',
    soft: 'bg-pillar-proprete-soft',
    border: 'border-pillar-proprete-border',
    accentBar: 'before:bg-pillar-proprete',
    hoverBorder: 'hover:border-pillar-proprete',
  },
  recrutement: {
    label: 'Recrutement & placement',
    text: 'text-pillar-recrutement',
    soft: 'bg-pillar-recrutement-soft',
    border: 'border-pillar-recrutement-border',
    accentBar: 'before:bg-pillar-recrutement',
    hoverBorder: 'hover:border-pillar-recrutement',
  },
  'espaces-verts': {
    label: 'Espaces verts',
    text: 'text-pillar-espaces-verts',
    soft: 'bg-pillar-espaces-verts-soft',
    border: 'border-pillar-espaces-verts-border',
    accentBar: 'before:bg-pillar-espaces-verts',
    hoverBorder: 'hover:border-pillar-espaces-verts',
  },
  emploi: {
    label: 'Emploi',
    text: 'text-pillar-emploi',
    soft: 'bg-pillar-emploi-soft',
    border: 'border-pillar-emploi-border',
    accentBar: 'before:bg-pillar-emploi',
    hoverBorder: 'hover:border-pillar-emploi',
  },
  boutique: {
    label: 'Boutique',
    text: 'text-pillar-boutique',
    soft: 'bg-pillar-boutique-soft',
    border: 'border-pillar-boutique-border',
    accentBar: 'before:bg-pillar-boutique',
    hoverBorder: 'hover:border-pillar-boutique',
  },
};
