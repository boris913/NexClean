'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ShoppingBag, Trees, Clock, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { PROMO, CITIES_LABEL, getWhatsAppLink } from '@/lib/constants';
import { products, formatPrice } from '@/content/products-data';

const EASE = [0.22, 1, 0.36, 1] as const;
const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: EASE, delay },
});

export default function HeroSection() {
  const product = products[0];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Décor animé */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-brand-200/70 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -left-40 w-[420px] h-[420px] rounded-full bg-brand-100 blur-3xl animate-blob [animation-delay:-6s]" />
        <div className="absolute bottom-0 right-1/3 w-[260px] h-[260px] rounded-full bg-ocean-100/70 blur-3xl animate-blob [animation-delay:-12s]" />
        <div className="absolute inset-0 bg-dots opacity-[0.25] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
        {/* Texte */}
        <div>
          {PROMO.active && (
            <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-200 shadow-sm pl-1.5 pr-4 py-1.5 mb-6">
              <span className="rounded-full bg-cta text-ink-900 text-xs font-bold px-2.5 py-0.5">{PROMO.discount}</span>
              <span className="text-sm font-medium text-ink-700">
                {PROMO.title} {PROMO.description}
              </span>
            </motion.div>
          )}

          <motion.h1 {...fadeUp(0.08)} className="font-display font-extrabold text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.1rem] text-ink-900 mb-6">
            Nettoyage professionnel <span className="highlight">&amp; entretien</span> au Cameroun
          </motion.h1>

          <motion.p {...fadeUp(0.16)} className="text-ink-600 text-lg sm:text-xl leading-relaxed max-w-xl mb-8">
            Maisons, bureaux, fins de chantier et espaces verts à {CITIES_LABEL}. Envoyez vos photos, recevez votre devis.
          </motion.p>

          <motion.div {...fadeUp(0.24)} className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button href={getWhatsAppLink()} variant="whatsapp" size="lg" className="animate-pulse-ring">
              <WhatsAppIcon className="w-5 h-5" />
              Devis gratuit sur WhatsApp
            </Button>
            <Button href="/services" variant="secondary" size="lg" icon={ArrowRight} iconPosition="right">
              Voir nos services
            </Button>
          </motion.div>

          <motion.ul {...fadeUp(0.32)} className="flex flex-wrap gap-x-6 gap-y-2 mb-8">
            {['Devis gratuit', 'Matériel & produits fournis', 'Particuliers & entreprises'].map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm font-medium text-ink-700">
                <span className="w-5 h-5 rounded-full bg-brand-400 flex items-center justify-center">
                  <Check className="w-3 h-3 text-ink-900" strokeWidth={3} />
                </span>
                {v}
              </li>
            ))}
          </motion.ul>

          <motion.div {...fadeUp(0.4)}>
            <Link
              href="/boutique"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
            >
              <ShoppingBag className="w-4 h-4" />
              Acheter nos produits d&apos;entretien
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>

        {/* Collage photos (format portrait 3:4 natif, aucun recadrage) */}
        <div className="relative mx-auto w-full max-w-[440px] lg:max-w-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 2 }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            className="relative ml-auto w-[78%] aspect-[3/4] rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-20px_rgba(19,26,18,0.45)] ring-8 ring-white"
          >
            <Image
              src="/images/team/equipe-nexclean.jpg"
              alt="L'équipe NEXCLEAN SARL à Douala"
              fill
              priority
              sizes="(max-width: 1024px) 80vw, 420px"
              className="object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30, rotate: 0 }}
            animate={{ opacity: 1, x: 0, rotate: -5 }}
            transition={{ duration: 1, ease: EASE, delay: 0.45 }}
            className="absolute left-0 bottom-[-6%] w-[42%] aspect-[3/4] rounded-[1.5rem] overflow-hidden shadow-xl ring-[6px] ring-white"
          >
            <Image
              src="/images/team/equipe-nexclean3.jpeg"
              alt="Agent NEXCLEAN en intervention"
              fill
              sizes="200px"
              className="object-cover"
            />
          </motion.div>

          {/* Cartes flottantes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
            className="absolute -left-2 sm:left-[-6%] top-[8%]"
          >
            <div className="animate-float flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur px-4 py-3 shadow-card-hover border border-brand-100">
              <span className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink-900">Devis en 1 minute</span>
                <span className="block text-xs text-ink-500">Photos sur WhatsApp</span>
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}
            className="absolute right-[-2%] sm:right-[-6%] top-[46%]"
          >
            <div className="animate-float-slow flex items-center gap-2.5 rounded-2xl bg-ink-900 text-white px-4 py-3 shadow-xl">
              <Trees className="w-5 h-5 text-brand-400" />
              <span className="text-sm font-semibold">Espaces verts</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 1 }}
            className="absolute right-[4%] bottom-[-8%]"
          >
            <Link
              href={`/boutique/${product.slug}`}
              className="animate-float flex items-center gap-3 rounded-2xl bg-cta px-4 py-3 shadow-btn-hover hover:bg-brand-300 transition-colors [animation-delay:-3s]"
            >
              <ShoppingBag className="w-5 h-5 text-ink-900" />
              <span>
                <span className="block text-xs font-medium text-ink-800">Savon NexClean 1 L</span>
                <span className="block text-sm font-extrabold text-ink-900">{formatPrice(product.formats[0].price)}</span>
              </span>
            </Link>
          </motion.div>

          <div className="absolute -bottom-12 left-[46%] hidden sm:flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <MapPin className="w-3.5 h-3.5 text-primary" /> {CITIES_LABEL}, Cameroun
          </div>
        </div>
      </div>
    </section>
  );
}
