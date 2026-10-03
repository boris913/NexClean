import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import JsonLd from '@/components/ui/JsonLd';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CTASection from '@/components/sections/CTASection';
import { servicePages, getServiceBySlug, services } from '@/content/services-data';
import { getWhatsAppLink, PAYMENT_TERMS } from '@/lib/constants';
import { pageMetadata, serviceSchema, breadcrumbSchema } from '@/lib/seo';

export function generateStaticParams() {
  return servicePages.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return {};
  return pageMetadata({ title: service.seo.title, description: service.seo.description, path: `/services/${slug}` });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  const quoteMessage = `Bonjour NexClean, je souhaite un devis pour : ${service.name}.`;
  const related = services.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <>
      <PageHero
        label="Service"
        title={service.seo.h1}
        subtitle={service.seo.intro}
        breadcrumb={[{ name: 'Services', href: '/services' }, { name: service.name }]}
      >
        <Button href={getWhatsAppLink(quoteMessage)} variant="whatsapp" size="lg">
          <WhatsAppIcon className="w-5 h-5" />
          Demander un devis
        </Button>
        <Button href="/contact" variant="secondary" size="lg">
          Formulaire de devis
        </Button>
      </PageHero>

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-100 p-6 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Ce qui est inclus</h2>
            <ul className="space-y-2.5">
              {service.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-100 p-6 shadow-card">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Pour qui ?</h2>
            <ul className="space-y-2.5">
              {service.idealFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-slate-900 text-white p-6">
            <h2 className="text-lg font-semibold mb-2">Tarif</h2>
            <p className="text-2xl font-bold mb-3">{service.priceRange}</p>
            <p className="text-sm text-slate-300 mb-4">
              Prix indicatif : le devis final dépend de la surface, de l&apos;état, de l&apos;accès et des moyens nécessaires.
            </p>
            <p className="text-xs text-slate-400">{PAYMENT_TERMS.ponctuel}</p>
          </div>
        </div>
      </section>

      <ProcessSection />
      <ServicesSection items={related} title="Autres services" subtitle="Découvrez nos autres prestations." />
      <CTASection whatsappMessage={quoteMessage} />
      <JsonLd data={serviceSchema(service)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Services', path: '/services' }, { name: service.name, path: `/services/${slug}` }])} />
    </>
  );
}
