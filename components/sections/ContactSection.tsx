import { ArrowRight, Clock, Mail, Phone } from 'lucide-react';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import ContactForm from '@/components/forms/ContactForm';
import { BUSINESS_HOURS, CONTACT, TEL_LINK, getWhatsAppLink } from '@/lib/constants';

/** Formulaire `devis` (ancre `#contact`) et coordonnées directes. */
export default function ContactSection() {
  return (
    <Section id="contact" className="scroll-mt-20">
      <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="min-w-0">
          <SectionHeader title="Demander un devis" intro="Moins d'une minute à remplir." className="!mb-8" />
          <Card>
            <ContactForm />
          </Card>
        </div>

        <div className="min-w-0">
          <SectionHeader
            title="Nous joindre directement"
            intro="WhatsApp est le plus rapide : vous pouvez y joindre vos photos."
            className="!mb-8"
          />
          <div className="space-y-3">
            <Card
              href={getWhatsAppLink()}
              variant="interactive"
              padding="sm"
              className="!flex-row items-center gap-4"
              aria-label={`Écrire sur WhatsApp au ${CONTACT.phoneDisplay}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-whatsapp text-whatsapp-ink">
                <WhatsAppIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-muted">WhatsApp (recommandé)</span>
                <span className="block text-small font-semibold text-ink-900 transition-colors group-hover:text-whatsapp-dark">
                  {CONTACT.phoneDisplay}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </Card>

            <Card padding="sm" className="!flex-row items-center gap-4">
              <IconBadge icon={Phone} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">Téléphone</p>
                <a href={TEL_LINK} className="text-small font-semibold text-ink-900 transition-colors hover:text-primary">
                  {CONTACT.phoneDisplay}
                </a>
              </div>
            </Card>

            <Card padding="sm" className="!flex-row items-center gap-4">
              <IconBadge icon={Mail} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">E-mail</p>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="break-words text-small font-semibold text-ink-900 transition-colors hover:text-primary"
                >
                  {CONTACT.email}
                </a>
              </div>
            </Card>

            <div className="surface-dark rounded-card bg-navy p-5 text-white">
              <p className="mb-3 flex items-center gap-2 text-small font-semibold">
                <Clock className="h-4 w-4 text-brand-300" aria-hidden="true" />
                Horaires d&apos;intervention
              </p>
              <ul className="space-y-2 text-small text-brand-100">
                <li>{BUSINESS_HOURS.weekdays}</li>
                <li>{BUSINESS_HOURS.saturday}</li>
                <li>{BUSINESS_HOURS.sunday}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
