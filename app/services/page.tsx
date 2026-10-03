import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CoverageSection from '@/components/sections/CoverageSection';
import CTASection from '@/components/sections/CTASection';
import { CITIES_LABEL, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Nettoyage professionnel à ${CITIES_LABEL}`,
  description: `Tous les services NexClean à ${CITIES_LABEL} : nettoyage de maisons et bureaux, fin de chantier, vitres, désinfection, espaces verts et abonnements. Devis gratuit.`,
  path: '/services',
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        label="Nos services"
        title={`Nettoyage professionnel à ${CITIES_LABEL}`}
        subtitle="Particuliers et professionnels : nettoyage intérieur, fins de chantier, vitres, désinfection, entretien des espaces verts et contrats réguliers."
        breadcrumb={[{ name: 'Services' }]}
      >
        <Button href={getWhatsAppLink()} variant="whatsapp" size="lg">
          <WhatsAppIcon className="w-5 h-5" />
          Demander un devis
        </Button>
        <Button href="/tarifs" variant="secondary" size="lg">
          Voir les tarifs
        </Button>
      </PageHero>
      <ServicesSection showAllLink={false} title="Choisissez votre prestation" />
      <ProcessSection />
      <CoverageSection />
      <CTASection />
    </>
  );
}
