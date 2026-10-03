'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { GA_ID, trackEvent } from '@/lib/analytics';

/**
 * Charge GA4 (si configuré) et suit automatiquement tous les clics
 * vers WhatsApp, téléphone et e-mail sur l'ensemble du site.
 */
export default function Analytics() {
  useEffect(() => {
    if (!GA_ID) return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const label = link.textContent?.trim().slice(0, 80) || '';
      if (href.startsWith('https://wa.me')) trackEvent('whatsapp_click', { label });
      else if (href.startsWith('tel:')) trackEvent('phone_click', { label });
      else if (href.startsWith('mailto:')) trackEvent('email_click', { label });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  if (!GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
