import { Star } from 'lucide-react';
import Card from '@/components/ui/Card';
import { cx } from '@/components/ui/cx';
import { Testimonial } from '@/content/testimonials-data';

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  const initials = testimonial.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card padding="sm" className="h-full">
      <div className="mb-4 flex gap-0.5" role="img" aria-label={`Note : ${testimonial.rating} sur 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cx('h-4 w-4', i < testimonial.rating ? 'fill-sun text-sun' : 'fill-ink-200 text-ink-200')}
            strokeWidth={0}
            aria-hidden="true"
          />
        ))}
      </div>

      <blockquote className="mb-5 text-small italic text-ink-700">&ldquo;{testimonial.comment}&rdquo;</blockquote>

      <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
            {initials}
          </div>
          <div>
            <p className="text-small font-semibold text-ink-900">{testimonial.name}</p>
            <p className="text-xs text-muted">{testimonial.location}</p>
          </div>
        </div>
        <span className="max-w-[100px] text-right text-xs leading-tight text-muted">{testimonial.service}</span>
      </div>
    </Card>
  );
}
