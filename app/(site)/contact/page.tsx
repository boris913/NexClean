import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import PageHero from '@/components/ui/PageHero';
import ContactSection from '@/components/sections/ContactSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: 'Contact & demande de devis',
    description: `Contactez NexClean à ${villes} : devis gratuit sur WhatsApp, par téléphone ou via notre formulaire.`,
    path: '/contact',
  });
}

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
