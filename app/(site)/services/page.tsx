import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import { PILLARS } from '@/components/ui/pillars';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CoverageSection from '@/components/sections/CoverageSection';
import CTASection from '@/components/sections/CTASection';
import { WHATSAPP_MESSAGE_SERVICE, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Propreté et hygiène à ${villes} : nettoyage, désinfection, abonnements`,
    description: `Nettoyage de maisons et bureaux, fin de chantier, vitres, désinfection et abonnements d'entretien à ${villes}. Devis sur WhatsApp ou en ligne.`,
    path: '/services',
  });
}

export default async function ServicesPage() {
  const { libelle: villes } = await lireCouverture();
  return (
    <>
      <PageHero
        label={PILLARS.proprete.label}
        pillar="proprete"
        decor
        title={`Propreté et hygiène à ${villes}`}
        subtitle="Maisons, bureaux, commerces et fins de chantier : nous venons avec le matériel et les produits adaptés."
        breadcrumb={[{ name: 'Propreté' }]}
      >
        <Button href="/contact#contact" size="lg">
          Demander un devis
        </Button>
        <Button href={getWhatsAppLink(WHATSAPP_MESSAGE_SERVICE)} variant="whatsapp" size="lg" whatsappIcon>
          WhatsApp
        </Button>
        <Button href="/tarifs" variant="outline" size="lg">
          Voir les tarifs
        </Button>
      </PageHero>
      <ServicesSection showAllLink={false} title="Choisissez votre prestation" />
      <ProcessSection />
      <CoverageSection />
      <CTASection
        title="Un espace à remettre au propre ?"
        subtitle="Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis."
        formHref="/contact#contact"
        formLabel="Demander un devis"
        whatsappMessage={WHATSAPP_MESSAGE_SERVICE}
      />
    </>
  );
}
