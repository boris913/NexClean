'use client';

import { useState } from 'react';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { pricingParticuliers, pricingProfessionnels, paymentMethods } from '@/content/pricing-data';
import { getWhatsAppLink } from '@/lib/constants';
import { Check, Banknote, Smartphone, Building2, ArrowRight } from 'lucide-react';

const paymentIcons: Record<string, typeof Banknote> = {
  Banknote,
  Smartphone,
  Building2,
};

export default function PricingSection() {
  const [tab, setTab] = useState<'particuliers' | 'professionnels'>('particuliers');
  const options = tab === 'particuliers' ? pricingParticuliers : pricingProfessionnels;

  return (
    <section id="tarifs" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">Tarifs</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Prix transparents et accessibles
          </h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Choisissez la formule qui correspond à vos besoins. Sans mauvaises surprises.
          </p>

          {/* Tabs */}
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            {(['particuliers', 'professionnels'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'particuliers' ? 'Particuliers' : 'Professionnels'}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {options.map((option) => (
            <div
              key={option.id}
              className={`relative bg-white rounded-2xl p-6 border transition-all duration-200 ${
                option.popular
                  ? 'border-primary shadow-[0_0_0_2px_#0A5ED7] shadow-card'
                  : 'border-slate-100 shadow-card hover:shadow-card-hover hover:border-slate-200'
              }`}
            >
              {/* Popular badge */}
              {option.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-semibold bg-primary text-white px-3 py-1 rounded-full">
                    Recommandé
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-semibold text-slate-900 mb-1">{option.name}</h3>
                <p className="text-xs text-slate-400">{option.surface}</p>
              </div>

              {/* Prices */}
              <div className="mb-5 space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Ponctuel</p>
                  <p className="text-xl font-bold text-slate-900">{option.pricePonctuel}</p>
                </div>
                {option.priceAbonnement && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-0.5">Abonnement mensuel</p>
                    <p className="text-lg font-semibold text-success">{option.priceAbonnement}</p>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {option.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                href={getWhatsAppLink(`Devis ${option.name} — ${tab}`)}
                variant={option.popular ? 'primary' : 'secondary'}
                size="sm"
                fullWidth
                icon={ArrowRight}
                iconPosition="right"
              >
                Demander un devis
              </Button>
            </div>
          ))}
        </div>

        {/* Payment methods */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8">
          <p className="text-sm font-medium text-slate-700 text-center mb-4">
            Moyens de paiement acceptés
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {paymentMethods.map((m) => {
              const Icon = paymentIcons[m.icon] || Banknote;
              return (
                <div
                  key={m.name}
                  className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-lg"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  {m.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-slate-400">
          Paiement après la prestation · Satisfaction garantie ou intervention gratuite
        </p>
      </div>
    </section>
  );
}
