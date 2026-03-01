import { services } from '@/content/services-data';
import ServiceCard from '@/components/ui/ServiceCard';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';
import { ArrowRight } from 'lucide-react';

export default function ServicesSection() {
  return (
    <section
      id="services"
      className="py-24 bg-slate-50"
      aria-label="Nos services de nettoyage"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14">
          <SectionLabel className="mb-4">Nos Services</SectionLabel>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-3">
                Des solutions adaptées<br />à chaque besoin
              </h2>
              <p className="text-slate-500 text-base max-w-lg">
                Que vous soyez particulier ou professionnel, nous avons la formule qui vous correspond.
              </p>
            </div>
            <Button
              href={getWhatsAppLink('Bonjour NexClean, je souhaite un devis personnalisé')}
              variant="secondary"
              size="md"
              icon={ArrowRight}
              iconPosition="right"
            >
              Devis personnalisé
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}
