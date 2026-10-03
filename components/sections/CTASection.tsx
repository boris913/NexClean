import { Phone, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import Reveal from '@/components/ui/Reveal';
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
    <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-white">
      <Reveal from="scale" className="relative max-w-6xl mx-auto overflow-hidden rounded-[2.5rem] bg-brand-950 px-6 py-14 sm:px-12 sm:py-20 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-brand-500/40 blur-3xl animate-blob" />
          <div className="absolute -bottom-32 -right-10 w-96 h-96 rounded-full bg-brand-400/30 blur-3xl animate-blob [animation-delay:-8s]" />
          <svg viewBox="0 0 24 24" className="absolute top-10 right-[12%] w-8 h-8 text-brand-400 animate-sparkle" fill="currentColor">
            <path d="M12 0l3.1 8.9L24 12l-8.9 3.1L12 24l-3.1-8.9L0 12l8.9-3.1z" />
          </svg>
          <svg viewBox="0 0 24 24" className="absolute bottom-12 left-[10%] w-5 h-5 text-white/70 animate-sparkle [animation-delay:-1.2s]" fill="currentColor">
            <path d="M12 0l3.1 8.9L24 12l-8.9 3.1L12 24l-3.1-8.9L0 12l8.9-3.1z" />
          </svg>
        </div>
        <div className="relative">
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-white mb-4 max-w-2xl mx-auto">{title}</h2>
          <p className="text-brand-100/80 text-lg mb-10 max-w-xl mx-auto">{subtitle}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button href={getWhatsAppLink(whatsappMessage)} variant="whatsapp" size="lg">
              <WhatsAppIcon className="w-5 h-5" />
              Devis sur WhatsApp
            </Button>
            <Button href={formHref} variant="primary" size="lg" icon={FileText}>
              Formulaire de devis
            </Button>
            <Button href={TEL_LINK} variant="outline-light" size="lg" icon={Phone}>
              {CONTACT.phoneDisplay}
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
