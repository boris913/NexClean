import { services, type Service } from '@/content/services-data';
import ServiceCard from '@/components/ui/ServiceCard';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import Reveal, { Stagger, StaggerItem } from '@/components/ui/Reveal';

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
    <section id="services" className="py-20 sm:py-28 bg-ink-50" aria-label="Nos services">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-12">
          <SectionLabel className="mb-4">Nos Services</SectionLabel>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-4 max-w-2xl">{title}</h2>
              <p className="text-slate-500 text-base max-w-lg">{subtitle}</p>
            </div>
            {showAllLink && (
              <Button href="/services" variant="secondary" size="md" icon={ArrowRight} iconPosition="right">
                Tous nos services
              </Button>
            )}
          </div>
        </Reveal>

        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((service) => (
            <StaggerItem key={service.slug}>
              <ServiceCard service={service} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
