import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import Image from 'next/image';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import CTASection from '@/components/sections/CTASection';
import RealisationsGallery from './RealisationsGallery';
import { realisations, fieldPhotos } from '@/content/realisations-data';
import { WHATSAPP_MESSAGES } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Nos réalisations — avant / après à ${villes}`,
    description: `Avant / après des interventions NEXCLEAN à ${villes} : problème constaté, intervention réalisée, résultat.`,
    path: '/realisations',
  });
}

// [À COMPLÉTER : réalisations supplémentaires (bureaux, fin de chantier, espaces verts) ; une seule réalisation publiée à ce jour]
export default function RealisationsPage() {
  return (
    <>
      <PageHero
        label="Nos réalisations"
        title="Avant / Après : nos interventions"
        subtitle="Chaque réalisation présente le problème rencontré, notre intervention et le résultat."
        breadcrumb={[{ name: 'Réalisations' }]}
      />

      <Section spacing="sm">
        <RealisationsGallery items={realisations} />
      </Section>

      <Section tone="muted" spacing="sm" labelledBy="equipes-titre">
        <SectionHeader id="equipes-titre" title="Nos équipes en intervention" className="!mb-8" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fieldPhotos.map((p) => (
            <div key={p.src} className="relative aspect-[3/4] overflow-hidden rounded-2xl">
              <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
            </div>
          ))}
        </div>
      </Section>

      <CTASection
        title="Un espace à remettre au propre ?"
        formLabel="Demander un devis"
        whatsappMessage={WHATSAPP_MESSAGES.realisations}
      />
    </>
  );
}
