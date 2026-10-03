import type { Metadata, Viewport } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Header from '@/components/navigation/Header';
import Footer from '@/components/navigation/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import MobileCTABar from '@/components/ui/MobileCTABar';
import Analytics from '@/components/analytics/Analytics';
import JsonLd from '@/components/ui/JsonLd';
import { MotionProvider } from '@/components/ui/Reveal';
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
  WEBSITE_SCHEMA,
} from '@/lib/seo';

const fontBody = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const fontDisplay = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#84CC45',
};

export const metadata: Metadata = {
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  metadataBase: new URL(SITE_URL),
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
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
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
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }),
  applicationName: SITE_NAME,
  category: 'services',
  classification: 'Nettoyage professionnel',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fontBody.variable} ${fontDisplay.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="dns-prefetch" href="https://wa.me" />
        <link rel="dns-prefetch" href="https://api.whatsapp.com" />
      </head>
      <body className="font-sans antialiased">
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
      </body>
    </html>
  );
}
