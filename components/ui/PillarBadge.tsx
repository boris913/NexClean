import type { LucideIcon } from 'lucide-react';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

interface PillarBadgeProps {
  pillar: PillarKey;
  /** Icône lucide facultative (décorative). */
  icon?: LucideIcon;
  /** Libellé ; par défaut celui du pilier (ex. « Espaces verts »). */
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/** Étiquette de pilier : la clé donne la couleur (texte AA sur fond doux). */
export default function PillarBadge({ pillar, icon: Icon, children, size = 'sm', className }: PillarBadgeProps) {
  const p = PILLARS[pillar];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        p.soft,
        p.text,
        p.border,
        className,
      )}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true" />}
      {children ?? p.label}
    </span>
  );
}
