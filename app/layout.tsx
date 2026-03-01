import type { Metadata, Viewport } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import Header from '@/components/navigation/Header';
import Footer from '@/components/navigation/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import {
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  TITLE_TEMPLATE,
  SITE_URL,
  SITE_NAME,
  OG_IMAGE,
  LOCAL_BUSINESS_SCHEMA,
  SERVICES_SCHEMA,
  FAQ_SCHEMA,
  WEBSITE_SCHEMA,
} from '@/lib/seo';

// ─── Fonts ───────────────────────────────────────────────────
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  preload: true,
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-dm-serif',
  weight: ['400'],
  display: 'swap',
  preload: true,
});

// ─── Viewport (séparé de Metadata comme recommandé Next.js 14+) ─
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A5ED7',
};

// ─── Metadata principale ─────────────────────────────────────
export const metadata: Metadata = {
  // Title avec template pour les futures sous-pages
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: 'NexClean', url: SITE_URL }],
  creator: 'NexClean',
  publisher: 'NexClean',

  // Canonical URL
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
    languages: {
      'fr-CM': '/',
      'fr': '/',
    },
  },

  // ─── Open Graph ────────────────────────────────────────────
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'fr_CM',
    type: 'website',
    images: [
      {
        url: OG_IMAGE.url,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: OG_IMAGE.alt,
        type: 'image/png',
      },
    ],
  },

  // ─── Twitter / X Card ──────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },

  // ─── Robots ────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ─── Verification Search Consoles ─────────────────────────
  // Remplacez les valeurs par vos vrais codes de vérification
  verification: {
    google: 'REMPLACER_PAR_VOTRE_CODE_GOOGLE_SEARCH_CONSOLE',
    // yandex: 'VOTRE_CODE_YANDEX',
    // bing: 'VOTRE_CODE_BING',
  },

  // ─── App / PWA Metadata ────────────────────────────────────
  applicationName: SITE_NAME,
  category: 'services',
  classification: 'Nettoyage professionnel',

  // ─── Divers ────────────────────────────────────────────────
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

// ─── Layout ──────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${dmSerifDisplay.variable}`}>
      <head>
        {/* Favicon set complet */}
        <link rel="icon" href="/images/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Preconnect pour performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS-prefetch WhatsApp */}
        <link rel="dns-prefetch" href="https://wa.me" />
        <link rel="dns-prefetch" href="https://api.whatsapp.com" />
      </head>
      <body>
        <Header />
        <main id="main-content" className="pt-20">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />

        {/* ─── JSON-LD Structured Data ─────────────────────── */}
        {/* LocalBusiness — principal, indexé par Google pour Knowledge Panel */}
        <Script
          id="schema-local-business"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_SCHEMA) }}
        />

        {/* Services — apparaît dans les rich results Google */}
        <Script
          id="schema-services"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICES_SCHEMA) }}
        />

        {/* FAQ — permet l'affichage de la FAQ directement dans les résultats Google */}
        <Script
          id="schema-faq"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
        />

        {/* WebSite — pour le Search Sitelinks */}
        <Script
          id="schema-website"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
        />
      </body>
    </html>
  );
}
