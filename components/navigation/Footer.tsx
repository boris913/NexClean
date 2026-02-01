import React from 'react';
import { Phone, Mail, MapPin, Facebook, Instagram } from 'lucide-react';
import { FaWhatsapp } from "react-icons/fa";
import { CONTACT, SOCIAL_MEDIA, getWhatsAppLink } from '@/lib/constants';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gradient-to-br from-dark via-gray-800 to-dark text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Grille centrée sur mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 text-center md:text-left">
          
          {/* Brand avec logo seulement */}
          <div className="flex flex-col items-center md:items-start">
            <div className="mb-6">
              <div className="relative w-48 h-12 mx-auto md:mx-0">
                <Image 
                  src="/images/nexclean-logo-1.png" 
                  alt="NexClean - La propreté nouvelle génération" 
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <p className="text-gray-300 mb-6 leading-relaxed max-w-md md:max-w-none">
              La propreté nouvelle génération à Douala. Service de nettoyage professionnel pour particuliers et entreprises.
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              <a 
                href={SOCIAL_MEDIA.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-primary p-2 rounded-lg transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href={SOCIAL_MEDIA.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-primary p-2 rounded-lg transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-[#25D366] p-2 rounded-lg transition-colors"
              >
                <FaWhatsapp className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-4">Liens Rapides</h4>
            <ul className="space-y-3">
              {['Accueil', 'Services', 'Tarifs', 'Témoignages', 'Contact'].map((link) => (
                <li key={link}>
                  <a 
                    href={`#${link.toLowerCase()}`}
                    className="text-gray-300 hover:text-secondary transition-colors inline-block"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Services */}
          <div>
            <h4 className="text-lg font-bold mb-4">Nos Services</h4>
            <ul className="space-y-3 text-gray-300">
              {['Nettoyage Maison', 'Nettoyage Bureau', 'Nettoyage Vitres', 'Désinfection', 'Après Travaux', 'Abonnements'].map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>
          
          {/* Contact */}
          <div className="flex flex-col items-center md:items-start">
            <h4 className="text-lg font-bold mb-4">Contact</h4>
            <ul className="space-y-4 max-w-xs">
              <li className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex justify-center md:justify-start gap-3">
                  <Phone className="w-5 h-5 text-secondary flex-shrink-0 mt-1" />
                </div>
                <div className="text-center md:text-left">
                  <a href={`tel:${CONTACT.phone}`} className="text-gray-300 hover:text-secondary transition-colors">
                    {CONTACT.phone}
                  </a>
                </div>
              </li>
              <li className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex justify-center md:justify-start gap-3">
                  <Mail className="w-5 h-5 text-secondary flex-shrink-0 mt-1" />
                </div>
                <div className="text-center md:text-left">
                  <a href={`mailto:${CONTACT.email}`} className="text-gray-300 hover:text-secondary transition-colors">
                    {CONTACT.email}
                  </a>
                </div>
              </li>
              <li className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex justify-center md:justify-start gap-3">
                  <MapPin className="w-5 h-5 text-secondary flex-shrink-0 mt-1" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-gray-300">{CONTACT.address}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Bonapriso, Akwa, Bonanjo, Bali et plus
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400 text-center">
            <p>
              © {currentYear} NexClean. Tous droits réservés.
            </p>
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              <a href="#" className="hover:text-secondary transition-colors">Mentions Légales</a>
              <a href="#" className="hover:text-secondary transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-secondary transition-colors">CGV</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}