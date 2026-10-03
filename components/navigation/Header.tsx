'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, ChevronDown, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CONTACT, TEL_LINK } from '@/lib/constants';
import Image from 'next/image';

interface NavLink {
  name: string;
  href: string;
  children?: { name: string; href: string; description?: string }[];
}

export const navLinks: NavLink[] = [
  { name: 'Accueil', href: '/' },
  {
    name: 'Services',
    href: '/services',
    children: [
      { name: 'Tous nos services', href: '/services', description: 'Vue d\'ensemble de nos prestations' },
      { name: 'Particuliers', href: '/particuliers', description: 'Maisons, appartements, studios' },
      { name: 'Professionnels', href: '/professionnels', description: 'Bureaux, commerces, hôtels…' },
      { name: 'Espaces verts', href: '/espaces-verts', description: 'Tonte, débroussaillage, haies' },
      { name: 'Abonnements', href: '/abonnements', description: 'Entretien régulier' },
    ],
  },
  { name: 'Réalisations', href: '/realisations' },
  { name: 'Boutique', href: '/boutique' },
  { name: 'Tarifs', href: '/tarifs' },
  { name: 'À propos', href: '/a-propos' },
  { name: 'Recrutement', href: '/recrutement' },
  { name: 'Blog', href: '/blog' },
];

export default function Header() {
  const pathname = usePathname() || '/';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fermer menus à chaque navigation
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const isActive = (link: NavLink) =>
    link.href === '/'
      ? pathname === '/'
      : pathname.startsWith(link.href) || !!link.children?.some((c) => pathname.startsWith(c.href));

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_#e2e8f0]'
          : 'bg-white/90 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <Link href="/" className="flex-shrink-0 group">
            <Image
              src="/images/logo.png"
              alt="NexClean"
              width={140}
              height={46}
              className="object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7" aria-label="Navigation principale">
            {navLinks.filter((l) => l.href !== '/').map((link) =>
              link.children ? (
                <div key={link.name} className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                      isActive(link) ? 'text-primary' : 'text-slate-700 hover:text-primary'
                    }`}
                  >
                    {link.name}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-72 bg-white rounded-xl border border-slate-100 shadow-card-hover p-2 animate-slide-down">
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <span className="block text-sm font-medium text-slate-900">{child.name}</span>
                          {child.description && (
                            <span className="block text-xs text-slate-500">{child.description}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative text-sm font-medium transition-colors duration-150 group ${
                    isActive(link) ? 'text-primary' : 'text-slate-700 hover:text-primary'
                  }`}
                >
                  {link.name}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-[1.5px] bg-primary transition-all duration-300 ${
                      isActive(link) ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </Link>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-2">
            <a
              href={TEL_LINK}
              aria-label={`Appeler NexClean au ${CONTACT.phoneDisplay}`}
              className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary transition-colors"
            >
              <Phone className="w-4 h-4" />
            </a>
            <Button href="/contact" variant="primary" size="sm">
              Demander un devis
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-6 h-6 text-slate-900" /> : <Menu className="w-6 h-6 text-slate-900" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 animate-slide-down max-h-[calc(100dvh-5rem)] overflow-y-auto">
          <nav className="max-w-6xl mx-auto px-4 pt-4 pb-28 flex flex-col gap-0.5" aria-label="Navigation mobile">
            {navLinks.map((link) => (
              <div key={link.name}>
                <Link
                  href={link.href}
                  className={`flex items-center justify-between py-3 px-4 rounded-lg text-base font-medium transition-colors ${
                    isActive(link) ? 'text-primary bg-primary-light/50' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {link.name}
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </Link>
                {link.children && (
                  <div className="ml-4 pl-3 border-l border-slate-100 mb-1">
                    {link.children
                      .filter((c) => c.href !== link.href)
                      .map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block py-2.5 px-3 rounded-lg text-sm text-slate-600 hover:text-primary hover:bg-slate-50"
                        >
                          {child.name}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/contact"
              className="flex items-center justify-between py-3 px-4 rounded-lg text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              Contact / Devis
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
