import type { Metadata } from 'next';
import PageHero from '@/components/ui/PageHero';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import PricingSection from '@/components/sections/PricingSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import { CITIES_LABEL, PAYMENT_TERMS } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Abonnement nettoyage et entretien régulier à ${CITIES_LABEL}`,
  description: `Formules d'entretien régulier NexClean à ${CITIES_LABEL} pour particuliers, entreprises et espaces verts. Passages planifiés et tarif préférentiel.`,
  path: '/abonnements',
});

const subscriptionFaq = [
  {
    question: 'Combien de passages comprend un abonnement ?',
    answer: 'La fréquence est définie avec vous : par exemple 4 ou 8 passages par mois pour un logement, ou plusieurs passages par semaine pour des locaux professionnels.',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer: `${PAYMENT_TERMS.abonnement} Moyens acceptés : ${PAYMENT_TERMS.methods.join(', ')}.`,
  },
  {
    question: 'Puis-je modifier ou arrêter mon abonnement ?',
    answer: "Oui. Les conditions de modification, de suspension et de résiliation sont précisées dans votre contrat d'abonnement.",
  },
];

export default function AbonnementsPage() {
  return (
    <>
      <PageHero
        label="Abonnements"
        title="L'entretien régulier, planifié pour vous"
        subtitle="Des passages réguliers à tarif préférentiel, pour votre logement, vos locaux ou vos espaces verts."
        breadcrumb={[{ name: 'Services', href: '/services' }, { name: 'Abonnements' }]}
      />
      <SubscriptionsSection withHeader={false} />
      <PricingSection />
      <FAQSection items={subscriptionFaq} />
      <CTASection
        title="Construisons votre formule"
        subtitle="Dites-nous ce que vous souhaitez entretenir et à quelle fréquence."
        whatsappMessage="Bonjour NexClean, je souhaite des informations sur vos formules d'abonnement."
      />
    </>
  );
}
