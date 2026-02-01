import React from 'react';
import { Mail, Phone, MapPin, Clock, MessageCircle } from 'lucide-react';
import { FaRegCalendarAlt, FaBolt, FaWhatsapp } from "react-icons/fa";
import ContactForm from '@/components/forms/ContactForm';
import Button from '@/components/ui/Button';
import { CONTACT, BUSINESS_HOURS, getWhatsAppLink } from '@/lib/constants';

export default function ContactSection() {
  return (
    <section id="contact" className="py-20 bg-gradient-to-b from-light to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold">Contact</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Parlons de Votre Projet
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Contactez-nous dès maintenant pour un devis gratuit et sans engagement
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-3xl font-bold text-dark mb-6">
                Coordonnées
              </h3>
              
              <div className="space-y-4">
                {/* WhatsApp (Priority) */}
                <div className="flex items-start gap-4 bg-gradient-to-r from-[#25D366]/10 to-[#25D366]/5 p-4 rounded-xl border-2 border-[#25D366]/20">
                  <div className="bg-[#25D366] text-white p-3 rounded-lg">
                    <FaWhatsapp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-dark mb-1">WhatsApp (Recommandé)</p>
                    <a 
                      href={getWhatsAppLink()} 
                      className="text-[#25D366] font-semibold hover:underline text-lg"
                    >
                      {CONTACT.whatsapp}
                    </a>
                    <p className="text-sm text-gray-600 mt-1">Réponse sous 1 heure</p>
                  </div>
                </div>
                
                {/* Phone */}
                <div className="flex items-start gap-4 bg-white p-4 rounded-xl border-2 border-gray-100">
                  <div className="bg-primary text-white p-3 rounded-lg">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-dark mb-1">Téléphone</p>
                    <a 
                      href={`tel:${CONTACT.phone}`}
                      className="text-primary font-semibold hover:underline text-lg"
                    >
                      {CONTACT.phone}
                    </a>
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-start gap-4 bg-white p-4 rounded-xl border-2 border-gray-100">
                  <div className="bg-secondary text-white p-3 rounded-lg">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-dark mb-1">Email</p>
                    <a 
                      href={`mailto:${CONTACT.email}`}
                      className="text-secondary font-semibold hover:underline"
                    >
                      {CONTACT.email}
                    </a>
                  </div>
                </div>
                
                {/* Address */}
                <div className="flex items-start gap-4 bg-white p-4 rounded-xl border-2 border-gray-100">
                  <div className="bg-accent text-white p-3 rounded-lg">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-dark mb-1">Localisation</p>
                    <p className="text-gray-700">{CONTACT.address}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Business Hours */}
            <div className="bg-gradient-to-br from-primary to-secondary p-6 rounded-2xl text-white">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-6 h-6" />
                <h4 className="text-xl font-bold">Horaires d'Intervention</h4>
              </div>
              <div className="space-y-2 text-white/90">
                <p className="flex items-center gap-2">
                  <FaRegCalendarAlt className="text-secondary" />
                  {BUSINESS_HOURS.weekdays}
                </p>

                <p className="flex items-center gap-2">
                  <FaRegCalendarAlt className="text-secondary" />
                  {BUSINESS_HOURS.saturday}
                </p>

                <p className="flex items-center gap-2">
                  <FaRegCalendarAlt className="text-secondary" />
                  {BUSINESS_HOURS.sunday}
                </p>

                <p className="mt-4 pt-4 border-t border-white/20 font-semibold flex items-center gap-2">
                  <FaBolt className="text-accent" />
                  {BUSINESS_HOURS.response}
                </p>
              </div>

            </div>
            
            {/* Quick WhatsApp CTA */}
            <Button 
              href={getWhatsAppLink()}
              variant="whatsapp"
              size="lg"
              fullWidth
            >
              <FaWhatsapp className="mr-2 text-xl" />
              Discuter sur WhatsApp
            </Button>
          </div>
          
          {/* Contact Form */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <h3 className="text-2xl font-bold text-dark mb-6">
              Demande de Devis Gratuit
            </h3>
            <ContactForm />
          </div>
        </div>
        
        {/* Map Embed (Placeholder) */}
        <div className="mt-16 max-w-6xl mx-auto">
          <div className="bg-gray-200 rounded-2xl overflow-hidden h-96 flex items-center justify-center">
            <div className="text-center p-8">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-semibold text-lg">
                Nous intervenons dans toute la ville de Douala
              </p>
              <p className="text-gray-500 mt-2">
                Bonapriso • Akwa • Bonanjo • Bali • Makepe • Bonamoussadi et plus
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
