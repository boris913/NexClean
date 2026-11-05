import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import Button from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import PricingSection from '@/components/sections/PricingSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import { PAYMENT_TERMS, WHATSAPP_MESSAGES, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Abonnements d'entretien à ${villes} : logement, locaux, espaces verts`,
    description: `Formules d'entretien régulier à ${villes} pour particuliers et entreprises : passages planifiés, tarif préférentiel, même équipe autant que possible.`,
    path: '/abonnements',
  });
}

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
        illustration="proprete"
        label="Abonnements"
        pillar="proprete"
        title="L'entretien régulier, planifié pour vous"
        subtitle="Des passages réguliers à tarif préférentiel, pour votre logement, vos locaux ou vos espaces verts."
        breadcrumb={[{ name: 'Abonnements' }]}
      >
        <Button href={getWhatsAppLink(WHATSAPP_MESSAGES.abonnements)} size="lg" whatsappIcon>
          Demander une formule
        </Button>
        <Button href="/contact" variant="outline" size="lg">
          Faire une demande
        </Button>
      </PageHero>
      <SubscriptionsSection title="Nos formules" subtitle="Passages planifiés à l'avance, pour chaque type de site." showDetailsLink={false} />
      <PricingSection />
      <FAQSection items={subscriptionFaq} />
      <CTASection
        title="Construisons votre formule"
        subtitle="Dites-nous ce que vous souhaitez entretenir et à quelle fréquence."
        whatsappLabel="Demander une formule"
        whatsappMessage={WHATSAPP_MESSAGES.abonnements}
      />
    </>
  );
}
