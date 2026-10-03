import { MessageSquare } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import TestimonialCard from '@/components/ui/TestimonialCard';
import Button from '@/components/ui/Button';
import { verifiedTestimonials } from '@/content/testimonials-data';
import { getWhatsAppLink } from '@/lib/constants';

/** N'affiche que les avis vérifiés et autorisés (voir testimonials-data.ts). */
export default function TestimonialsSection() {
  return (
    <section id="temoignages" className="py-20 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionLabel className="mb-4">Témoignages</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-3">L&apos;avis de nos clients</h2>
        </div>

        {verifiedTestimonials.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {verifiedTestimonials.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        )}

        <div className="max-w-xl mx-auto text-center rounded-2xl bg-primary-light/50 border border-primary/10 p-6">
          <MessageSquare className="w-8 h-8 text-primary mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-semibold text-slate-900 mb-1">Vous avez fait appel à NexClean ?</p>
          <p className="text-sm text-slate-500 mb-4">Votre avis nous aide à progresser et rassure nos futurs clients.</p>
          <Button
            href={getWhatsAppLink("Bonjour NexClean, je souhaite laisser un avis sur votre prestation :")}
            variant="primary"
            size="sm"
          >
            Laisser un avis
          </Button>
        </div>
      </div>
    </section>
  );
}
