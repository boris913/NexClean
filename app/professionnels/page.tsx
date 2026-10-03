import type { Metadata } from 'next';
import { Building2, UtensilsCrossed, Hotel, Store, Landmark, GraduationCap, PartyPopper, HardHat, Home } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import ServicesSection from '@/components/sections/ServicesSection';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import CTASection from '@/components/sections/CTASection';
import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { proQuoteForm } from '@/components/forms/quote-forms';
import { services } from '@/content/services-data';
import { CITIES_LABEL } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Nettoyage professionnel pour entreprises à ${CITIES_LABEL}`,
  description: `Nettoyage de bureaux, commerces, hôtels, restaurants, résidences et chantiers à ${CITIES_LABEL}. Visite technique et devis professionnel, contrats d'entretien réguliers.`,
  path: '/professionnels',
});

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
        title="L'entretien de vos locaux, confié à une équipe organisée"
        subtitle="Nous étudions votre site, vos horaires et vos contraintes avant de proposer un devis et un planning adaptés."
        breadcrumb={[{ name: 'Professionnels' }]}
      >
        <Button href="#devis-pro" variant="primary" size="lg">
          Demander une visite technique / un devis
        </Button>
      </PageHero>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl text-slate-900 mb-8 text-center">Les structures que nous accompagnons</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {sectors.map((s) => (
              <li key={s.name} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <s.icon className="w-5 h-5 text-primary flex-shrink-0" strokeWidth={1.75} />
                <span className="text-sm font-medium text-slate-700">{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ServicesSection
        items={services.filter((s) => s.audiences.includes('professionnel'))}
        title="Nos prestations pour les professionnels"
        subtitle="Ponctuelles ou dans le cadre d'un contrat d'entretien."
        showAllLink={false}
      />
      <SubscriptionsSection />

      <section id="devis-pro" className="py-16 sm:py-20 bg-slate-50 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl text-slate-900 mb-2">Visite technique / devis professionnel</h2>
            <p className="text-slate-500">Décrivez votre site : nous revenons vers vous pour organiser la visite.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
            <WhatsAppForm {...proQuoteForm} submitLabel="Envoyer ma demande" />
          </div>
        </div>
      </section>

      <CTASection
        title="Un appel d'offres ou plusieurs sites ?"
        subtitle="Nous étudions les besoins multi-sites et les cahiers des charges."
        whatsappMessage="Bonjour NexClean, je souhaite une visite technique / un devis professionnel."
        formHref="#devis-pro"
      />
    </>
  );
}
