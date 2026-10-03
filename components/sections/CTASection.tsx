import { Phone, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { CONTACT, TEL_LINK, getWhatsAppLink } from '@/lib/constants';

interface CTASectionProps {
  title?: string;
  subtitle?: string;
  whatsappMessage?: string;
  formHref?: string;
}

/** CTA final : WhatsApp + formulaire + téléphone. */
export default function CTASection({
  title = 'Prêt à nous confier votre espace ?',
  subtitle = 'Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis.',
  whatsappMessage,
  formHref = '/contact',
}: CTASectionProps) {
  return (
    <section className="py-16 sm:py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-3xl sm:text-4xl text-white mb-3">{title}</h2>
        <p className="text-blue-100 mb-8 max-w-xl mx-auto">{subtitle}</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button href={getWhatsAppLink(whatsappMessage)} variant="whatsapp" size="lg">
            <WhatsAppIcon className="w-5 h-5" />
            Devis sur WhatsApp
          </Button>
          <Button href={formHref} variant="secondary" size="lg" icon={FileText}>
            Formulaire de devis
          </Button>
          <Button href={TEL_LINK} variant="secondary" size="lg" icon={Phone}>
            {CONTACT.phoneDisplay}
          </Button>
        </div>
      </div>
    </section>
  );
}
