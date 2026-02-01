import React from 'react';
import { Star, MapPin } from 'lucide-react';
import { Testimonial } from '@/content/testimonials-data';

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
      <div className="flex items-center gap-1 mb-3">
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} className="w-5 h-5 fill-accent text-accent" />
        ))}
      </div>
      
      <p className="text-gray-700 mb-4 leading-relaxed italic">"{testimonial.comment}"</p>
      
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-dark">{testimonial.name}</p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{testimonial.location}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{testimonial.service}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
