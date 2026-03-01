import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Service } from '@/content/services-data';
import { getWhatsAppLink } from '@/lib/constants';
import Button from './Button';

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  // On convertit l'objet LucideIcons (qui contient aussi des utilitaires) en un Record
  // de noms d'icônes vers des composants LucideIcon.
  const Icons = LucideIcons as any as Record<string, LucideIcon>;

  // On récupère l'icône demandée, avec Sparkles comme fallback si le nom n'existe pas.
  const IconComponent = Icons[service.icon] || LucideIcons.Sparkles;

  return (
    <div className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl bg-primary-light flex items-center justify-center mb-5">
        <IconComponent className="w-5 h-5 text-primary" strokeWidth={1.75} />
      </div>

      {/* Title & Price */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-slate-900">{service.name}</h3>
      </div>

      <p className="text-sm text-slate-500 mb-5 leading-relaxed">{service.description}</p>

      {/* Includes */}
      <ul className="space-y-2 mb-6">
        {service.includes.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
            <LucideIcons.Check className="w-3.5 h-3.5 text-success flex-shrink-0" strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>

      {/* Price + CTA */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">{service.priceRange}</span>
        <Button
          href={getWhatsAppLink(`Je souhaite un devis pour ${service.name}`)}
          variant="ghost"
          size="sm"
          icon={LucideIcons.ArrowRight}
          iconPosition="right"
        >
          Devis
        </Button>
      </div>
    </div>
  );
}
