'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CONTACT } from '@/lib/constants';
import Image from 'next/image';

const navLinks = [
  { name: 'Accueil', href: '#' },
  { name: 'Services', href: '#services' },
  { name: 'Tarifs', href: '#tarifs' },
  { name: 'Témoignages', href: '#temoignages' },
  { name: 'Contact', href: '#contact' },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white/95 backdrop-blur-sm'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo avec texte inclus */}
          <a href="#" className="flex items-center group">
            <div className="group-hover:scale-105 transition-transform">
              <div className="relative w-48 h-12 md:w-56 md:h-14">
                <Image 
                  src="/images/nexclean-logo-1.png" 
                  alt="NexClean - La propreté nouvelle génération" 
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </a>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-dark font-semibold hover:text-primary transition-colors relative group"
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
              </a>
            ))}
          </nav>
          
          {/* Desktop CTA */}
          <div className="hidden lg:block">
            <Button 
              href={`tel:${CONTACT.phone}`}
              variant="primary"
              size="md"
              icon={Phone}
            >
              Obtenez un devis gratuit
            </Button>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-dark" />
            ) : (
              <Menu className="w-6 h-6 text-dark" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu - Navigation centrée */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 animate-slide-up">
          <div className="flex flex-col items-center px-4 py-8 space-y-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-dark font-semibold hover:text-primary transition-colors py-2 text-lg w-full text-center"
              >
                {link.name}
              </a>
            ))}
            <div className="w-full max-w-xs mt-4">
              <Button 
                href={`tel:${CONTACT.phone}`}
                variant="primary"
                size="md"
                icon={Phone}
                fullWidth
              >
                Obtenez un devis gratuit
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}