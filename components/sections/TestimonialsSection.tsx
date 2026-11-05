import { MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import TestimonialCard from '@/components/ui/TestimonialCard';
import { AVIS_ENCART, CHIFFRES, TEMOIGNAGES_EN_TETE } from '@/content/home-data';
import { verifiedTestimonials } from '@/content/testimonials-data';
import { getWhatsAppLink } from '@/lib/constants';

/** Titre et avis masqués tant qu'aucun avis n'est vérifié et autorisé ; l'encart « Laisser un avis » reste. */
export default function TestimonialsSection() {
  const avecAvis = verifiedTestimonials.length > 0;
  return (
    <Section
      id="temoignages"
      as={avecAvis ? 'section' : 'div'}
      labelledBy={avecAvis ? 'temoignages-titre' : undefined}
      spacing={avecAvis ? 'default' : 'sm'}
      className="scroll-mt-20"
    >
      {avecAvis && (
        <>
          <SectionHeader
            id="temoignages-titre"
           
            eyebrow={TEMOIGNAGES_EN_TETE.surtitre}
            title={TEMOIGNAGES_EN_TETE.titre}
            intro={TEMOIGNAGES_EN_TETE.sousTitre}
          />
          <div className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {verifiedTestimonials.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        </>
      )}
      {CHIFFRES.length > 0 && (
        <dl className="mb-10 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
          {CHIFFRES.map((c) => (
            <div key={c.libelle} className="flex flex-col-reverse border-t border-ink-200 py-5">
              <dt className="mt-2 text-small text-ink-600">{c.libelle}</dt>
              <dd className="font-mono text-figure tabular-nums text-navy">{c.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      <Card padding="sm" className="sm:flex-row sm:items-center sm:gap-5">
        <MessageSquare className="mb-3 h-6 w-6 flex-shrink-0 text-primary sm:mb-0" strokeWidth={1.5} aria-hidden="true" />
        <div className="sm:flex-1">
          <p className="font-semibold text-ink-900">{AVIS_ENCART.titre}</p>
          <p className="text-small text-ink-600">{AVIS_ENCART.texte}</p>
        </div>
        <Button href={getWhatsAppLink(AVIS_ENCART.whatsappMessage)} variant="outline" size="sm" className="mt-4 self-start sm:mt-0 sm:self-auto">
          {AVIS_ENCART.cta}
        </Button>
      </Card>
    </Section>
  );
}
