import { cx } from '@/components/ui/cx';

export type ContainerVariant = 'default' | 'narrow';

interface ContainerProps {
  children: React.ReactNode;
  /** `default` = 72rem (pages, header, footer) ; `narrow` = 48rem (formulaires, FAQ, textes longs). */
  variant?: ContainerVariant;
  as?: 'div' | 'section' | 'header' | 'footer' | 'nav' | 'main' | 'article';
  className?: string;
  id?: string;
}

export const containerClasses: Record<ContainerVariant, string> = {
  default: 'w-full max-w-container mx-auto px-4 sm:px-6 lg:px-8',
  narrow: 'w-full max-w-container-narrow mx-auto px-4 sm:px-6 lg:px-8',
};

/** Largeur de page unique : remplace les `max-w-*` + `mx-auto px-*` écrits à la main. */
export default function Container({ children, variant = 'default', as: Comp = 'div', className, id }: ContainerProps) {
  return (
    <Comp id={id} className={cx(containerClasses[variant], className)}>
      {children}
    </Comp>
  );
}
