import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Check, AlertTriangle, Package, Truck, FileText } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import IconBadge from '@/components/ui/IconBadge';
import JsonLd from '@/components/ui/JsonLd';
import Section from '@/components/ui/Section';
import ProductOrder from './ProductOrder';
import { products, getProductBySlug, SHOP_INFO } from '@/content/products-data';
import { PAYMENT_TERMS } from '@/lib/constants';
import { pageMetadata, productSchema, breadcrumbSchema } from '@/lib/seo';

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return pageMetadata({
    title: product.name,
    description: `${product.tagline}. ${product.description}`.slice(0, 160),
    path: `/boutique/${slug}`,
    image: product.images[0].src,
  });
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="mb-3 text-h3 text-ink-900">{title}</h2>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-small text-ink-600">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <>
      <Section spacing="sm">
        <Breadcrumb items={[{ name: 'Accueil', href: '/' }, { name: 'Boutique', href: '/boutique' }, { name: product.name }]} />

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-3">
            <div className="relative mx-auto aspect-[3/4] max-h-[640px] overflow-hidden rounded-card bg-brand-50">
              <Image src={product.images[0].src} alt={product.images[0].alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(1).map((img) => (
                  <div key={img.src} className="relative aspect-square overflow-hidden rounded-2xl bg-ink-50">
                    <Image src={img.src} alt={img.alt} fill className="object-cover" sizes="25vw" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="mb-2 font-display text-h2 text-ink-900">{product.name}</h1>
            <p className="mb-4 text-muted">{product.tagline}</p>
            <p className="mb-6 text-ink-700">{product.description}</p>
            <dl className="mb-6 grid grid-cols-2 gap-3 text-small">
              <div className="rounded-2xl bg-ink-50 p-3">
                <dt className="text-muted">Format</dt>
                <dd className="font-semibold text-ink-900">{product.formats.map((f) => f.label).join(', ')}</dd>
              </div>
              {product.scent && (
                <div className="rounded-2xl bg-ink-50 p-3">
                  <dt className="text-muted">Parfum</dt>
                  <dd className="font-semibold text-ink-900">{product.scent}</dd>
                </div>
              )}
              <div className="rounded-2xl bg-ink-50 p-3">
                <dt className="text-muted">Disponibilité</dt>
                <dd className={`font-semibold ${product.available ? 'text-success' : 'text-muted'}`}>
                  {product.available ? 'Disponible' : 'Bientôt disponible'}
                </dd>
              </div>
            </dl>
            <ProductOrder product={product} />
            <div className="mt-6 space-y-2 text-small text-ink-600">
              <p className="flex gap-2">
                <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                {SHOP_INFO.delivery}
              </p>
              <p className="flex gap-2">
                <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                {PAYMENT_TERMS.produits}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="muted" spacing="sm">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <InfoList title="Usages" items={product.usages} />
          <InfoList title="Surfaces compatibles" items={product.surfaces} />
          <InfoList title="Mode d'emploi" items={product.instructions} />
          <InfoList title="Composition" items={product.ingredients} />
          <InfoList title="Conservation" items={[product.storage]} />
          <div className="rounded-card border border-warning-border bg-warning-soft p-6 md:col-span-2 lg:col-span-3">
            <h2 className="mb-3 flex items-center gap-3 text-h3 text-ink-900">
              <IconBadge icon={AlertTriangle} tone="warning" size="sm" className="bg-white" />
              Précautions
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-small text-ink-700">
              {product.precautions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {product.safetySheetUrl && (
              <a href={product.safetySheetUrl} className="mt-4 inline-flex min-h-tap items-center gap-2 text-small font-medium text-primary hover:underline">
                <FileText className="h-4 w-4" aria-hidden="true" /> Fiche de données de sécurité (PDF)
              </a>
            )}
          </div>
        </div>
      </Section>

      <JsonLd data={productSchema(product)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Boutique', path: '/boutique' }, { name: product.name, path: `/boutique/${slug}` }])} />
    </>
  );
}
