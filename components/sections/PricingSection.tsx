import React from 'react';
import { Check, Sparkles, Banknote, Smartphone, Building2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { pricingParticuliers, pricingProfessionnels, paymentMethods } from '@/content/pricing-data';
import { getWhatsAppLink, GUARANTEES } from '@/lib/constants';
import { FaWhatsapp } from "react-icons/fa";

export default function PricingSection() {
  return (
    <section id="tarifs" className="py-20 bg-gradient-to-b from-white to-light">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full mb-4">
            <Banknote className="w-5 h-5" />
            <span className="font-semibold">Tarifs</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Prix Transparents & Accessibles
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choisissez la formule qui correspond à vos besoins
          </p>
        </div>
        
        {/* Particuliers */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-dark text-center mb-8">
            Pour Particuliers
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingParticuliers.map((option) => (
              <div
                key={option.id}
                className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 ${
                  option.popular
                    ? 'border-secondary scale-105'
                    : 'border-gray-100 hover:border-primary'
                }`}
              >
                {option.popular && (
                  <div className="bg-secondary text-white text-sm font-bold px-3 py-1 rounded-full inline-block mb-4">
                    ⭐ Populaire
                  </div>
                )}
                
                <h4 className="text-2xl font-bold text-dark mb-2">{option.name}</h4>
                <p className="text-sm text-gray-600 mb-4">{option.surface}</p>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-1">Prestation ponctuelle</p>
                  <p className="text-2xl font-black text-primary mb-4">{option.pricePonctuel}</p>
                  
                  {option.priceAbonnement && (
                    <>
                      <p className="text-sm text-gray-600 mb-1">Abonnement (4 passages/mois)</p>
                      <p className="text-2xl font-black text-secondary">{option.priceAbonnement}</p>
                    </>
                  )}
                </div>
                
                <ul className="space-y-3 mb-6">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-5 h-5 text-secondary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  href={getWhatsAppLink(`Je souhaite un devis pour ${option.name}`)}
                  variant={option.popular ? 'primary' : 'outline'}
                  fullWidth
                >
                  <FaWhatsapp className="mr-2 text-xl" />
                  Demander un Devis
                </Button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Professionnels */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-dark text-center mb-8">
            Pour Professionnels
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingProfessionnels.map((option) => (
              <div
                key={option.id}
                className={`bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 ${
                  option.popular
                    ? 'border-primary scale-105'
                    : 'border-gray-100 hover:border-primary'
                }`}
              >
                {option.popular && (
                  <div className="bg-primary text-white text-sm font-bold px-3 py-1 rounded-full inline-block mb-4">
                    ⭐ Recommandé
                  </div>
                )}
                
                <h4 className="text-2xl font-bold text-dark mb-2">{option.name}</h4>
                <p className="text-sm text-gray-600 mb-4">{option.surface}</p>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-1">Prestation ponctuelle</p>
                  <p className="text-2xl font-black text-primary mb-4">{option.pricePonctuel}</p>
                  
                  {option.priceAbonnement && (
                    <>
                      <p className="text-sm text-gray-600 mb-1">Abonnement mensuel</p>
                      <p className="text-2xl font-black text-secondary">{option.priceAbonnement}</p>
                    </>
                  )}
                </div>
                
                <ul className="space-y-3 mb-6">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  href={getWhatsAppLink(`Je souhaite un devis professionnel pour ${option.name}`)}
                  variant={option.popular ? 'primary' : 'outline'}
                  fullWidth
                >
                  <FaWhatsapp className="mr-2 text-xl" />
                  Demander un Devis
                </Button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Payment Methods */}
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-12">
          <h3 className="text-2xl font-bold text-dark text-center mb-6">
            Moyens de Paiement Acceptés
          </h3>
          <div className="flex flex-wrap justify-center gap-6">
            {paymentMethods.map((method) => {
              const IconComponent = method.icon === 'Banknote' ? Banknote : method.icon === 'Smartphone' ? Smartphone : Building2;
              return (
                <div
                  key={method.name}
                  className="flex items-center gap-3 bg-gray-50 px-6 py-3 rounded-xl border-2 border-gray-200"
                >
                  <IconComponent className="w-6 h-6 text-primary" />
                  <span className="font-semibold text-dark">{method.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Guarantees */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 text-white">
          <div className="text-center mb-8">
            <Sparkles className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-3xl font-bold mb-2">Nos Garanties</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {GUARANTEES.map((guarantee, index) => (
              <div key={index} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">{guarantee}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
