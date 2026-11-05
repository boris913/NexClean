import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import { ArrowRight, Building2, UtensilsCrossed, Hotel, Store, Landmark, GraduationCap, PartyPopper, HardHat, Home, Users } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import ServicesSection from '@/components/sections/ServicesSection';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import CTASection from '@/components/sections/CTASection';
import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { proQuoteForm } from '@/components/forms/quote-forms';
import { services } from '@/content/services-data';
import { WHATSAPP_MESSAGES } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Entreprises à ${villes} : propreté des locaux, recrutement, espaces verts`,
    description: `Entretien de bureaux et commerces, recrutement et placement de personnel, espaces verts pour les entreprises de ${villes}. Visite technique, devis, suivi en ligne.`,
    path: '/professionnels',
  });
}

const RECRUTEMENT_HREF = '/recrutement/demander-du-personnel';

const sectors = [
  { icon: Building2, name: 'Bureaux' },
  { icon: UtensilsCrossed, name: 'Restaurants' },
  { icon: Hotel, name: 'Hôtels' },
  { icon: Home, name: 'Résidences' },
  { icon: Store, name: 'Commerces' },
  { icon: Landmark, name: 'Administrations' },
  { icon: GraduationCap, name: 'Établissements scolaires' },
  { icon: PartyPopper, name: 'Événements' },
  { icon: HardHat, name: 'Chantiers' },
];

export default function ProfessionnelsPage() {
  return (
    <>
      <PageHero
        label="Professionnels"
        title="Vos locaux entretenus, vos postes pourvus"
        subtitle="Nous étudions votre site, vos horaires et vos besoins en personnel avant de proposer un devis et un planning adaptés."
        breadcrumb={[{ name: 'Professionnels' }]}
      >
        <Button href="#devis-pro" size="lg">
          Demander une visite technique
        </Button>
        <Button href={RECRUTEMENT_HREF} variant="outline" size="lg">
          Demander du personnel
        </Button>
      </PageHero>

      <Section labelledBy="structures-titre">
        <SectionHeader id="structures-titre" align="center" title="Les structures que nous accompagnons" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sectors.map((s) => (
            <li key={s.name} className="flex flex-col items-start gap-2 rounded-2xl border border-ink-100 bg-ink-50 p-3 sm:flex-row sm:items-center">
              <IconBadge icon={s.icon} size="sm" />
              <span className="text-small font-medium text-ink-700">{s.name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="besoin-de-personnel" spacing="sm" labelledBy="besoin-de-personnel-titre" className="scroll-mt-20 !pt-0">
        <Card variant="pillar" pillar="recrutement" padding="lg" className="gap-6 md:flex-row md:items-center">
          <IconBadge icon={Users} tone="recrutement" size="lg" />
          <div className="flex-1">
            <h2 id="besoin-de-personnel-titre" className="font-display text-h3 text-ink-900">
              Besoin de personnel pour votre structure ?
            </h2>
            <p className="mt-2 text-body text-ink-600">
              Serveurs, agents d&apos;entretien, gardiens, caissiers… Une commission par personne, facturée sur les seuls placements confirmés.
            </p>
          </div>
          <Button href={RECRUTEMENT_HREF} size="lg" icon={ArrowRight} iconPosition="right">
            Demander du personnel
          </Button>
        </Card>
      </Section>

      <ServicesSection
        items={services.filter((s) => s.audiences.includes('professionnel'))}
        title="Propreté de vos locaux"
        subtitle="Ponctuelle ou dans le cadre d'un contrat d'entretien."
        showAllLink={false}
      />
      <SubscriptionsSection title="Contrats d'entretien" />

      <Section id="devis-pro" tone="muted" container="narrow" labelledBy="devis-pro-titre" className="scroll-mt-24">
        <SectionHeader
          id="devis-pro-titre"
          align="center"
          title="Visite technique / devis professionnel"
          intro="Décrivez votre site : nous revenons vers vous pour organiser la visite."
          className="!mb-8"
        />
        <Card>
          <WhatsAppForm {...proQuoteForm} submitLabel="Envoyer ma demande" />
        </Card>
      </Section>

      <CTASection
        title="Un appel d'offres ou plusieurs sites ?"
        subtitle="Nous étudions les besoins multi-sites et les cahiers des charges."
        whatsappMessage={WHATSAPP_MESSAGES.professionnels}
        formHref="#devis-pro"
        formLabel="Demander une visite technique"
        secondaryCta={{ href: RECRUTEMENT_HREF, label: 'Demander du personnel' }}
      />
    </>
  );
}
