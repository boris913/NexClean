import type { Metadata } from 'next';
import { Camera, MessageCircle, CalendarCheck } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import ServicesSection from '@/components/sections/ServicesSection';
import PricingSection from '@/components/sections/PricingSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import { services } from '@/content/services-data';
import { FAQ, CITIES_LABEL, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Nettoyage maison et appartement à ${CITIES_LABEL} — Particuliers`,
  description: `Nettoyage de maisons, appartements et studios à ${CITIES_LABEL} : entretien, grand nettoyage, emménagement, vitres, espaces verts. Devis rapide avec photos sur WhatsApp.`,
  path: '/particuliers',
});

const QUICK_QUOTE_MSG =
  'Bonjour NexClean, je souhaite un devis pour mon logement. Type de logement : … / Quartier : … / Je vous envoie des photos.';

const steps = [
  { icon: Camera, title: 'Prenez quelques photos', text: 'Pièces, surfaces ou zones à traiter.' },
  { icon: MessageCircle, title: 'Envoyez-les sur WhatsApp', text: 'Avec votre quartier et la date souhaitée.' },
  { icon: CalendarCheck, title: 'Recevez votre devis', text: 'Puis choisissez votre créneau d\'intervention.' },
];

export default function ParticuliersPage() {
  return (
    <>
      <PageHero
        label="Particuliers"
        title="Un intérieur propre, sans effort"
        subtitle="Maisons, appartements, studios : entretien ponctuel, grand nettoyage, emménagement / déménagement, vitres et remise en état."
        breadcrumb={[{ name: 'Particuliers' }]}
      >
        <Button href={getWhatsAppLink(QUICK_QUOTE_MSG)} variant="whatsapp" size="lg">
          <WhatsAppIcon className="w-5 h-5" />
          Devis rapide avec photos
        </Button>
      </PageHero>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-ink-900 mb-8 text-center">Votre devis en 3 étapes</h2>
          <ol className="grid sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-100 p-6 text-center shadow-card">
                <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-bold text-slate-300 mb-1">ÉTAPE {i + 1}</p>
                <h3 className="font-semibold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ServicesSection
        items={services.filter((s) => s.audiences.includes('particulier'))}
        title="Nos prestations pour les particuliers"
        subtitle="Choisissez la prestation qui vous correspond."
        showAllLink={false}
      />
      <PricingSection />
      <FAQSection items={FAQ.slice(0, 5)} />
      <CTASection whatsappMessage={QUICK_QUOTE_MSG} />
    </>
  );
}
