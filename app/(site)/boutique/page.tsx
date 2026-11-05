import type { Metadata } from 'next';
import { Truck, Wallet, Building2 } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import ProductCard from '@/components/ui/ProductCard';
import Section from '@/components/ui/Section';
import { products, SHOP_INFO } from '@/content/products-data';
import { PAYMENT_TERMS, WHATSAPP_MESSAGES, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: "Boutique — Produits d'entretien",
  description:
    "Produits d'entretien NEXCLEAN : savon liquide multi-usage pour vaisselle, lessive et sols. Commande sur WhatsApp, livraison selon votre ville.",
  path: '/boutique',
});

export default function BoutiquePage() {
  return (
    <>
      <PageHero
        label="Boutique"
        pillar="boutique"
        title="Les produits NEXCLEAN"
        subtitle="Les produits d'entretien utilisés par nos équipes, disponibles pour votre maison ou votre entreprise. Commande simple sur WhatsApp."
        breadcrumb={[{ name: 'Boutique' }]}
      >
        <Button href={getWhatsAppLink(WHATSAPP_MESSAGES.boutique)} variant="whatsapp" size="lg" whatsappIcon>
          Commander sur WhatsApp
        </Button>
      </PageHero>

      <Section spacing="sm">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </Section>

      <Section tone="muted" spacing="sm">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <IconBadge icon={Wallet} tone="boutique" className="mb-4" />
            <h2 className="mb-2 text-h3 text-ink-900">Paiement</h2>
            <p className="text-small text-ink-600">{PAYMENT_TERMS.produits}</p>
          </Card>
          <Card>
            <IconBadge icon={Truck} tone="boutique" className="mb-4" />
            <h2 className="mb-2 text-h3 text-ink-900">Livraison & retrait</h2>
            <p className="text-small text-ink-600">{SHOP_INFO.delivery}</p>
          </Card>
          <div id="professionnels" className="scroll-mt-24">
            <Card className="h-full">
              <IconBadge icon={Building2} tone="boutique" className="mb-4" />
              <h2 className="mb-2 text-h3 text-ink-900">Professionnels & revendeurs</h2>
              <p className="mb-4 text-small text-ink-600">{SHOP_INFO.wholesale}</p>
              <Button
                href={getWhatsAppLink('Bonjour NexClean, je souhaite connaître vos tarifs de gros / revendeurs pour vos produits.')}
                variant="outline"
                size="sm"
                className="mt-auto"
              >
                Demander les tarifs revendeurs
              </Button>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
