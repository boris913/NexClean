import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { lireCouverture } from '@/lib/geo/couverture';
import Button from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import PricingSection from '@/components/sections/PricingSection';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import ClientProcess from '@/components/sections/ClientProcess';
import CTASection from '@/components/sections/CTASection';
import { PAYMENT_TERMS } from '@/lib/constants';
import { lireParametre } from '@/lib/parametres';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Tarifs à ${villes} : propreté, abonnements et recrutement`,
    description: 'Prix indicatifs en FCFA : nettoyage de logements et bureaux, abonnements, et fonctionnement de la commission de placement. Devis après étude du besoin.',
    path: '/tarifs',
  });
}

const RECRUTEMENT_HREF = '/recrutement/demander-du-personnel';

/** Page pré-générée : base injoignable (build de l'image, incident), le montant est simplement omis. */
async function lireCommission(): Promise<number | null> {
  try {
    return await lireParametre('commission_par_personne');
  } catch {
    return null;
  }
}

export default async function TarifsPage() {
  const commission = await lireCommission();
  return (
    <>
      <PageHero
        label="Tarifs"
        title="Nos tarifs"
        subtitle="Des prix de départ indicatifs pour vous situer. Chaque devis est établi après étude de votre besoin."
        breadcrumb={[{ name: 'Tarifs' }]}
      />
      <PricingSection title="Propreté : logements et bureaux" showPayment={false} />
      <SubscriptionsSection title="Abonnements" />

      <Section id="tarif-recrutement" tone="dark" labelledBy="tarif-recrutement-titre" className="scroll-mt-20">
        <SectionHeader
          id="tarif-recrutement-titre"
          tone="dark"
          eyebrow="Recrutement"
          title="Recrutement & placement : une commission par personne"
          intro={PAYMENT_TERMS.placement}
          className="!mb-8"
        />
        {commission !== null && (
          <p className="mb-8 text-lead text-white">
            Commission en vigueur : <strong>{new Intl.NumberFormat('fr-FR').format(commission)} FCFA</strong> par personne, à titre indicatif. Le devis fixe le montant.
          </p>
        )}
        <Button href={RECRUTEMENT_HREF} icon={ArrowRight} iconPosition="right">
          Demander du personnel
        </Button>
      </Section>

      <ClientProcess eyebrow="Paiement" title="Comment se passe le paiement" />
      <CTASection
        title="Besoin d'un prix précis ?"
        subtitle="Décrivez votre besoin : nous revenons vers vous avec un devis."
        secondaryCta={{ href: RECRUTEMENT_HREF, label: 'Demander du personnel' }}
      />
    </>
  );
}
