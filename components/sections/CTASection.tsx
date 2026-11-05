import { FileText, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import { CONTACT, TEL_LINK, getWhatsAppLink } from '@/lib/constants';

interface CTASectionProps {
  title?: string;
  subtitle?: string;
  whatsappMessage?: string;
  formHref?: string;
  formLabel?: string;
  whatsappLabel?: string;
}

/** CTA de fin de page : formulaire + WhatsApp + téléphone. */
export default function CTASection({
  title = 'Prêt à nous confier votre espace ?',
  subtitle = 'Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis.',
  whatsappMessage,
  formHref = '/contact',
  formLabel = 'Formulaire de devis',
  whatsappLabel = 'Devis sur WhatsApp',
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
          <Button href={getWhatsAppLink(whatsappMessage)} variant="whatsapp" size="lg" whatsappIcon>
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
