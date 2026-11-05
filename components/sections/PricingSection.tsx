'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Check, Banknote, Smartphone, Building2, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { pricingParticuliers, pricingProfessionnels, paymentMethods } from '@/content/pricing-data';
import { getWhatsAppLink, PAYMENT_TERMS } from '@/lib/constants';

const paymentIcons: Record<string, typeof Banknote> = {
  Banknote,
  Smartphone,
  Building2,
};

const ONGLETS = [
  { cle: 'particuliers', label: 'Particuliers' },
  { cle: 'professionnels', label: 'Professionnels' },
] as const;

type Onglet = (typeof ONGLETS)[number]['cle'];

interface PricingSectionProps {
  eyebrow?: string;
  title?: string;
  intro?: string;
  ctaLabel?: string;
  popularLabel?: string;
  /** Moyens et conditions de paiement sous la grille ; à retirer si la page les présente déjà. */
  showPayment?: boolean;
}

export default function PricingSection({
  eyebrow = 'Tarifs',
  title = 'Tarifs indicatifs',
  intro = "Prix de départ donnés à titre indicatif : le devis final dépend de la surface, de l'état des lieux, de l'accès, de la fréquence et des moyens nécessaires.",
  ctaLabel = 'Demander un devis',
  popularLabel = 'Recommandé',
  showPayment = true,
}: PricingSectionProps) {
  const [tab, setTab] = useState<Onglet>('particuliers');
  const id = useId();
  const options = tab === 'particuliers' ? pricingParticuliers : pricingProfessionnels;

  function auClavier(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const suivant: Onglet = tab === 'particuliers' ? 'professionnels' : 'particuliers';
    setTab(suivant);
    document.getElementById(`${id}-onglet-${suivant}`)?.focus();
  }

  return (
    <Section id="tarifs" tone="muted" labelledBy={`${id}-titre`} className="scroll-mt-20">
      <SectionHeader id={`${id}-titre`} eyebrow={eyebrow} title={title} intro={intro} className="!mb-8" />

      <div className="mb-10 flex justify-center">
        <div role="tablist" aria-label="Type de client" onKeyDown={auClavier} className="inline-flex gap-1 rounded-full bg-ink-100 p-1">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              id={`${id}-onglet-${o.cle}`}
              type="button"
              role="tab"
              aria-selected={tab === o.cle}
              aria-controls={`${id}-panneau`}
              tabIndex={tab === o.cle ? 0 : -1}
              onClick={() => setTab(o.cle)}
              className={cx(
                'min-h-tap rounded-full px-5 text-sm font-medium transition-colors duration-200',
                tab === o.cle ? 'bg-white text-ink-900 shadow-card' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`${id}-panneau`}
        role="tabpanel"
        aria-labelledby={`${id}-onglet-${tab}`}
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {options.map((option) => (
          <Card key={option.id} padding="sm" className={cx(option.popular && 'ring-2 ring-cta')}>
            {option.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cta px-3 py-1 text-xs font-semibold text-ink-900">
                {popularLabel}
              </span>
            )}

            <div className="mb-5">
              <h3 className="mb-1 font-display text-h3 text-ink-900">{option.name}</h3>
              <p className="text-xs text-muted">{option.surface}</p>
            </div>

            <div className="mb-5 space-y-3">
              <div>
                <p className="mb-0.5 text-xs text-muted">Ponctuel, à partir de</p>
                <p className="text-xl font-bold text-ink-900">{option.pricePonctuel}</p>
              </div>
              {option.priceAbonnement && (
                <div className="border-t border-ink-100 pt-3">
                  <p className="mb-0.5 text-xs text-muted">Abonnement mensuel, à partir de</p>
                  <p className="text-lg font-semibold text-success">{option.priceAbonnement}</p>
                </div>
              )}
            </div>

            <ul className="mb-6 space-y-2">
              {option.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-small text-ink-600">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              href={getWhatsAppLink(`Devis ${option.name} — ${tab}`)}
              variant={option.popular ? 'primary' : 'outline'}
              size="sm"
              fullWidth
              icon={ArrowRight}
              iconPosition="right"
              className="mt-auto"
            >
              {ctaLabel}
            </Button>
          </Card>
        ))}
      </div>

      {showPayment && (
        <>
          <Card padding="sm" className="mb-6 mt-10">
            <p className="mb-4 text-center text-small font-medium text-ink-700">Moyens de paiement acceptés</p>
            <div className="flex flex-wrap justify-center gap-3">
              {paymentMethods.map((m) => {
                const Icon = paymentIcons[m.icon] || Banknote;
                return (
                  <div key={m.name} className="flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-small text-ink-600">
                    <Icon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                    {m.name}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-6 text-small text-ink-600 sm:grid-cols-2">
            <Card padding="sm">
              <p className="mb-1 font-semibold text-ink-900">Prestation ponctuelle</p>
              <p>{PAYMENT_TERMS.ponctuel}</p>
            </Card>
            <Card padding="sm">
              <p className="mb-1 font-semibold text-ink-900">Abonnement</p>
              <p>{PAYMENT_TERMS.abonnement}</p>
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}
