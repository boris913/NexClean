import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { lireCouverture } from '@/lib/geo/couverture';
import {
  titreParDefaut,
  descriptionParDefaut,
  DEFAULT_KEYWORDS,
  TITLE_TEMPLATE,
  SITE_URL,
  SITE_NAME,
  OG_IMAGE,
} from '@/lib/seo';

// Polices intégrées au dépôt (sous-ensemble latin, licence OFL 1.1 dans app/fonts/) : le build ne
// dépend pas de Google Fonts. Une seule famille (IBM Plex Sans, variable) pour les titres et le texte,
// et sa déclinaison mono pour les chiffres, montants et numéros de dossier.
const fontSans = localFont({
  src: './fonts/ibm-plex-sans-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 700',
  display: 'swap',
});

const fontMono = localFont({
  src: './fonts/ibm-plex-mono-latin-500-normal.woff2',
  variable: '--font-mono',
  weight: '500',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1626',
};

export async function generateMetadata(): Promise<Metadata> {
  const { libelle } = await lireCouverture();
  const DEFAULT_TITLE = titreParDefaut(libelle);
  const DEFAULT_DESCRIPTION = descriptionParDefaut(libelle);
  return {
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
    classification: 'Services aux entreprises et aux particuliers : propreté et hygiène, recrutement et placement de personnel, espaces verts',
    referrer: 'origin-when-cross-origin',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fontSans.variable} ${fontMono.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="dns-prefetch" href="https://wa.me" />
        <link rel="dns-prefetch" href="https://api.whatsapp.com" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
