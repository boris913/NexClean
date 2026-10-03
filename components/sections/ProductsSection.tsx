import { ArrowRight, ShoppingBag } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import ProductCard from '@/components/ui/ProductCard';
import Reveal from '@/components/ui/Reveal';
import { products } from '@/content/products-data';

export default function ProductsSection() {
  return (
    <section id="produits" className="relative overflow-hidden py-20 sm:py-28 bg-brand-100">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-10 w-96 h-96 rounded-full bg-brand-300/60 blur-3xl animate-blob" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.4fr] gap-10 items-center">
        <Reveal from="left">
          <SectionLabel className="mb-4">Produits NexClean</SectionLabel>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-4">Nos produits d&apos;entretien, chez vous</h2>
          <p className="text-ink-700 text-lg mb-8">
            Les produits utilisés par nos équipes, disponibles à l&apos;achat. Commandez en quelques secondes sur WhatsApp,
            paiement à la livraison ou au retrait.
          </p>
          <Button href="/boutique" variant="primary" size="lg" icon={ShoppingBag}>
            Voir la boutique
          </Button>
        </Reveal>
        <Reveal from="right" className="grid sm:grid-cols-2 gap-5">
          {products.slice(0, 2).map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
          {products.length < 2 && (
            <div className="hidden sm:flex flex-col justify-center rounded-3xl border-2 border-dashed border-brand-300 bg-white/60 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700 mb-1">D&apos;autres produits arrivent</p>
              <p className="text-sm text-slate-500 mb-4">Entreprises et revendeurs : tarifs de gros sur demande.</p>
              <Button href="/boutique#professionnels" variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
                En savoir plus
              </Button>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
