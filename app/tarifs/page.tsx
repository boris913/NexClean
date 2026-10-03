import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import PricingSection from '@/components/sections/PricingSection';
import ClientProcess from '@/components/sections/ClientProcess';
import CTASection from '@/components/sections/CTASection';
import { CITIES_LABEL } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Tarifs nettoyage à ${CITIES_LABEL}`,
  description: `Tarifs indicatifs NexClean à ${CITIES_LABEL} : nettoyage de logements et de bureaux, ponctuel ou en abonnement. Devis gratuit selon surface et état des lieux.`,
  path: '/tarifs',
});

export default function TarifsPage() {
  return (
    <>
      <PageHero
        label="Tarifs"
        title="Nos tarifs"
        subtitle="Des prix de départ indicatifs pour vous situer. Chaque devis est établi après analyse de votre besoin."
        breadcrumb={[{ name: 'Tarifs' }]}
      />
      <PricingSection />
      <ClientProcess />
      <CTASection />
    </>
  );
}
