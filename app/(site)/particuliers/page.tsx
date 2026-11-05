import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import { ArrowRight, Camera, MessageCircle, CalendarCheck, Users } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import ServicesSection from '@/components/sections/ServicesSection';
import PricingSection from '@/components/sections/PricingSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import { services } from '@/content/services-data';
import { FAQ_PROPRETE, FAQ_RECRUTEMENT, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Particuliers à ${villes} : ménage, jardin, personnel de maison`,
    description: `Nettoyage de votre logement, entretien de votre jardin, recrutement d'une nounou, d'un gardien ou d'une aide ménagère à ${villes}. Devis et suivi en ligne.`,
    path: '/particuliers',
  });
}

const QUICK_QUOTE_MSG =
  'Bonjour NexClean, je souhaite un devis pour mon logement. Type de logement : … / Quartier : … / Je vous envoie des photos.';

const RECRUTEMENT_HREF = '/recrutement/demander-du-personnel';

const steps = [
  { icon: Camera, title: 'Prenez quelques photos', text: 'Pièces, surfaces ou zones à traiter.' },
  { icon: MessageCircle, title: 'Envoyez-les sur WhatsApp', text: 'Avec votre quartier et la date souhaitée.' },
  { icon: CalendarCheck, title: 'Recevez votre devis', text: "Puis choisissez votre créneau d'intervention." },
];

const faq = FAQ_RECRUTEMENT[1] ? [...FAQ_PROPRETE, FAQ_RECRUTEMENT[1]] : FAQ_PROPRETE;

export default function ParticuliersPage() {
  return (
    <>
      <PageHero
        illustration="maison"
        label="Particuliers"
        title="Votre maison entretenue, votre personnel bien choisi"
        subtitle="Ménage, grand nettoyage, vitres, jardin, et recrutement de personnel de maison : une seule demande, un seul suivi."
        breadcrumb={[{ name: 'Particuliers' }]}
      >
        <Button href={getWhatsAppLink(QUICK_QUOTE_MSG)} size="lg" whatsappIcon>
          Demander un devis
        </Button>
        <Button href={RECRUTEMENT_HREF} variant="outline" size="lg">
          Demander du personnel
        </Button>
      </PageHero>

      <Section labelledBy="etapes-titre">
        <SectionHeader id="etapes-titre" align="center" title="Votre devis en 3 étapes" />
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Card as="li" key={s.title} className="items-center text-center">
              <IconBadge icon={s.icon} tone="proprete" shape="circle" className="mb-4" />
              <p className="mb-1 text-xs font-bold text-muted">ÉTAPE {i + 1}</p>
              <h3 className="mb-1 font-display text-h3 text-ink-900">{s.title}</h3>
              <p className="text-small text-ink-600">{s.text}</p>
            </Card>
          ))}
        </ol>
      </Section>

      <ServicesSection
        items={services.filter((s) => s.audiences.includes('particulier'))}
        eyebrow="Propreté & espaces verts"
        title="Nos prestations pour votre logement"
        subtitle="Choisissez la prestation qui vous correspond."
        showAllLink={false}
      />

      <Section id="personnel-de-maison" spacing="sm" labelledBy="personnel-de-maison-titre" className="scroll-mt-20">
        <Card variant="pillar" pillar="recrutement" padding="lg" className="gap-6 md:flex-row md:items-center">
          <IconBadge icon={Users} tone="recrutement" size="lg" />
          <div className="flex-1">
            <h2 id="personnel-de-maison-titre" className="font-display text-h3 text-ink-900">
              Besoin d&apos;une nounou, d&apos;un gardien ou d&apos;une aide ménagère ?
            </h2>
            <p className="mt-2 text-body text-ink-600">
              Décrivez le poste, le nombre de personnes et le salaire proposé : vous obtenez une estimation immédiate.
            </p>
          </div>
          <Button href={RECRUTEMENT_HREF} icon={ArrowRight} iconPosition="right">
            Demander du personnel
          </Button>
        </Card>
      </Section>

      <PricingSection />
      <FAQSection items={faq} />
      <CTASection
        title="Un logement à entretenir ?"
        subtitle="Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis."
        formHref="/contact#contact"
        formLabel="Demander un devis"
        secondaryCta={{ href: RECRUTEMENT_HREF, label: 'Demander du personnel' }}
        whatsappMessage={QUICK_QUOTE_MSG}
      />
    </>
  );
}
