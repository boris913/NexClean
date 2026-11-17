import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import Button from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import PricingSection from '@/components/sections/PricingSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { subscriptionForm } from '@/components/forms/quote-forms';
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
        <Button href="#demande-abonnement" size="lg">
          Demander une formule
        </Button>
        <Button href={getWhatsAppLink(WHATSAPP_MESSAGES.abonnements)} variant="outline" size="lg" whatsappIcon>
          Écrire sur WhatsApp
        </Button>
      </PageHero>
      <SubscriptionsSection title="Nos formules" subtitle="Passages planifiés à l'avance, pour chaque type de site." showDetailsLink={false} />
      <PricingSection />
      <Section id="demande-abonnement" tone="muted" container="narrow" labelledBy="demande-abonnement-titre" className="scroll-mt-24">
        <SectionHeader
          id="demande-abonnement-titre"
          align="center"
          title="Demander une formule d’abonnement"
          intro="Votre demande est enregistrée avec un numéro de suivi, puis un conseiller construit la formule avec vous sur WhatsApp."
          className="!mb-8"
        />
        <Card>
          <WhatsAppForm {...subscriptionForm} submitLabel="Envoyer ma demande d’abonnement" />
        </Card>
      </Section>
      <FAQSection items={subscriptionFaq} />
      <CTASection
        title="Construisons votre formule"
        subtitle="Dites-nous ce que vous souhaitez entretenir et à quelle fréquence."
        whatsappLabel="Demander une formule"
        whatsappMessage={WHATSAPP_MESSAGES.abonnements}
        formHref="#demande-abonnement"
        formLabel="Remplir le formulaire"
      />
    </>
  );
}
