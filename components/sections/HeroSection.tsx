import { ArrowRight, CheckCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { PROMO, CITIES_LABEL, getWhatsAppLink } from '@/lib/constants';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        <Image
          src="/images/team/equipe-nexclean.jpg"
          alt="Équipe NexClean"
          fill
          className="object-cover opacity-30"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-slate-900/40" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 w-full">
        <div className="max-w-2xl">
          {PROMO.active && (
            <div className="inline-flex items-center gap-2 bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {PROMO.title} : {PROMO.discount} {PROMO.description}
            </div>
          )}

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6 animate-slide-up">
            Nettoyage professionnel
            <br />
            <span style={{ color: '#93C5FD' }}>& entretien</span> au Cameroun
          </h1>

          <p className="text-slate-300 text-lg sm:text-xl mb-8 leading-relaxed max-w-xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Maisons, bureaux, fins de chantier et espaces verts à {CITIES_LABEL}. Devis gratuit sur WhatsApp en moins d&apos;une minute.
          </p>

          <ul className="flex flex-col sm:flex-row gap-3 sm:gap-6 mb-10 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            {['Devis gratuit', 'Matériel et produits fournis', 'Particuliers & entreprises'].map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2} />
                {v}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Button href={getWhatsAppLink()} variant="whatsapp" size="lg">
              <WhatsAppIcon className="w-5 h-5" />
              Demander un devis
            </Button>
            <Button href="/services" variant="secondary" size="lg" icon={ArrowRight} iconPosition="right">
              Voir nos services
            </Button>
          </div>

          <Link
            href="/boutique"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Acheter nos produits d&apos;entretien
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
