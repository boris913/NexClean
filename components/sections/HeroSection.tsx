import { ArrowRight, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CONTACT, PROMO, getWhatsAppLink } from '@/lib/constants';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-slate-900">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/banner.png"
          alt="Intérieur moderne impeccable après intervention NexClean"
          fill
          className="object-cover opacity-30"
          priority
          unoptimized
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/40" />
      </div>

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
        <div className="max-w-2xl">
          {/* Promo badge */}
          {PROMO.active && (
            <div className="inline-flex items-center gap-2 bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {PROMO.title} : {PROMO.discount} {PROMO.description}
            </div>
          )}

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6 animate-slide-up">
            La propreté
            <br />
            <span className="text-primary-light" style={{ color: '#93C5FD' }}>professionnelle</span>
            <br />
            à Douala
          </h1>

          {/* Sub */}
          <p className="text-slate-300 text-lg sm:text-xl mb-8 leading-relaxed max-w-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Nettoyage sur-mesure pour particuliers et entreprises. Intervention sous 24h, résultat garanti.
          </p>

          {/* Value props */}
          <ul className="flex flex-col sm:flex-row gap-3 sm:gap-6 mb-10 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            {['Intervention sous 24h', 'Satisfaction garantie', 'Tarifs transparents'].map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2} />
                {v}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button
              href={getWhatsAppLink()}
              variant="whatsapp"
              size="lg"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Obtenir un devis gratuit
            </Button>

            <a
              href="#services"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors group"
            >
              Voir nos services
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
        <div className="w-px h-10 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  );
}
