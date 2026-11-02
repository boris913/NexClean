import type { Metadata } from 'next';
import Image from 'next/image';
import PageHero from '@/components/ui/PageHero';
import CTASection from '@/components/sections/CTASection';
import RealisationsGallery from './RealisationsGallery';
import { realisations, fieldPhotos } from '@/content/realisations-data';
import { CITIES_LABEL } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Nos réalisations — avant / après à ${CITIES_LABEL}`,
  description: `Avant / après des interventions NexClean à ${CITIES_LABEL} : nettoyage intérieur, bureaux, fin de chantier, espaces verts, vitres.`,
  path: '/realisations',
});

export default function RealisationsPage() {
  return (
    <>
      <PageHero
        label="Nos réalisations"
        title="Avant / Après : nos interventions"
        subtitle="Chaque réalisation présente le problème rencontré, notre intervention et le résultat."
        breadcrumb={[{ name: 'Réalisations' }]}
      />

      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <RealisationsGallery items={realisations} />
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-8">Nos équipes en intervention</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fieldPhotos.map((p) => (
              <div key={p.src} className="relative aspect-[3/4] overflow-hidden rounded-2xl">
                <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection whatsappMessage="Bonjour NexClean, j'ai vu vos réalisations et je souhaite un devis." />
    </>
  );
}
