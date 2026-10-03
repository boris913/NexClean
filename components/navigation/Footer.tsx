import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Linkedin } from 'lucide-react';
import { CONTACT, COMPANY, SOCIAL_MEDIA, BUSINESS_HOURS, CITIES_LABEL, TEL_LINK, getWhatsAppLink } from '@/lib/constants';
import { services, getServiceHref } from '@/content/services-data';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import Logo from '@/components/ui/Logo';

const quickLinks = [
  { name: 'Particuliers', href: '/particuliers' },
  { name: 'Professionnels', href: '/professionnels' },
  { name: 'Réalisations', href: '/realisations' },
  { name: 'Boutique', href: '/boutique' },
  { name: 'Tarifs', href: '/tarifs' },
  { name: 'À propos', href: '/a-propos' },
  { name: 'Recrutement', href: '/recrutement' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contact / Devis', href: '/contact' },
];

const legalLinks = [
  { name: 'Mentions légales', href: '/mentions-legales' },
  { name: 'Confidentialité', href: '/confidentialite' },
  { name: 'CGV', href: '/cgv' },
];

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

const socialLinks = [
  { name: 'Facebook', href: SOCIAL_MEDIA.facebook, Icon: Facebook },
  { name: 'Instagram', href: SOCIAL_MEDIA.instagram, Icon: Instagram },
  { name: 'TikTok', href: SOCIAL_MEDIA.tiktok, Icon: TikTokIcon },
  { name: 'LinkedIn', href: SOCIAL_MEDIA.linkedin, Icon: Linkedin },
].filter((s) => s.href);

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-950 text-brand-100/80 pb-20 lg:pb-0">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div>
            <Logo variant="blanc" height={44} className="mb-5 h-11 w-auto" />
            <p className="text-sm leading-relaxed text-brand-100/70 mb-6">
              Nettoyage professionnel, entretien des espaces verts et produits d&apos;entretien à {CITIES_LABEL}, Cameroun.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ name, href, Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-brand-100/70 hover:text-brand-300 hover:bg-brand-500 transition-all"
                  aria-label={name}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-brand-100/70 hover:text-brand-300 hover:bg-[#25D366] transition-all"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Nos services</h4>
            <ul className="space-y-2.5">
              {services.map((s) => (
                <li key={s.slug}>
                  <Link href={getServiceHref(s)} className="text-sm text-brand-100/70 hover:text-brand-300 transition-colors">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-brand-100/70 hover:text-brand-300 transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <a href={TEL_LINK} className="text-sm text-brand-100/70 hover:text-brand-300 transition-colors">
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <a href={`mailto:${CONTACT.email}`} className="text-sm text-brand-100/70 hover:text-brand-300 transition-colors break-all">
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-brand-100/70">{CONTACT.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-brand-100/70">
                  {BUSINESS_HOURS.weekdays}
                  <br />
                  {BUSINESS_HOURS.saturday}
                  <br />
                  {BUSINESS_HOURS.sunday}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-100/60">
          <p>© {new Date().getFullYear()} {COMPANY.legalName}. Tous droits réservés.</p>
          <div className="flex flex-wrap justify-center gap-5">
            {legalLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-brand-300 transition-colors">
                {l.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
