/**
 * Composant Breadcrumb — navigation fil d'Ariane.
 * Améliore l'accessibilité et ajoute du contexte pour Google.
 */
import { cx } from '@/components/ui/cx';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** `dark` sur fond vert profond. */
  tone?: 'light' | 'dark';
  className?: string;
}

export default function Breadcrumb({ items, tone = 'light', className }: BreadcrumbProps) {
  const dark = tone === 'dark';
  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cx('flex flex-wrap items-center gap-1.5 text-xs mb-6', dark ? 'text-brand-100' : 'text-muted', className)}
    >
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href && index < items.length - 1 ? (
            <a
              href={item.href}
              className={cx('underline-offset-2 hover:underline transition-colors', dark ? 'hover:text-white' : 'hover:text-ink-800')}
            >
              {item.name}
            </a>
          ) : (
            <span
              className={index === items.length - 1 ? cx('font-medium', dark ? 'text-white' : 'text-ink-700') : ''}
              aria-current={index === items.length - 1 ? 'page' : undefined}
            >
              {item.name}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
