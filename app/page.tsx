import HeroSection from '@/components/sections/HeroSection';
import ServicesSection from '@/components/sections/ServicesSection';
// import RealisationsSection from '@/components/sections/RealisationsSection';
import ProcessSection from '@/components/sections/ProcessSection';
import PricingSection from '@/components/sections/PricingSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import ContactSection from '@/components/sections/ContactSection';
import TeamInActionSection from '@/components/sections/TeamInActionSection';
import { SITE_URL, OG_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexClean — Service de Nettoyage Professionnel à Douala et à Yaoundé, Cameroun',
  description:
    'NexClean, la propreté nouvelle génération à Douala. Nettoyage maison, bureau, vitres, désinfection, après travaux. Intervention sous 24h. Devis gratuit.',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'NexClean — Service de Nettoyage Professionnel à Douala et à Yaoundé',
    description:
      'Nettoyage professionnel pour particuliers et entreprises à Douala. Rapide · Propre · Prix accessibles.',
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

export default function Home() {
  return (
    <>
      <HeroSection />
      <TeamInActionSection />
      <ServicesSection />
      {/* <RealisationsSection /> */}
      <ProcessSection />
      <PricingSection />
      <TestimonialsSection />
      <CoverageSection />
      <FAQSection />
      <ContactSection />
    </>
  );
}
