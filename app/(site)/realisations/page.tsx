import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import PhotoTraitee from '@/components/ui/PhotoTraitee';
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
            <PhotoTraitee key={p.src} src={p.src} alt={p.alt} sizes="(max-width: 640px) 50vw, 33vw" className="aspect-[3/4]" />
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
