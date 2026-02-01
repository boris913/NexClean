import React from 'react';
import { MessageCircle, Calendar, Sparkles, CheckCircle } from 'lucide-react';
import { FaWhatsapp } from "react-icons/fa";
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';

const steps = [
  {
    number: 1,
    icon: MessageCircle,
    title: "Contactez-nous",
    description: "Via WhatsApp, téléphone ou notre formulaire. Décrivez vos besoins.",
    color: "from-primary to-blue-500"
  },
  {
    number: 2,
    icon: Calendar,
    title: "Planifiez",
    description: "Choisissez la date et l'heure qui vous conviennent. Devis immédiat.",
    color: "from-secondary to-green-500"
  },
  {
    number: 3,
    icon: Sparkles,
    title: "On nettoie",
    description: "Notre équipe arrive à l'heure avec tout le matériel professionnel.",
    color: "from-accent to-orange-500"
  },
  {
    number: 4,
    icon: CheckCircle,
    title: "Vous validez",
    description: "Inspection ensemble. Paiement seulement si vous êtes satisfait.",
    color: "from-primary to-secondary"
  }
];

export default function ProcessSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Comment Ça Marche ?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Un processus simple en 4 étapes pour une propreté garantie
          </p>
        </div>
        
        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative group">
              {/* Connector Line (hidden on mobile, shown on desktop) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-[60%] w-[80%] h-1 bg-gradient-to-r from-primary/30 to-transparent z-0"></div>
              )}
              
              <div className="relative z-10 text-center">
                {/* Icon Container */}
                <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${step.color} text-white mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="w-16 h-16" />
                </div>
                
                {/* Step Number */}
                <div className="absolute top-0 right-1/2 transform translate-x-1/2 -translate-y-2 bg-dark text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  {step.number}
                </div>
                
                {/* Content */}
                <h3 className="text-2xl font-bold text-dark mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 shadow-xl">
          <h3 className="text-3xl font-bold text-white mb-4">
            Prêt à Commencer ?
          </h3>
          <p className="text-xl text-white/90 mb-6">
            Obtenez votre devis gratuit en moins de 2 minutes
          </p>
          <Button 
            href={getWhatsAppLink()}
            variant="whatsapp"
            size="lg"
            className="
              bg-secondary text-secondary
              hover:bg-secondary
              hover:text-white
              hover:border-secondary
              transition-all duration-300 ease-out
            "
          >
            <FaWhatsapp className="mr-2 text-xl" />
            Démarrer Maintenant
          </Button>

        </div>
      </div>
    </section>
  );
}
