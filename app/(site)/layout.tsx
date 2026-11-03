import Header from '@/components/navigation/Header';
import Footer from '@/components/navigation/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import MobileCTABar from '@/components/ui/MobileCTABar';
import Analytics from '@/components/analytics/Analytics';
import JsonLd from '@/components/ui/JsonLd';
import { MotionProvider } from '@/components/ui/Reveal';
import { LOCAL_BUSINESS_SCHEMA, SERVICES_SCHEMA, WEBSITE_SCHEMA } from '@/lib/seo';

/** Habillage du site public (en-tête, pied de page, WhatsApp, analytics, données structurées). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow"
      >
        Aller au contenu
      </a>
      <Header />
      <main id="main-content" className="pt-20 overflow-x-clip">
        <MotionProvider>{children}</MotionProvider>
      </main>
      <Footer />
      <WhatsAppButton />
      <MobileCTABar />
      <Analytics />
      <JsonLd data={LOCAL_BUSINESS_SCHEMA} />
      <JsonLd data={SERVICES_SCHEMA} />
      <JsonLd data={WEBSITE_SCHEMA} />
    </>
  );
}
