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
      className="group flex h-full flex-col bg-white rounded-3xl p-7 border border-ink-100 shadow-card hover:shadow-card-hover hover:border-brand-200 hover:-translate-y-1.5 transition-all duration-300"
    >
      <div className="w-14 h-14 rounded-2xl bg-brand-100 group-hover:bg-cta flex items-center justify-center mb-6 transition-all duration-300 group-hover:rotate-6">
        <IconComponent className="w-6 h-6 text-brand-700 group-hover:text-ink-900 transition-colors" strokeWidth={1.75} />
      </div>

      <h3 className="font-display text-xl font-semibold text-ink-900 mb-2">
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
