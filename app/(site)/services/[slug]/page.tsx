import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import type { NomIllustration } from '@/components/illustrations/Illustrations';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import JsonLd from '@/components/ui/JsonLd';
import Section from '@/components/ui/Section';
import { PILLARS } from '@/components/ui/pillars';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CTASection from '@/components/sections/CTASection';
import { servicePages, getServiceBySlug, services } from '@/content/services-data';
import { getWhatsAppLink, PAYMENT_TERMS } from '@/lib/constants';
import { pageMetadata, serviceSchema, breadcrumbSchema } from '@/lib/seo';

/** Illustration d'en-tête par prestation (audit design M5) ; propreté générique par défaut. */
const ILLUSTRATIONS: Record<string, NomIllustration> = {
  'nettoyage-maison-douala': 'maison',
  'nettoyage-bureaux-douala': 'immeuble',
  'entretien-espaces-verts-douala': 'jardin',
};

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
        illustration={ILLUSTRATIONS[service.slug] ?? 'proprete'}
        label={PILLARS.proprete.label}
        pillar="proprete"
        title={service.seo.h1}
        subtitle={service.seo.intro}
        breadcrumb={[{ name: 'Propreté', href: '/services' }, { name: service.name }]}
      >
        <Button href={getWhatsAppLink(quoteMessage)} size="lg" whatsappIcon>
          Demander un devis pour cette prestation
        </Button>
        <Button href="/tarifs" variant="outline" size="lg">
          Voir les tarifs
        </Button>
      </PageHero>

      <Section>
        <div className="grid gap-6 md:grid-cols-3 md:items-start">
          <Card>
            <h2 className="mb-4 font-display text-h3 text-ink-900">Ce qui est inclus</h2>
            <ul className="space-y-2.5">
              {service.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-small text-ink-600">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-4 font-display text-h3 text-ink-900">Pour qui ?</h2>
            <ul className="space-y-2.5">
              {service.idealFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-small text-ink-600">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <div className="surface-dark rounded-card bg-navy p-6 text-white sm:p-7">
            <h2 className="mb-2 font-mono text-eyebrow uppercase text-brand-300">Tarif indicatif</h2>
            <p className="mb-3 font-mono text-h3 tabular-nums">{service.priceRange}</p>
            <p className="mb-4 text-small text-brand-100">
              Prix indicatif : le devis final dépend de la surface, de l&apos;état, de l&apos;accès et des moyens nécessaires.
            </p>
            <p className="text-xs text-brand-100">{PAYMENT_TERMS.ponctuel}</p>
          </div>
        </div>
      </Section>

      <ProcessSection whatsappMessage={quoteMessage} />
      <ServicesSection items={related} title="Autres prestations" subtitle="Découvrez nos autres prestations." showAllLink={false} />
      <CTASection
        title="Un espace à remettre au propre ?"
        subtitle="Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis."
        formHref="/contact#contact"
        formLabel="Demander un devis"
        whatsappMessage={quoteMessage}
      />
      <JsonLd data={serviceSchema(service, (await lireCouverture()).villes)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Propreté', path: '/services' }, { name: service.name, path: `/services/${slug}` }])} />
    </>
  );
}
