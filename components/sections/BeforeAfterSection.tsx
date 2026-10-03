import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import RealisationCard from '@/components/ui/RealisationCard';
import { realisations, fieldPhotos } from '@/content/realisations-data';

export default function BeforeAfterSection() {
  return (
    <section id="realisations" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <SectionLabel className="mb-4">Avant / Après</SectionLabel>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-3">Nos équipes sur le terrain</h2>
            <p className="text-slate-500 max-w-lg">De vraies interventions NexClean, photographiées sur chantier.</p>
          </div>
          <Button href="/realisations" variant="secondary" size="md" icon={ArrowRight} iconPosition="right">
            Toutes nos réalisations
          </Button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
          {realisations.slice(0, 1).map((r) => (
            <RealisationCard key={r.id} item={r} />
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
            {fieldPhotos.map((p) => (
              <div key={p.src} className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 50vw, 20vw"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
