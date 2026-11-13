import Link from 'next/link';
import { Clock, Facebook, Instagram, Linkedin, Mail, Phone } from 'lucide-react';
import Container from '@/components/ui/Container';
import Logo from '@/components/ui/Logo';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { BRAND, BUSINESS_HOURS, COMPANY, CONTACT, SOCIAL_MEDIA, TEL_LINK, getWhatsAppLink } from '@/lib/constants';
import { CTA_DEMANDE, FOOTER_COLONNES, FOOTER_LEGAL } from '@/components/navigation/nav-data';

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

const titreColonne = 'mb-3 text-eyebrow uppercase text-brand-300';
const lienClasses =
  'inline-flex min-h-tap sm:min-h-8 items-center text-sm text-brand-100 transition-colors hover:text-white hover:underline';
const iconeClasses = 'w-4 h-4 flex-shrink-0 text-brand-300';

export default function Footer({ villes }: { villes: string }) {
  return (
    <footer className="surface-dark bg-navy-deep text-brand-100 pb-20 lg:pb-0">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo variant="blanc" height={44} className="h-11 w-auto" />
            <p className="mt-4 font-semibold text-white">{BRAND.signature}</p>
            <p className="mt-1 text-small">Propreté, recrutement de personnel et espaces verts à {villes}, Cameroun.</p>
          </div>
          {socialLinks.length > 0 && (
            <ul className="flex gap-2">
              {socialLinks.map(({ name, href, Icon }) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLONNES.map((colonne) => (
            <nav key={colonne.titre} aria-label={colonne.titre}>
              <h2 className={titreColonne}>{colonne.titre}</h2>
              <ul>
                {colonne.liens.map((lien) => (
                  <li key={lien.href}>
                    <Link href={lien.href} className={lienClasses}>
                      {lien.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className={titreColonne}>Contact</h2>
            <ul>
              <li className="flex items-center gap-2.5">
                <Phone className={iconeClasses} aria-hidden="true" />
                <a href={TEL_LINK} className={lienClasses}>
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <WhatsAppIcon className={iconeClasses} />
                <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className={lienClasses}>
                  WhatsApp
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className={iconeClasses} aria-hidden="true" />
                <a href={`mailto:${CONTACT.email}`} className={`${lienClasses} break-all`}>
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5 py-1.5">
                <Clock className={`${iconeClasses} mt-0.5`} aria-hidden="true" />
                <span className="text-sm">
                  {BUSINESS_HOURS.weekdays}
                  <br />
                  {BUSINESS_HOURS.saturday}
                  <br />
                  {BUSINESS_HOURS.sunday}
                </span>
              </li>
              <li>
                <Link href={CTA_DEMANDE.href} className={`${lienClasses} font-semibold !text-white`}>
                  {CTA_DEMANDE.label}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-3 text-xs sm:flex-row">
          <p>
            © {new Date().getFullYear()} {COMPANY.legalName}
            {COMPANY.rccm && ` · RCCM ${COMPANY.rccm}`}
          </p>
          <ul className="flex flex-wrap justify-center gap-x-5">
            {FOOTER_LEGAL.map((lien) => (
              <li key={lien.href}>
                <Link href={lien.href} className="inline-flex min-h-tap items-center hover:text-white hover:underline">
                  {lien.label}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}
