'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import { BRAND, TEL_LINK, getPageWhatsAppMessage, getWhatsAppLink } from '@/lib/constants';
import { CTA_DEMANDE } from '@/components/navigation/nav-data';

/** Sur ces espaces, un devis n'a pas de sens : le CTA principal devient « Nous écrire » (docs/contenu.md §2). */
const ESPACES_SANS_DEMANDE = ['/candidat', '/suivi', '/profil'];

/** Barre d'action toujours visible sous lg : WhatsApp · Faire une demande (ou Nous écrire) · Appeler. */
export default function MobileCTABar() {
  const pathname = usePathname() || '/';
  const whatsapp = getWhatsAppLink(getPageWhatsAppMessage(pathname));
  const sansDemande = ESPACES_SANS_DEMANDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-ink-200 bg-white/95 backdrop-blur-md shadow-card pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-3 py-2.5">
        <Button href={whatsapp} variant="whatsapp" size="sm" whatsappIcon className="!px-3">
          WhatsApp
        </Button>
        {sansDemande ? (
          <Button href={whatsapp} size="sm" icon={MessageCircle} className="!px-2 whitespace-nowrap">
            Nous écrire
          </Button>
        ) : (
          <Button href={CTA_DEMANDE.href} size="sm" className="!px-2 whitespace-nowrap">
            {CTA_DEMANDE.label}
          </Button>
        )}
        <Button href={TEL_LINK} variant="outline" size="sm" icon={Phone} aria-label={`Appeler ${BRAND.name}`} className="w-11 !px-0">
          {null}
        </Button>
      </div>
    </div>
  );
}
