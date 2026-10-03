import { services } from '@/content/services-data';

/** Bandeau défilant des services (sous le hero). */
export default function ServicesMarquee() {
  const items = [...services.map((s) => s.name), 'Produits NexClean'];
  const row = [...items, ...items];

  return (
    <div className="relative bg-brand-400 py-4 overflow-hidden" aria-label="Nos services">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row.map((name, i) => (
          <span key={i} className="flex items-center gap-6 px-6 font-display text-lg sm:text-xl font-semibold text-ink-900 whitespace-nowrap" aria-hidden={i >= items.length}>
            {name}
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-ink-900/70" fill="currentColor" aria-hidden="true">
              <path d="M12 0l3.1 8.9L24 12l-8.9 3.1L12 24l-3.1-8.9L0 12l8.9-3.1z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
