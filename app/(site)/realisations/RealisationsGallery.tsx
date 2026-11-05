'use client';

import { useState } from 'react';
import RealisationCard from '@/components/ui/RealisationCard';
import { REALISATION_FILTERS, type Realisation, type RealisationFilter } from '@/content/realisations-data';

export default function RealisationsGallery({ items }: { items: Realisation[] }) {
  const [filter, setFilter] = useState<RealisationFilter | 'Tout'>('Tout');
  const visible = filter === 'Tout' ? items : items.filter((r) => r.filter === filter);

  return (
    <>
      <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Filtrer les réalisations">
        {(['Tout', ...REALISATION_FILTERS] as const).map((f) => {
          const count = f === 'Tout' ? items.length : items.filter((r) => r.filter === f).length;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-tap whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
              }`}
            >
              {f} ({count})
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {visible.map((r) => (
            <RealisationCard key={r.id} item={r} />
          ))}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-ink-200 py-12 text-center text-muted">
          Les réalisations de cette catégorie seront bientôt publiées.
        </p>
      )}
    </>
  );
}
