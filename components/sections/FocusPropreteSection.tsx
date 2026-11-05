import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import RealisationCard from '@/components/ui/RealisationCard';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { subscriptionPlans } from '@/components/sections/SubscriptionsSection';
import { FOCUS_PROPRETE } from '@/content/home-data';
import { PROMO } from '@/lib/constants';
import { realisations } from '@/content/realisations-data';

/** Focus propreté, condensé : une réalisation et les formules d'abonnement. */
export default function FocusPropreteSection() {
  const realisation = realisations[0];
  return (
    <Section id="focus-proprete" labelledBy="focus-proprete-titre" className="scroll-mt-20">
      <SectionHeader
        id="focus-proprete-titre"
        pillar="proprete"
        eyebrow={FOCUS_PROPRETE.surtitre}
        title={FOCUS_PROPRETE.titre}
        intro={FOCUS_PROPRETE.sousTitre}
      />
      {PROMO.active && (
        <p className="mb-8 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-pillar-proprete-border bg-pillar-proprete-soft px-4 py-2 text-small text-ink-700">
          <span className="rounded-full bg-cta px-2.5 py-0.5 text-xs font-bold text-ink-900">{PROMO.discount}</span>
          {PROMO.title} {PROMO.description}. {PROMO.condition}.
        </p>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-2">
        {realisation && <RealisationCard item={realisation} />}
        <div>
          <h3 className="mb-4 font-display text-h3 text-ink-900">{FOCUS_PROPRETE.abonnementsTitre}</h3>
          <ul className="space-y-3">
            {subscriptionPlans.map((plan) => (
              <Card as="li" key={plan.name} padding="sm" className="!flex-row items-center gap-4">
                <IconBadge icon={plan.icon} tone="proprete" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{plan.name}</p>
                  <p className="text-small text-ink-600">{plan.price}</p>
                </div>
              </Card>
            ))}
          </ul>
          <p className="mt-3 text-small text-muted">{FOCUS_PROPRETE.abonnementsNote}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href={FOCUS_PROPRETE.cta.href} icon={ArrowRight} iconPosition="right">
              {FOCUS_PROPRETE.cta.label}
            </Button>
            <Button href={FOCUS_PROPRETE.lienSecondaire.href} variant="outline">
              {FOCUS_PROPRETE.lienSecondaire.label}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
