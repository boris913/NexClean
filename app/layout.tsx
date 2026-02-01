import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/navigation/Header';
import Footer from '@/components/navigation/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'NexClean - Service de Nettoyage Professionnel à Douala',
  description: 'NexClean, la propreté nouvelle génération. Service de nettoyage professionnel pour maisons, bureaux et commerces à Douala. Rapide, propre, prix accessibles. Intervention sous 24h.',
  keywords: 'nettoyage Douala, service nettoyage Cameroun, nettoyage professionnel, nettoyage bureau Douala, nettoyage maison, désinfection, NexClean',
  authors: [{ name: 'NexClean' }],
  openGraph: {
    title: 'NexClean - La Propreté Nouvelle Génération à Douala',
    description: 'Service de nettoyage professionnel. Rapide • Propre • Prix Accessibles',
    url: 'https://nexclean.cm',
    siteName: 'NexClean',
    locale: 'fr_CM',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexClean - Service de Nettoyage à Douala',
    description: 'La propreté nouvelle génération. Intervention sous 24h.',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/images/nexclean-logo-1.png" />
        <meta name="theme-color" content="#0A5ED7" />
      </head>
      <body>
        <Header />
        <main className="pt-20">
          {children}
        </main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
