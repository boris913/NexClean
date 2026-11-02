import type { Metadata } from 'next';
import { Truck, Wallet, Building2 } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import ProductCard from '@/components/ui/ProductCard';
import { products, SHOP_INFO } from '@/content/products-data';
import { PAYMENT_TERMS, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Boutique — Produits de nettoyage',
  description: 'Achetez les produits d\'entretien NexClean : savon liquide multi-usage pour vaisselle, lessive et sols. Commande sur WhatsApp, livraison à Douala.',
  path: '/boutique',
});

export default function BoutiquePage() {
  return (
    <>
      <PageHero
        label="Boutique"
        title="Les produits NexClean"
        subtitle="Les produits d'entretien utilisés par nos équipes, disponibles pour votre maison ou votre entreprise. Commande simple sur WhatsApp."
        breadcrumb={[{ name: 'Boutique' }]}
      />

      <section className="py-14 sm:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-card">
            <Wallet className="w-6 h-6 text-primary mb-3" />
            <h2 className="font-semibold text-slate-900 mb-2">Paiement</h2>
            <p className="text-sm text-slate-600">{PAYMENT_TERMS.produits}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-card">
            <Truck className="w-6 h-6 text-primary mb-3" />
            <h2 className="font-semibold text-slate-900 mb-2">Livraison & retrait</h2>
            <p className="text-sm text-slate-600">{SHOP_INFO.delivery}</p>
          </div>
          <div id="professionnels" className="rounded-2xl bg-white border border-slate-100 p-6 shadow-card scroll-mt-24">
            <Building2 className="w-6 h-6 text-primary mb-3" />
            <h2 className="font-semibold text-slate-900 mb-2">Professionnels & revendeurs</h2>
            <p className="text-sm text-slate-600 mb-4">{SHOP_INFO.wholesale}</p>
            <Button
              href={getWhatsAppLink('Bonjour NexClean, je souhaite connaître vos tarifs de gros / revendeurs pour vos produits.')}
              variant="secondary"
              size="sm"
            >
              Demander les tarifs pro
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
