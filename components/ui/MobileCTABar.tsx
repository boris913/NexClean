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
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5">
        <a
          href={getWhatsAppLink(getPageWhatsAppMessage(pathname))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#25D366] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <WhatsAppIcon className="w-5 h-5" />
          WhatsApp / Devis
        </a>
        <Link
          href="/contact"
          aria-label="Formulaire de demande de devis"
          className="flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl bg-primary text-white text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          <FileText className="w-4 h-4" />
          Devis
        </Link>
        <a
          href={TEL_LINK}
          aria-label="Appeler NexClean"
          className="flex items-center justify-center h-12 w-12 rounded-xl border border-slate-200 text-slate-700 active:scale-[0.98] transition-transform"
        >
          <Phone className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}
