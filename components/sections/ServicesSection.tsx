import { ArrowRight } from 'lucide-react';
import { services, type Service } from '@/content/services-data';
import ServiceCard from '@/components/ui/ServiceCard';
import Button from '@/components/ui/Button';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { PILLARS } from '@/components/ui/pillars';

interface ServicesSectionProps {
  items?: Service[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  showAllLink?: boolean;
}

export default function ServicesSection({
  items = services,
  eyebrow = PILLARS.proprete.label,
  title = 'Des solutions adaptées à chaque besoin',
  subtitle = 'Nettoyage, espaces verts, fins de chantier, vitres et entretien régulier.',
  showAllLink = true,
}: ServicesSectionProps) {
  return (
    <Section id="services" tone="muted" labelledBy="services-titre" className="scroll-mt-20">
      <SectionHeader
        id="services-titre"
        pillar="proprete"
        eyebrow={eyebrow}
        title={title}
        intro={subtitle}
        actions={
          showAllLink && (
            <Button href="/services" variant="outline" icon={ArrowRight} iconPosition="right">
              Toutes nos prestations
            </Button>
          )
        }
      />
      <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((service) => (
          <StaggerItem key={service.slug}>
            <ServiceCard service={service} />
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
