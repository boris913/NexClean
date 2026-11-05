import Image from 'next/image';
import { MapPin, Clock, Quote } from 'lucide-react';
import Card from '@/components/ui/Card';
import { cx } from '@/components/ui/cx';
import type { Realisation } from '@/content/realisations-data';
import { BRAND } from '@/lib/constants';

/** Mini preuve commerciale : AVANT → problème → intervention → APRÈS. */
export default function RealisationCard({ item }: { item: Realisation }) {
  const photos = [
    item.before && { ...item.before, label: 'Avant', tone: 'bg-ink-900/80' },
    item.during && { ...item.during, label: 'Pendant', tone: 'bg-accent' },
    item.after && { ...item.after, label: 'Après', tone: 'bg-primary' },
  ].filter(Boolean) as { src: string; alt: string; label: string; tone: string }[];

  return (
    <Card as="article" className="overflow-hidden !p-0">
      <div className={cx('grid gap-0.5 bg-ink-100', photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {photos.map((p) => (
          <div key={p.src} className="relative aspect-[3/4]">
            <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
            <span className={cx('absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white', p.tone)}>
              {p.label}
            </span>
          </div>
        ))}
      </div>

      <div className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-pillar-proprete-soft px-2.5 py-1 text-xs font-semibold text-pillar-proprete">
            {item.serviceType}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {item.location}
          </span>
          {item.duration && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {item.duration}
            </span>
          )}
        </div>
        <h3 className="mb-3 font-display text-h3 text-ink-900">{item.title}</h3>
        <dl className="space-y-2 text-small">
          <div>
            <dt className="font-medium text-ink-700">Problème</dt>
            <dd className="text-ink-600">{item.problem}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink-700">Intervention {BRAND.name}</dt>
            <dd className="text-ink-600">{item.intervention}</dd>
          </div>
        </dl>
        {item.review && (
          <blockquote className="mt-4 flex gap-2 border-t border-ink-100 pt-4 text-small italic text-ink-600">
            <Quote className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            <span>
              {item.review.text} <span className="not-italic text-muted">— {item.review.author}</span>
            </span>
          </blockquote>
        )}
      </div>
    </Card>
  );
}
