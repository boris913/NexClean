'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Phone, FileText } from 'lucide-react';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { TEL_LINK, getWhatsAppLink, getPageWhatsAppMessage } from '@/lib/constants';

/** Barre d'action toujours visible sur mobile : WhatsApp / Devis / Appel. */
export default function MobileCTABar() {
  const pathname = usePathname() || '/';

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-ink-200 shadow-[0_-8px_24px_-12px_rgba(19,26,18,0.2)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5">
        <a
          href={getWhatsAppLink(getPageWhatsAppMessage(pathname))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 rounded-full bg-[#25D366] text-white text-sm font-bold active:scale-[0.97] transition-transform"
        >
          <WhatsAppIcon className="w-5 h-5" />
          WhatsApp / Devis
        </a>
        <Link
          href="/contact"
          aria-label="Formulaire de demande de devis"
          className="flex items-center justify-center gap-1.5 h-12 px-4 rounded-full bg-cta text-ink-900 text-sm font-bold active:scale-[0.97] transition-transform"
        >
          <FileText className="w-4 h-4" />
          Devis
        </Link>
        <a
          href={TEL_LINK}
          aria-label="Appeler NEXCLEAN SARL"
          className="flex items-center justify-center h-12 w-12 rounded-full border border-ink-200 text-ink-800 active:scale-[0.97] transition-transform"
        >
          <Phone className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}
