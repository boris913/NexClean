'use client';

import { useState } from 'react';
import RealisationCard from '@/components/ui/RealisationCard';
import { REALISATION_FILTERS, type Realisation, type RealisationFilter } from '@/content/realisations-data';

export default function RealisationsGallery({ items }: { items: Realisation[] }) {
  const [filter, setFilter] = useState<RealisationFilter | 'Tout'>('Tout');
  const visible = filter === 'Tout' ? items : items.filter((r) => r.filter === filter);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" role="tablist" aria-label="Filtrer les réalisations">
        {(['Tout', ...REALISATION_FILTERS] as const).map((f) => {
          const count = f === 'Tout' ? items.length : items.filter((r) => r.filter === f).length;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                filter === f
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-5">
          {visible.map((r) => (
            <RealisationCard key={r.id} item={r} />
          ))}
        </div>
      ) : (
        <p className="text-center text-slate-500 py-12 rounded-2xl border border-dashed border-slate-200">
          Les réalisations de cette catégorie seront bientôt publiées.
        </p>
      )}
    </>
  );
}
