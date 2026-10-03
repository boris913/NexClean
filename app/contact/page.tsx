import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import ContactSection from '@/components/sections/ContactSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import { CITIES_LABEL } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Contact & demande de devis',
  description: `Contactez NexClean à ${CITIES_LABEL} : devis gratuit sur WhatsApp, par téléphone ou via notre formulaire.`,
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        label="Contact / Devis"
        title="Demandez votre devis"
        subtitle="WhatsApp, téléphone ou formulaire : choisissez le moyen le plus simple pour vous."
        breadcrumb={[{ name: 'Contact' }]}
      />
      <ContactSection />
      <CoverageSection />
      <FAQSection />
    </>
  );
}
