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
        className="surface-dark rounded-4xl bg-forest px-6 py-12 text-center text-white sm:px-12 sm:py-16"
      >
        <h2 className="mx-auto max-w-2xl font-display text-h2 text-white">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lead text-brand-100">{subtitle}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
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
