import Image from 'next/image';
import { MapPin, Clock, Quote } from 'lucide-react';
import type { Realisation } from '@/content/realisations-data';

/** Mini preuve commerciale : AVANT → problème → intervention → APRÈS. */
export default function RealisationCard({ item }: { item: Realisation }) {
  const photos = [
    item.before && { ...item.before, label: 'Avant', tone: 'bg-slate-900/80' },
    item.during && { ...item.during, label: 'Pendant', tone: 'bg-accent' },
    item.after && { ...item.after, label: 'Après', tone: 'bg-brand-600' },
  ].filter(Boolean) as { src: string; alt: string; label: string; tone: string }[];

  return (
    <article className="overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-card">
      <div className={`grid ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-0.5 bg-slate-100`}>
        {photos.map((p) => (
          <div key={p.src} className="relative aspect-[3/4]">
            <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
            <span className={`absolute top-3 left-3 text-xs font-semibold text-white px-2.5 py-1 rounded-full ${p.tone}`}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-primary bg-primary-light px-2.5 py-1 rounded-full">{item.serviceType}</span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5" /> {item.location}
          </span>
          {item.duration && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" /> {item.duration}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">{item.title}</h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-slate-700">Problème</dt>
            <dd className="text-slate-500">{item.problem}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Intervention NexClean</dt>
            <dd className="text-slate-500">{item.intervention}</dd>
          </div>
        </dl>
        {item.review && (
          <blockquote className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 italic flex gap-2">
            <Quote className="w-4 h-4 text-primary flex-shrink-0" />
            <span>
              {item.review.text} <span className="not-italic text-slate-400">— {item.review.author}</span>
            </span>
          </blockquote>
        )}
      </div>
    </article>
  );
}
