import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Service, getServiceHref } from '@/content/services-data';

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const Icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = Icons[service.icon] || LucideIcons.Sparkles;

  return (
    <Link
      href={getServiceHref(service)}
      className="group flex flex-col bg-white rounded-2xl p-6 border border-slate-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
    >
      <div className="w-11 h-11 rounded-xl bg-primary-light flex items-center justify-center mb-5">
        <IconComponent className="w-5 h-5 text-primary" strokeWidth={1.75} />
      </div>

      <h3 className="text-base font-semibold text-slate-900 mb-2 group-hover:text-primary transition-colors">
        {service.name}
      </h3>

      <p className="text-sm text-slate-500 mb-5 leading-relaxed">{service.description}</p>

      <ul className="space-y-2 mb-6">
        {service.includes.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
            <LucideIcons.Check className="w-3.5 h-3.5 text-success flex-shrink-0" strokeWidth={2.5} />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400 font-medium">{service.priceRange}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary whitespace-nowrap">
          En savoir plus
          <LucideIcons.ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}
