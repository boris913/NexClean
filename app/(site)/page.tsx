import HeroSection from '@/components/sections/HeroSection';
import PiliersSection from '@/components/sections/PiliersSection';
import ParcoursSection from '@/components/sections/ParcoursSection';
import FocusRecrutementSection from '@/components/sections/FocusRecrutementSection';
import FocusPropreteSection from '@/components/sections/FocusPropreteSection';
import SuiviSection from '@/components/sections/SuiviSection';
import EmploiSection from '@/components/sections/EmploiSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import JsonLd from '@/components/ui/JsonLd';
import { SITE_URL, OG_IMAGE, titreParDefaut, descriptionParDefaut, FAQ_SCHEMA } from '@/lib/seo';
import { lireCouverture } from '@/lib/geo/couverture';
import { CTA_FINAL, FAQ_EN_TETE, ZONES_EN_TETE } from '@/content/home-data';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle } = await lireCouverture();
  const DEFAULT_TITLE = titreParDefaut(libelle);
  const DEFAULT_DESCRIPTION = descriptionParDefaut(libelle);
  return {
    title: { absolute: DEFAULT_TITLE },
    description: DEFAULT_DESCRIPTION,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: SITE_URL,
      images: [
        {
          url: OG_IMAGE.url,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
          alt: OG_IMAGE.alt,
        },
      ],
    },
  };
}

export default async function Home() {
  const { libelle } = await lireCouverture();
  return (
    <>
      <HeroSection villes={libelle} />
      <PiliersSection />
      <ParcoursSection />
      <FocusRecrutementSection />
      <FocusPropreteSection />
      <SuiviSection />
      <EmploiSection />
      <TestimonialsSection />
      <CoverageSection eyebrow={ZONES_EN_TETE.surtitre} intro={ZONES_EN_TETE.sousTitre} />
      <FAQSection eyebrow={FAQ_EN_TETE.surtitre} title={FAQ_EN_TETE.titre} intro={FAQ_EN_TETE.sousTitre} />
      <CTASection
        title={CTA_FINAL.titre}
        subtitle={CTA_FINAL.texte}
        formHref={CTA_FINAL.cta.href}
        formLabel={CTA_FINAL.cta.label}
        whatsappMessage={CTA_FINAL.whatsapp.message}
        whatsappLabel={CTA_FINAL.whatsapp.label}
      />
      <JsonLd data={FAQ_SCHEMA} />
    </>
  );
}
