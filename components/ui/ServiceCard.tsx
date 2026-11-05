import {
  Building2,
  CalendarCheck,
  Check,
  HardHat,
  Home,
  Minimize2,
  ShieldCheck,
  SprayCan,
  Trees,
  type LucideIcon,
} from 'lucide-react';
import PillarCard from '@/components/ui/PillarCard';
import { Service, getServiceHref } from '@/content/services-data';

/** `content/services-data.ts` nomme ses icônes par des chaînes : table explicite, pour garder des imports nommés. */
const ICONES: Record<string, LucideIcon> = {
  Building2,
  CalendarCheck,
  HardHat,
  Home,
  Minimize2,
  ShieldCheck,
  Trees,
};

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  return (
    <PillarCard
      pillar={service.href === '/espaces-verts' ? 'espaces-verts' : 'proprete'}
      icon={ICONES[service.icon] ?? SprayCan}
      title={service.name}
      description={service.description}
      href={getServiceHref(service)}
      ctaLabel="En savoir plus"
    >
      <ul className="space-y-2">
        {service.includes.map((item) => (
          <li key={item} className="flex items-start gap-2 text-small text-ink-600">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-ink-100 pt-4 text-xs font-medium text-muted">{service.priceRange}</p>
    </PillarCard>
  );
}
