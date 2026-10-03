import { services, type Service } from '@/content/services-data';
import ServiceCard from '@/components/ui/ServiceCard';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';

interface ServicesSectionProps {
  items?: Service[];
  title?: string;
  subtitle?: string;
  showAllLink?: boolean;
}

export default function ServicesSection({
  items = services,
  title = 'Des solutions adaptées à chaque besoin',
  subtitle = 'Nettoyage, espaces verts, fins de chantier, vitres et entretien régulier.',
  showAllLink = true,
}: ServicesSectionProps) {
  return (
    <section id="services" className="py-20 sm:py-24 bg-slate-50" aria-label="Nos services">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <SectionLabel className="mb-4">Nos Services</SectionLabel>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3 max-w-xl">{title}</h2>
              <p className="text-slate-500 text-base max-w-lg">{subtitle}</p>
            </div>
            {showAllLink && (
              <Button href="/services" variant="secondary" size="md" icon={ArrowRight} iconPosition="right">
                Tous nos services
              </Button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
