import { Star } from 'lucide-react';
import { Testimonial } from '@/content/testimonials-data';

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  // Generate initials avatar
  const initials = testimonial.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-card hover:shadow-card-hover transition-all duration-300">
      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < testimonial.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
            strokeWidth={0}
          />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-sm text-slate-700 italic leading-relaxed mb-5">
        &ldquo;{testimonial.comment}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary text-xs font-bold">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
            <p className="text-xs text-slate-400">{testimonial.location}</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 text-right leading-tight max-w-[100px]">
          {testimonial.service}
        </span>
      </div>
    </div>
  );
}
