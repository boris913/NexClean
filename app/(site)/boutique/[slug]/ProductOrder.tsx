'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import { type Product, formatPrice, SHOP_INFO } from '@/content/products-data';

/** Sélection format + quantité, puis commande structurée sur WhatsApp. */
export default function ProductOrder({ product }: { product: Product }) {
  const [formatIndex, setFormatIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const format = product.formats[formatIndex];
  const total = format.price !== null ? format.price * qty : null;

  const message = [
    'Bonjour NexClean, je souhaite commander :',
    '',
    `• Produit : ${product.name}`,
    `• Format : ${format.label}`,
    `• Quantité : ${qty}`,
    total !== null ? `• Total : ${formatPrice(total)} (hors livraison)` : '',
    '',
    'Quartier de livraison : ',
    'Nom : ',
  ]
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
    .join('\n');

  if (!product.available) {
    return (
      <p className="rounded-2xl bg-ink-100 p-4 text-small text-ink-600">
        Ce produit sera bientôt disponible. Contactez-nous sur WhatsApp pour être prévenu.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {product.formats.length > 1 && (
        <fieldset>
          <legend className="text-small font-medium text-ink-700 mb-2">Format</legend>
          <div className="flex flex-wrap gap-2">
            {product.formats.map((f, i) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFormatIndex(i)}
                aria-pressed={i === formatIndex}
                className={`min-h-tap rounded-2xl border px-4 py-2.5 text-small font-medium ${
                  i === formatIndex ? 'border-primary bg-primary-light text-primary' : 'border-ink-200 text-ink-700'
                }`}
              >
                {f.label} — {formatPrice(f.price)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <span className="text-small font-medium text-ink-700">Quantité</span>
        <div className="flex items-center rounded-full border border-ink-200 bg-white">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Diminuer la quantité"
            className="w-12 h-12 flex items-center justify-center text-ink-600 disabled:opacity-40"
            disabled={qty <= 1}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <button
            type="button"
            onClick={() => setQty(Math.min(99, qty + 1))}
            aria-label="Augmenter la quantité"
            className="w-12 h-12 flex items-center justify-center text-ink-600"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="font-display text-3xl font-extrabold text-ink-900">
          {total !== null ? formatPrice(total) : formatPrice(null)}
        </div>
        <p className="text-small text-muted">
          {qty > 1 && format.price !== null ? `${qty} × ${formatPrice(format.price)} · ` : ''}
          {SHOP_INFO.priceNote}
        </p>
      </div>

      <Button
        href={getWhatsAppLink(message)}
        onClick={() => trackEvent('product_order_click', { product: product.slug, quantity: qty, format: format.label })}
        variant="whatsapp"
        size="lg"
        whatsappIcon
        fullWidth
      >
        Commander sur WhatsApp
      </Button>
      <p className="text-center text-xs text-muted">
        Votre commande est confirmée sur WhatsApp (disponibilité, livraison, paiement).
      </p>
    </div>
  );
}
