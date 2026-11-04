import type { LucideIcon } from 'lucide-react';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';

export type IconBadgeTone = PillarKey | 'brand' | 'neutral' | 'dark' | 'cta' | 'success' | 'danger' | 'warning' | 'info';

interface IconBadgeProps {
  icon: LucideIcon;
  /** Couleur : clé de pilier ou ton sémantique. */
  tone?: IconBadgeTone;
  size?: 'sm' | 'md' | 'lg';
  /** Forme : carré arrondi (défaut) ou rond. */
  shape?: 'rounded' | 'circle';
  /** Nom accessible si l'icône porte du sens ; sinon décorative (aria-hidden). */
  label?: string;
  className?: string;
}

const toneClasses: Record<Exclude<IconBadgeTone, PillarKey>, string> = {
  brand: 'bg-brand-100 text-brand-700',
  neutral: 'bg-ink-100 text-ink-700',
  dark: 'bg-white/10 text-brand-300',
  cta: 'bg-cta text-ink-900',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
};

const sizes = {
  sm: { box: 'w-9 h-9', icon: 'w-4 h-4', radius: 'rounded-xl' },
  md: { box: 'w-12 h-12', icon: 'w-5 h-5', radius: 'rounded-2xl' },
  lg: { box: 'w-14 h-14', icon: 'w-6 h-6', radius: 'rounded-2xl' },
};

function colorsFor(tone: IconBadgeTone): string {
  if (tone in PILLARS) {
    const p = PILLARS[tone as PillarKey];
    return cx(p.soft, p.text);
  }
  return toneClasses[tone as Exclude<IconBadgeTone, PillarKey>];
}

/** Pastille d'icône lucide (pictogramme de service, d'étape, d'état…). */
export default function IconBadge({ icon: Icon, tone = 'brand', size = 'md', shape = 'rounded', label, className }: IconBadgeProps) {
  const s = sizes[size];
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center', s.box, shape === 'circle' ? 'rounded-full' : s.radius, colorsFor(tone), className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Icon className={s.icon} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
