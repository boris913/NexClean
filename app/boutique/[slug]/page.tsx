import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Check, AlertTriangle, Package, Truck, FileText } from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import JsonLd from '@/components/ui/JsonLd';
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

function InfoList({ title, items, icon: Icon = Check }: { title: string; items: string[]; icon?: typeof Check }) {
  return (
    <div>
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
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
      <section className="py-8 sm:py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ name: 'Accueil', href: '/' }, { name: 'Boutique', href: '/boutique' }, { name: product.name }]} />

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-3">
              <div className="relative aspect-[3/4] max-h-[640px] mx-auto rounded-3xl overflow-hidden bg-brand-50">
                <Image src={product.images[0].src} alt={product.images[0].alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {product.images.slice(1).map((img) => (
                    <div key={img.src} className="relative aspect-square rounded-xl overflow-hidden bg-slate-50">
                      <Image src={img.src} alt={img.alt} fill className="object-cover" sizes="25vw" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h1 className="font-display font-bold text-3xl sm:text-5xl text-ink-900 mb-2">{product.name}</h1>
              <p className="text-slate-500 mb-4">{product.tagline}</p>
              <p className="text-slate-700 mb-6 leading-relaxed">{product.description}</p>
              <dl className="grid grid-cols-2 gap-3 mb-6 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-500">Format</dt>
                  <dd className="font-semibold text-slate-900">{product.formats.map((f) => f.label).join(', ')}</dd>
                </div>
                {product.scent && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500">Parfum</dt>
                    <dd className="font-semibold text-slate-900">{product.scent}</dd>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-500">Disponibilité</dt>
                  <dd className={`font-semibold ${product.available ? 'text-success' : 'text-slate-500'}`}>
                    {product.available ? 'Disponible' : 'Bientôt disponible'}
                  </dd>
                </div>
              </dl>
              <ProductOrder product={product} />
              <div className="mt-6 space-y-2 text-sm text-slate-600">
                <p className="flex gap-2"><Truck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />{SHOP_INFO.delivery}</p>
                <p className="flex gap-2"><Package className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />{PAYMENT_TERMS.produits}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <InfoList title="Usages" items={product.usages} />
          <InfoList title="Surfaces compatibles" items={product.surfaces} />
          <InfoList title="Mode d'emploi" items={product.instructions} />
          <InfoList title="Composition" items={product.ingredients} />
          <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Précautions d&apos;emploi & stockage
            </h2>
            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
              {product.precautions.map((p) => (
                <li key={p}>{p}</li>
              ))}
              <li>{product.storage}</li>
            </ul>
            {product.safetySheetUrl && (
              <a href={product.safetySheetUrl} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <FileText className="w-4 h-4" /> Fiche de données de sécurité (PDF)
              </a>
            )}
          </div>
        </div>
      </section>

      <JsonLd data={productSchema(product)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Boutique', path: '/boutique' }, { name: product.name, path: `/boutique/${slug}` }])} />
    </>
  );
}
