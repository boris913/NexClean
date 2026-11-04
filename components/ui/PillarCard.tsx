import { ArrowRight, type LucideIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

interface PillarCardProps {
  pillar: PillarKey;
  /** Icône lucide du pilier. */
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rend la carte cliquable. */
  href?: string;
  /** Libellé du lien en pied de carte (affiché si `href`). */
  ctaLabel?: string;
  /** Niveau du titre (h3 par défaut, dans une section titrée en h2). */
  headingAs?: 'h2' | 'h3' | 'h4';
  /** Contenu libre sous la description (liste, prix…). */
  children?: React.ReactNode;
  as?: 'div' | 'article' | 'li';
  className?: string;
}

/** Carte d'entrée vers un pilier (accueil « trois portes », pages hub). */
export default function PillarCard({
  pillar,
  icon,
  title,
  description,
  href,
  ctaLabel = 'Découvrir',
  headingAs: Heading = 'h3',
  children,
  as,
  className,
}: PillarCardProps) {
  const p = PILLARS[pillar];
  return (
    <Card variant="pillar" pillar={pillar} href={href} as={as} className={cx('h-full', className)}>
      <IconBadge icon={icon} tone={pillar} size="lg" className="mb-5" />
      <Heading className="font-display text-h3 text-ink-900">{title}</Heading>
      {description && <p className="mt-2 text-small text-ink-600">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
      {href && (
        <span className={cx('mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-semibold', p.text)}>
          {ctaLabel}
          <ArrowRight className="w-4 h-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      )}
    </Card>
  );
}
