'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
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
      <p className="rounded-xl bg-slate-100 text-slate-600 text-sm p-4">
        Ce produit sera bientôt disponible. Contactez-nous sur WhatsApp pour être prévenu.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {product.formats.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-2">Format</legend>
          <div className="flex flex-wrap gap-2">
            {product.formats.map((f, i) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFormatIndex(i)}
                aria-pressed={i === formatIndex}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium ${
                  i === formatIndex ? 'border-primary bg-primary-light text-primary' : 'border-slate-200 text-slate-700'
                }`}
              >
                {f.label} — {formatPrice(f.price)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">Quantité</span>
        <div className="flex items-center rounded-full border border-ink-200 bg-white">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Diminuer la quantité"
            className="w-12 h-12 flex items-center justify-center text-slate-600 disabled:opacity-40"
            disabled={qty <= 1}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <button
            type="button"
            onClick={() => setQty(Math.min(99, qty + 1))}
            aria-label="Augmenter la quantité"
            className="w-12 h-12 flex items-center justify-center text-slate-600"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="font-display text-3xl font-extrabold text-ink-900">
          {total !== null ? formatPrice(total) : formatPrice(null)}
        </div>
        <p className="text-sm text-ink-500">
          {qty > 1 && format.price !== null ? `${qty} × ${formatPrice(format.price)} · ` : ''}
          {SHOP_INFO.priceNote}
        </p>
      </div>

      <a
        href={getWhatsAppLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('product_order_click', { product: product.slug, quantity: qty, format: format.label })}
        className="flex items-center justify-center gap-2 w-full h-14 rounded-full bg-[#25D366] hover:bg-[#1FBE5B] text-white font-semibold shadow-btn hover:shadow-[0_10px_24px_-6px_rgba(37,211,102,0.6)] hover:-translate-y-0.5 transition-all"
      >
        <WhatsAppIcon className="w-5 h-5" />
        Commander sur WhatsApp
      </a>
      <p className="text-xs text-slate-500 text-center">
        Votre commande est confirmée sur WhatsApp (disponibilité, livraison, paiement).
      </p>
    </div>
  );
}
