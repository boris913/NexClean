import { CalendarCheck, Home, Building2, Trees, Check, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { PILLARS } from '@/components/ui/pillars';
import { getWhatsAppLink, PAYMENT_TERMS } from '@/lib/constants';

export const subscriptionPlans = [
  {
    icon: Home,
    pillar: 'proprete',
    name: 'Particuliers',
    price: 'À partir de 30 000 FCFA/mois',
    points: ['4 ou 8 passages par mois', 'Même équipe autant que possible', 'Tarif préférentiel'],
    message: "Bonjour NexClean, je souhaite un abonnement d'entretien pour mon logement.",
  },
  {
    icon: Building2,
    pillar: 'proprete',
    name: 'Professionnels',
    price: 'À partir de 50 000 FCFA/mois',
    points: ['Fréquence adaptée à votre activité', 'Horaires hors affluence possibles', 'Contrat sur mesure multi-sites'],
    message: "Bonjour NexClean, je souhaite un contrat d'entretien régulier pour mes locaux.",
  },
  {
    icon: Trees,
    pillar: 'espaces-verts',
    name: 'Espaces verts',
    price: 'Sur devis après état des lieux',
    points: ['Tonte et désherbage réguliers', 'Taille de haies planifiée', 'Ramassage des déchets verts'],
    message: "Bonjour NexClean, je souhaite un contrat d'entretien régulier de mon espace vert.",
  },
] as const;

interface SubscriptionsSectionProps {
  /** Sans en-tête, le titre reste à la charge de la page. */
  withHeader?: boolean;
  title?: string;
  subtitle?: string;
  /** Lien vers `/abonnements` : à retirer sur cette page. */
  showDetailsLink?: boolean;
}

export default function SubscriptionsSection({
  withHeader = true,
  title = "L'entretien régulier, sans y penser",
  subtitle = "Des passages planifiés à l'avance, à un tarif préférentiel.",
  showDetailsLink = true,
}: SubscriptionsSectionProps) {
  return (
    <Section id="abonnements" labelledBy={withHeader ? 'abonnements-titre' : undefined} className="scroll-mt-20">
      {withHeader && (
        <SectionHeader
          id="abonnements-titre"
          pillar="proprete"
          eyebrow="Abonnements"
          title={title}
          intro={subtitle}
          actions={
            showDetailsLink && (
              <Button href="/abonnements" variant="outline" icon={ArrowRight} iconPosition="right">
                Détail des formules
              </Button>
            )
          }
        />
      )}

      <Stagger className="grid items-stretch gap-6 md:grid-cols-3">
        {subscriptionPlans.map((plan, i) => {
          const featured = i === 1;
          return (
            <StaggerItem key={plan.name}>
              <div
                className={
                  featured
                    ? 'surface-dark relative flex h-full flex-col rounded-card bg-forest p-6 text-white shadow-card-hover sm:p-7'
                    : cardClasses({ className: 'h-full' })
                }
              >
                {featured && (
                  <span className="absolute -top-3 left-7 rounded-full bg-cta px-3 py-1 text-xs font-bold text-ink-900">Entreprises</span>
                )}
                <IconBadge icon={plan.icon} tone={featured ? 'cta' : plan.pillar} className="mb-5 self-start" />
                <h3 className={cx('font-display text-h3', featured ? 'text-white' : 'text-ink-900')}>{plan.name}</h3>
                <p className={cx('mb-5 font-semibold', featured ? 'text-brand-300' : PILLARS[plan.pillar].text)}>{plan.price}</p>
                <ul className="mb-6 space-y-2">
                  {plan.points.map((pt) => (
                    <li key={pt} className={cx('flex items-start gap-2 text-small', featured ? 'text-brand-100' : 'text-ink-600')}>
                      <Check className={cx('mt-0.5 h-4 w-4 flex-shrink-0', featured ? 'text-brand-300' : 'text-success')} aria-hidden="true" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Button href={getWhatsAppLink(plan.message)} variant={featured ? 'primary' : 'outline'} fullWidth className="mt-auto">
                  Demander cette formule
                </Button>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <div className="mt-8 flex flex-col items-start gap-3 rounded-card border border-brand-100 bg-brand-50 p-5 sm:flex-row sm:items-center">
        <CalendarCheck className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 text-small text-ink-600">
          Besoin d&apos;une formule personnalisée ? Nous construisons le planning avec vous. Tarifs indicatifs : le prix final dépend de la surface, de l&apos;état et de la fréquence. {PAYMENT_TERMS.abonnement}
        </p>
        <Button
          href={getWhatsAppLink("Bonjour NexClean, je souhaite une formule d'abonnement personnalisée.")}
          variant="ghost"
          size="sm"
          icon={ArrowRight}
          iconPosition="right"
        >
          Formule sur mesure
        </Button>
      </div>
    </Section>
  );
}
