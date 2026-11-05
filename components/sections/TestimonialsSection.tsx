import { MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import TestimonialCard from '@/components/ui/TestimonialCard';
import { AVIS_ENCART, TEMOIGNAGES_EN_TETE } from '@/content/home-data';
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
            align="center"
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
      <Card className="mx-auto max-w-xl items-center text-center">
        <MessageSquare className="mb-3 h-8 w-8 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <p className="mb-1 font-semibold text-ink-900">{AVIS_ENCART.titre}</p>
        <p className="mb-4 text-small text-ink-600">{AVIS_ENCART.texte}</p>
        <Button href={getWhatsAppLink(AVIS_ENCART.whatsappMessage)} variant="outline" size="sm">
          {AVIS_ENCART.cta}
        </Button>
      </Card>
    </Section>
  );
}
