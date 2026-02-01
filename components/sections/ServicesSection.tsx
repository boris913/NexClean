import React from 'react';
import { Sparkles } from 'lucide-react';
import ServiceCard from '@/components/ui/ServiceCard';
import Button from '@/components/ui/Button';
import { services } from '@/content/services-data';
import { getWhatsAppLink } from '@/lib/constants';
import { FaWhatsapp } from "react-icons/fa";

export default function ServicesSection() {
  return (
    <section id="services" className="py-20 bg-gradient-to-b from-light to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">Nos Services</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Des Solutions pour Tous Vos Besoins
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Que vous soyez particulier ou professionnel, nous avons le service qu'il vous faut
          </p>
        </div>
        
        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
        
        {/* CTA */}
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-6">
            Besoin d'un service personnalisé ? Contactez-nous pour un devis gratuit
          </p>
          <Button 
            href={getWhatsAppLink('Bonjour, je souhaite obtenir un devis personnalisé')}
            variant="primary"
            size="lg"
          >
            <FaWhatsapp className="mr-2 text-xl" />
            Demander un Devis Gratuit
          </Button>
        </div>
      </div>
    </section>
  );
}
