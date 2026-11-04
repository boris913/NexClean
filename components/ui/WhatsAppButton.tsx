'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { getWhatsAppLink, getPageWhatsAppMessage } from '@/lib/constants';

/** Bouton flottant (desktop uniquement — sur mobile, voir MobileCTABar). */
export default function WhatsAppButton() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname() || '/';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <a
      href={getWhatsAppLink(getPageWhatsAppMessage(pathname))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter NexClean sur WhatsApp"
      className="
        hidden lg:flex
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full
        bg-whatsapp text-whatsapp-ink
        items-center justify-center
        shadow-whatsapp
        hover:bg-whatsapp-hover motion-safe:hover:scale-110
        transition-all duration-200 ease-out
        animate-fade-in animate-pulse-ring
      "
    >
      <WhatsAppIcon className="w-7 h-7" />
    </a>
  );
}
