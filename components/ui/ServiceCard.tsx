import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Service } from '@/content/services-data';

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const IconComponent = (LucideIcons as any)[service.icon] || LucideIcons.Sparkles;
  
  return (
    <div className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
      <div className="flex items-start gap-4">
        <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
          <IconComponent className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-dark mb-2">{service.name}</h3>
          <p className="text-accent font-semibold text-lg mb-3">{service.priceRange}</p>
        </div>
      </div>
      
      <p className="text-gray-600 mb-4 leading-relaxed">{service.description}</p>
      
      <div className="space-y-2">
        {service.includes.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
            <LucideIcons.Check className="w-4 h-4 text-secondary flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
