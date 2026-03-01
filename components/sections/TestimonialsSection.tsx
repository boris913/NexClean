import SectionLabel from '@/components/ui/SectionLabel';
import TestimonialCard from '@/components/ui/TestimonialCard';
import { testimonials } from '@/content/testimonials-data';

const stats = [
  { value: '100+', label: 'Clients satisfaits' },
  { value: '500+', label: 'Prestations réalisées' },
  { value: '4.9/5', label: 'Note moyenne' },
  { value: '98%', label: 'Taux de satisfaction' },
];

export default function TestimonialsSection() {
  return (
    <section id="temoignages" className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionLabel className="mb-4">Témoignages</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
            Ils nous font confiance
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Découvrez l'expérience de nos clients à Douala.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} />
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-12 border-t border-slate-200">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-primary mb-1">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
