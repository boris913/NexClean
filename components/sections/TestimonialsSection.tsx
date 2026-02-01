import React from 'react';
import { Quote } from 'lucide-react';
import TestimonialCard from '@/components/ui/TestimonialCard';
import { testimonials } from '@/content/testimonials-data';

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-light">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full mb-4">
            <Quote className="w-5 h-5" />
            <span className="font-semibold">Témoignages</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-dark mb-4">
            Ils Nous Font Confiance
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Découvrez ce que nos clients disent de nos services
          </p>
        </div>
        
        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
        
        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '100+', label: 'Clients Satisfaits' },
            { value: '500+', label: 'Prestations Réalisées' },
            { value: '4.9/5', label: 'Note Moyenne' },
            { value: '98%', label: 'Taux de Satisfaction' },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-gray-600 font-semibold">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
