import React from 'react';
import { Sparkles, Phone, ArrowRight } from 'lucide-react';
import { FaWhatsapp } from "react-icons/fa";
import Button from '@/components/ui/Button';
import { getWhatsAppLink, CONTACT, PROMO } from '@/lib/constants';

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] bg-gradient-to-br from-primary via-blue-600 to-secondary text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 right-10 animate-bounce-slow">
        <Sparkles className="w-12 h-12 text-yellow-300 opacity-80" />
      </div>
      <div className="absolute bottom-20 left-10 animate-pulse-slow">
        <Sparkles className="w-8 h-8 text-blue-200 opacity-60" />
      </div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Promo Badge - Optimisé pour mobile */}
          {PROMO.active && (
            <div className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 md:px-6 md:py-2 rounded-full mb-6 animate-pulse shadow-lg max-w-[90%] mx-auto">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                <span className="font-bold text-sm md:text-base whitespace-nowrap">{PROMO.title} : {PROMO.discount}</span>
                <span className="text-xs md:text-sm md:whitespace-nowrap">{PROMO.description}</span>
              </div>
            </div>
          )}
          
          {/* Main Heading */}
          <div className="mb-6 animate-fade-in">
            <div className="inline-flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-12 h-12 md:w-16 md:h-16 animate-pulse-slow" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-4 leading-tight">
              NEXCLEAN
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl font-light mb-2 text-blue-100">
              La propreté nouvelle génération
            </p>
          </div>
          
          {/* Subheading */}
          <p className="text-lg md:text-xl lg:text-2xl mb-8 max-w-2xl mx-auto leading-relaxed text-blue-50 animate-slide-up">
            Nettoyage professionnel pour maisons et bureaux à Douala. 
            <br />
            <span className="font-bold text-yellow-300">Rapide • Propre • Prix Accessibles</span>
          </p>
          
          {/* Value Props */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto">
            {['Intervention sous 24h', 'Satisfaction garantie', 'Tarifs transparents'].map((prop, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <p className="font-semibold text-sm md:text-base">{prop}</p>
              </div>
            ))}
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
            <Button 
              href={getWhatsAppLink()}
              variant="whatsapp"
              size="lg"
              className="text-base md:text-xl px-6 py-4 md:px-10 md:py-5 w-full sm:w-auto"
            >
              <FaWhatsapp className="mr-2 text-xl" />
              WhatsApp {CONTACT.phone}
            </Button>
            
            <Button 
              href={`tel:${CONTACT.phone}`}
              variant="outline"
              size="lg"
              icon={Phone}
              className="
                bg-white/10 backdrop-blur-sm
                border-white text-white
                hover:bg-primary
                hover:text-white
                hover:border-primary
                transition-all duration-300 ease-out
                text-base md:text-xl px-6 py-4 md:px-10 md:py-5
                w-full sm:w-auto
              "
            >
              Appeler maintenant
            </Button>
          </div>
          
          {/* Trust Signal */}
          <div className="mt-12 text-sm text-blue-100 px-4">
            <p className="mb-2">✓ Entreprise enregistrée au Cameroun</p>
            <p>✓ Déjà +{Math.floor(Math.random() * 50) + 100} clients satisfaits à Douala</p>
          </div>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <ArrowRight className="w-8 h-8 rotate-90 text-white opacity-60" />
      </div>
    </section>
  );
}