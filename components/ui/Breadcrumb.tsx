/**
 * Composant Breadcrumb — navigation fil d'Ariane.
 * Améliore l'accessibilité et ajoute du contexte pour Google.
 * À utiliser sur les futures sous-pages (ex: /blog, /services/nettoyage-maison).
 */

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-slate-400 mb-6">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href && index < items.length - 1 ? (
            <a
              href={item.href}
              className="hover:text-slate-700 transition-colors"
            >
              {item.name}
            </a>
          ) : (
            <span
              className={index === items.length - 1 ? 'text-slate-600 font-medium' : ''}
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
