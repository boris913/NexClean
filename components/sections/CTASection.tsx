import { ArrowRight, FileText, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import { CTA_FINAL } from '@/content/home-data';
import { CONTACT, TEL_LINK, getWhatsAppLink } from '@/lib/constants';

interface CTASectionProps {
  title?: string;
  subtitle?: string;
  whatsappMessage?: string;
  formHref?: string;
  formLabel?: string;
  whatsappLabel?: string;
  /** Action complémentaire, par exemple « Demander du personnel ». */
  secondaryCta?: { href: string; label: string };
}

/** CTA de fin de page : demande + WhatsApp + téléphone. Par défaut, le message neutre de l'accueil. */
export default function CTASection({
  title = CTA_FINAL.titre,
  subtitle = CTA_FINAL.texte,
  whatsappMessage,
  formHref = CTA_FINAL.cta.href,
  formLabel = CTA_FINAL.cta.label,
  whatsappLabel = CTA_FINAL.whatsapp.label,
  secondaryCta,
}: CTASectionProps) {
  return (
    <Section spacing="sm">
      <Reveal
        from="scale"
        className="surface-dark rounded-4xl bg-navy px-6 py-10 text-white sm:px-12 sm:py-14 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12"
      >
        <div>
          <h2 className="max-w-2xl text-h2 text-white">{title}</h2>
          <p className="mt-4 max-w-xl text-lead text-brand-100">{subtitle}</p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:mt-0 lg:max-w-md lg:flex-col">
          <Button href={formHref} size="lg" icon={FileText}>
            {formLabel}
          </Button>
          {secondaryCta && (
            <Button href={secondaryCta.href} variant="inverse" size="lg" icon={ArrowRight} iconPosition="right">
              {secondaryCta.label}
            </Button>
          )}
          <Button href={getWhatsAppLink(whatsappMessage)} variant="inverse" size="lg" whatsappIcon>
            {whatsappLabel}
          </Button>
          <Button href={TEL_LINK} variant="inverse" size="lg" icon={Phone}>
            {CONTACT.phoneDisplay}
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
