import HeroSection from '@/components/sections/HeroSection';
import ServicesSection from '@/components/sections/ServicesSection';
import AudienceSection from '@/components/sections/AudienceSection';
import BeforeAfterSection from '@/components/sections/BeforeAfterSection';
import WhyUsSection from '@/components/sections/WhyUsSection';
import ProcessSection from '@/components/sections/ProcessSection';
import SubscriptionsSection from '@/components/sections/SubscriptionsSection';
import ProductsSection from '@/components/sections/ProductsSection';
import TestimonialsSection from '@/components/sections/TestimonialsSection';
import CoverageSection from '@/components/sections/CoverageSection';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import JsonLd from '@/components/ui/JsonLd';
import { SITE_URL, OG_IMAGE, DEFAULT_TITLE, DEFAULT_DESCRIPTION, FAQ_SCHEMA } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: DEFAULT_TITLE },
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE.url,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: OG_IMAGE.alt,
      },
    ],
  },
};

export default function Home() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <AudienceSection />
      <BeforeAfterSection />
      <WhyUsSection />
      <ProcessSection />
      <SubscriptionsSection />
      <ProductsSection />
      <TestimonialsSection />
      <CoverageSection />
      <FAQSection />
      <CTASection />
      <JsonLd data={FAQ_SCHEMA} />
    </>
  );
}
