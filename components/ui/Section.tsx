import Container, { type ContainerVariant } from '@/components/ui/Container';
import { cx } from '@/components/ui/cx';

export type SectionTone = 'default' | 'muted' | 'dark' | 'brand';

interface SectionProps {
  children: React.ReactNode;
  /**
   * `default` blanc · `muted` ink-50 · `brand` brand-50 (fond teinté) ·
   * `dark` vert profond `navy` avec texte blanc (anneau de focus lime automatique).
   */
  tone?: SectionTone;
  id?: string;
  /** id du titre de la section (SectionHeader `id`) → `aria-labelledby`. */
  labelledBy?: string;
  /** Rythme vertical : `default` = py-section, `sm` = py-section-sm, `none` = aucun. */
  spacing?: 'default' | 'sm' | 'none';
  /** Conteneur interne ; `false` pour gérer la mise en page soi-même (pleine largeur). */
  container?: ContainerVariant | false;
  as?: 'section' | 'div' | 'aside';
  className?: string;
}

export const sectionToneClasses: Record<SectionTone, string> = {
  default: 'bg-white text-ink-900',
  muted: 'bg-ink-50 text-ink-900',
  brand: 'bg-brand-50 text-ink-900',
  dark: 'surface-dark bg-navy text-white',
};

const spacingClasses = {
  default: 'py-section',
  sm: 'py-section-sm',
  none: '',
};

/** Bloc de page : fond, rythme vertical et conteneur homogènes. */
export default function Section({
  children,
  tone = 'default',
  id,
  labelledBy,
  spacing = 'default',
  container = 'default',
  as: Comp = 'section',
  className,
}: SectionProps) {
  return (
    <Comp
      id={id}
      aria-labelledby={labelledBy}
      className={cx('relative', sectionToneClasses[tone], spacingClasses[spacing], className)}
    >
      {container ? <Container variant={container}>{children}</Container> : children}
    </Comp>
  );
}
