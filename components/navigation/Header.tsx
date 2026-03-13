'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CONTACT } from '@/lib/constants';
import Image from 'next/image';

const navLinks = [
  { name: 'Accueil', href: '#' },
  { name: 'Services', href: '#services' },
  { name: 'Tarifs', href: '#tarifs' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contact', href: '#contact' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_#e2e8f0]'
          : 'bg-white/90 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo - utilisation d'une balise <a> standard pour éviter les problèmes d'hydratation avec next/image */}
          <a href="/" className="flex-shrink-0 group">
            <Image
              src="/images/logo.png"
              alt="NexClean"
              width={150}
              height={50}
              className="object-contain"
              priority
            />
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => {
              if (link.href.startsWith('/') || link.href.startsWith('#')) {
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    scroll={link.href.startsWith('#')}
                    className="relative text-sm font-medium text-slate-700 hover:text-primary transition-colors duration-150 group"
                  >
                    {link.name}
                    <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-primary group-hover:w-full transition-all duration-300" />
                  </Link>
                );
              }
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative text-sm font-medium text-slate-700 hover:text-primary transition-colors duration-150 group"
                >
                  {link.name}
                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-primary group-hover:w-full transition-all duration-300" />
                </a>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href={`tel:${CONTACT.phone}`}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {CONTACT.phone}
            </a>
            <Button href={`tel:${CONTACT.phone}`} variant="primary" size="sm" icon={Phone}>
              Devis gratuit
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 animate-slide-down">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-1">
            {navLinks.map((link) => {
              if (link.href.startsWith('/') || link.href.startsWith('#')) {
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    scroll={link.href.startsWith('#')}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 px-4 rounded-lg text-sm font-medium text-slate-700 hover:text-primary hover:bg-slate-50 transition-colors"
                  >
                    {link.name}
                  </Link>
                );
              }
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="py-3 px-4 rounded-lg text-sm font-medium text-slate-700 hover:text-primary hover:bg-slate-50 transition-colors"
                >
                  {link.name}
                </a>
              );
            })}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Button
                href={`tel:${CONTACT.phone}`}
                variant="primary"
                size="md"
                icon={Phone}
                fullWidth
              >
                Obtenir un devis gratuit
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
