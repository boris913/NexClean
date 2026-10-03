import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { type Product, formatPrice } from '@/content/products-data';

export default function ProductCard({ product }: { product: Product }) {
  const minPrice = product.formats[0]?.price ?? null;

  return (
    <Link
      href={`/boutique/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-card hover:shadow-card-hover transition-all"
    >
      <div className="relative aspect-square bg-slate-50">
        <Image
          src={product.images[0].src}
          alt={product.images[0].alt}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        {!product.available && (
          <span className="absolute top-3 left-3 text-xs font-semibold bg-slate-900/80 text-white px-2.5 py-1 rounded-full">
            Bientôt disponible
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-primary transition-colors">{product.name}</h3>
        <p className="text-sm text-slate-500 mb-4">{product.tagline}</p>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">
            {product.formats.map((f) => f.label).join(' · ')} — {formatPrice(minPrice)}
          </span>
          <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
