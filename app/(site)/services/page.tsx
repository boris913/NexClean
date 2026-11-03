import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CoverageSection from '@/components/sections/CoverageSection';
import CTASection from '@/components/sections/CTASection';
import { getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Nettoyage professionnel à ${villes}`,
    description: `Tous les services NexClean à ${villes} : nettoyage de maisons et bureaux, fin de chantier, vitres, désinfection, espaces verts et abonnements. Devis gratuit.`,
    path: '/services',
  });
}

export default async function ServicesPage() {
  const { libelle: villes } = await lireCouverture();
  return (
    <>
      <PageHero
        label="Nos services"
        title={`Nettoyage professionnel à ${villes}`}
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
