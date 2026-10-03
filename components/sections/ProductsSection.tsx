import { ArrowRight, ShoppingBag } from 'lucide-react';
import SectionLabel from '@/components/ui/SectionLabel';
import Button from '@/components/ui/Button';
import ProductCard from '@/components/ui/ProductCard';
import { products } from '@/content/products-data';

export default function ProductsSection() {
  return (
    <section id="produits" className="py-20 sm:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr_1.4fr] gap-10 items-center">
        <div>
          <SectionLabel className="mb-4">Produits NexClean</SectionLabel>
          <h2 className="font-display text-3xl sm:text-4xl text-slate-900 mb-4">Nos produits d&apos;entretien, chez vous</h2>
          <p className="text-slate-500 mb-8">
            Les produits utilisés par nos équipes, disponibles à l&apos;achat. Commandez en quelques secondes sur WhatsApp,
            paiement à la livraison ou au retrait.
          </p>
          <Button href="/boutique" variant="primary" size="lg" icon={ShoppingBag}>
            Voir la boutique
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {products.slice(0, 2).map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
          {products.length < 2 && (
            <div className="hidden sm:flex flex-col justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700 mb-1">D&apos;autres produits arrivent</p>
              <p className="text-sm text-slate-500 mb-4">Entreprises et revendeurs : tarifs de gros sur demande.</p>
              <Button href="/boutique#professionnels" variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
                En savoir plus
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
