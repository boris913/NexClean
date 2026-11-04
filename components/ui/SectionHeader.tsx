import SectionLabel from '@/components/ui/SectionLabel';
import { cx } from '@/components/ui/cx';
import type { PillarKey } from '@/components/ui/pillars';

interface SectionHeaderProps {
  /** Titre (texte ou nœud, ex. avec `<span className="highlight">`). */
  title: React.ReactNode;
  /** Surtitre court, rendu par SectionLabel. */
  eyebrow?: React.ReactNode;
  /** Paragraphe d'introduction (taille `lead`). */
  intro?: React.ReactNode;
  /** Niveau de titre : h2 par défaut ; h1 seulement s'il n'y a pas de PageHero. */
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
  /** id du titre, à passer à `<Section labelledBy>`. */
  id?: string;
  /** `dark` sur une Section `tone="dark"`. */
  tone?: 'light' | 'dark';
  pillar?: PillarKey;
  /** Actions (boutons) sous l'intro. */
  actions?: React.ReactNode;
  className?: string;
}

const titleSize = { h1: 'text-h1', h2: 'text-h2', h3: 'text-h3' };

/** En-tête de section : surtitre + titre + intro, une seule échelle typographique. */
export default function SectionHeader({
  title,
  eyebrow,
  intro,
  as: Heading = 'h2',
  align = 'left',
  id,
  tone = 'light',
  pillar,
  actions,
  className,
}: SectionHeaderProps) {
  const centered = align === 'center';
  return (
    <div className={cx('max-w-3xl mb-10 sm:mb-14', centered && 'mx-auto text-center', className)}>
      {eyebrow && (
        <SectionLabel tone={tone} pillar={pillar} className="mb-4">
          {eyebrow}
        </SectionLabel>
      )}
      <Heading id={id} className={cx('font-display', titleSize[Heading], tone === 'dark' ? 'text-white' : 'text-ink-900')}>
        {title}
      </Heading>
      {intro && (
        <p className={cx('mt-4 text-lead', tone === 'dark' ? 'text-brand-100' : 'text-ink-600', centered && 'mx-auto')}>
          {intro}
        </p>
      )}
      {actions && (
        <div className={cx('mt-8 flex flex-col sm:flex-row gap-3', centered && 'sm:justify-center')}>{actions}</div>
      )}
    </div>
  );
}
