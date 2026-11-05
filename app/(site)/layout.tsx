import Header from '@/components/navigation/Header';
import Footer from '@/components/navigation/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import MobileCTABar from '@/components/ui/MobileCTABar';
import Analytics from '@/components/analytics/Analytics';
import JsonLd from '@/components/ui/JsonLd';
import { MotionProvider } from '@/components/ui/Reveal';
import { localBusinessSchema, servicesSchema, websiteSchema } from '@/lib/seo';
import { lireCouverture } from '@/lib/geo/couverture';

// Pages pré-générées, régénérées au plus toutes les 10 min pour suivre le référentiel géographique
// (M1-GEO-05) ; une modification dans le Back-Office les régénère immédiatement (revaliderCouverture).
export const revalidate = 600;

/** Habillage du site public (en-tête, pied de page, WhatsApp, analytics, données structurées). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const couverture = await lireCouverture();
  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="pt-20 overflow-x-clip outline-none">
        <MotionProvider>{children}</MotionProvider>
      </main>
      <Footer villes={couverture.libelle} />
      <WhatsAppButton />
      <MobileCTABar />
      <Analytics />
      <JsonLd data={localBusinessSchema(couverture)} />
      <JsonLd data={servicesSchema(couverture.villes)} />
      <JsonLd data={websiteSchema(couverture.libelle)} />
    </>
  );
}
