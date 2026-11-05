import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import { type Product, formatPrice, SHOP_INFO } from '@/content/products-data';

export default function ProductCard({ product }: { product: Product }) {
  const minPrice = product.formats[0]?.price ?? null;

  return (
    <Link
      href={`/boutique/${product.slug}`}
      className={cardClasses({ variant: 'interactive', className: 'h-full overflow-hidden !p-0' })}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-brand-50">
        <Image
          src={product.images[0].src}
          alt={product.images[0].alt}
          fill
          className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        {!product.available && (
          <span className="absolute left-3 top-3 rounded-full bg-ink-900/80 px-2.5 py-1 text-xs font-semibold text-white">
            Bientôt disponible
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="mb-1 text-h3 text-ink-900 transition-colors group-hover:text-primary">{product.name}</h2>
        <p className="mb-4 text-small text-muted">{product.tagline}</p>
        <div className="mt-auto flex items-end justify-between gap-3">
          <span>
            <span className="block font-display text-2xl font-extrabold text-ink-900">{formatPrice(minPrice)}</span>
            <span className="block text-xs text-muted">
              {product.formats.map((f) => f.label).join(' · ')} · {SHOP_INFO.priceNote}
            </span>
          </span>
          {/* Pastille dans un lien : un span, pas un second élément interactif. */}
          <span className={buttonClasses({ size: 'sm' })}>
            Acheter <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
