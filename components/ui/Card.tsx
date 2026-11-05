import Link from 'next/link';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

export type CardVariant = 'default' | 'interactive' | 'pillar';

interface CardProps {
  children: React.ReactNode;
  /**
   * `default` : carte statique · `interactive` : survol + focus (à utiliser avec `href`) ·
   * `pillar` : filet supérieur aux couleurs du pilier (`pillar` requis).
   */
  variant?: CardVariant;
  pillar?: PillarKey;
  /** Rend la carte entière cliquable (Link interne, `<a>` sinon). */
  href?: string;
  /** Nom accessible du lien, si le contenu ne suffit pas. */
  'aria-label'?: string;
  padding?: 'sm' | 'md' | 'lg';
  as?: 'div' | 'article' | 'li';
  className?: string;
}

const paddings = { sm: 'p-5', md: 'p-6 sm:p-7', lg: 'p-7 sm:p-10' };

/** Classes d'une carte, pour un élément qui ne peut pas utiliser <Card>. */
export function cardClasses({
  variant = 'default',
  pillar,
  padding = 'md',
  interactive,
  className,
}: {
  variant?: CardVariant;
  pillar?: PillarKey;
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  className?: string;
} = {}): string {
  const isInteractive = interactive ?? variant === 'interactive';
  const p = pillar ? PILLARS[pillar] : undefined;
  return cx(
    'group relative flex flex-col rounded-card bg-white border border-ink-100 shadow-card',
    paddings[padding],
    variant === 'pillar' &&
      cx('overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-1', p ? p.accentBar : 'before:bg-brand-400'),
    isInteractive &&
      cx(
        'transition-[box-shadow,border-color,transform] duration-300 ease-out-expo hover:shadow-card-hover motion-safe:hover:-translate-y-1',
        p ? p.hoverBorder : 'hover:border-brand-200',
      ),
    className,
  );
}

/** Carte unique du site (rayon, bordure, ombre homogènes). */
export default function Card({
  children,
  variant = 'default',
  pillar,
  href,
  'aria-label': ariaLabel,
  padding = 'md',
  as: Comp = 'div',
  className,
}: CardProps) {
  const classes = cardClasses({ variant, pillar, padding, interactive: variant === 'interactive' || (!!href && variant === 'pillar'), className });

  if (href) {
    const external = href.startsWith('http');
    const link = href.startsWith('/') ? (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {children}
      </Link>
    ) : (
      <a
        href={href}
        aria-label={ariaLabel}
        className={classes}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
    return Comp === 'li' ? <li className="flex">{link}</li> : link;
  }

  return <Comp className={classes}>{children}</Comp>;
}
