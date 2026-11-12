import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileText, MapPin, Phone } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import JsonLd from '@/components/ui/JsonLd';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import ServicesSection from '@/components/sections/ServicesSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CTASection from '@/components/sections/CTASection';
import { lireCouverture } from '@/lib/geo/couverture';
import { cheminVille, slugVille, villeDepuisSlug } from '@/lib/geo/slug';
import { CONTACT, TEL_LINK, getWhatsAppLink } from '@/lib/constants';
import { breadcrumbSchema, pageMetadata, villeServicesSchema } from '@/lib/seo';

// Page par ville couverte (specs/COM1-01 RG-11). Les villes viennent du référentiel (ADR 0021) :
// pré-générées au build, une ville ajoutée ensuite est rendue à la première visite (dynamicParams),
// une ville qui n'est plus couverte renvoie 404.
export const dynamicParams = true;

export async function generateStaticParams() {
  const { villes } = await lireCouverture();
  return villes.map((v) => ({ ville: slugVille(v) }));
}

async function lireVille(slug: string) {
  const couverture = await lireCouverture();
  const ville = villeDepuisSlug(couverture.villes, slug);
  if (!ville) return null;
  const quartiers = couverture.quartiers.find((g) => g.ville === ville)?.noms ?? [];
  return { ville, quartiers };
}

export async function generateMetadata({ params }: { params: Promise<{ ville: string }> }): Promise<Metadata> {
  const v = await lireVille((await params).ville);
  if (!v) return {};
  return pageMetadata({
    title: `Nettoyage et entretien à ${v.ville}`,
    description: `Nettoyage de maisons et de bureaux, espaces verts, fins de chantier et mise à disposition de personnel à ${v.ville}. Devis gratuit sur WhatsApp ou au ${CONTACT.phoneDisplay}.`,
    path: cheminVille(v.ville),
  });
}

export default async function PageVille({ params }: { params: Promise<{ ville: string }> }) {
  const v = await lireVille((await params).ville);
  if (!v) notFound();
  const { ville, quartiers } = v;
  const chemin = cheminVille(ville);
  const message = `Bonjour NexClean, je souhaite un devis à ${ville}.`;

  return (
    <>
      <PageHero
        illustration="proprete"
        label="Zone d’intervention"
        pillar="proprete"
        title={`Nettoyage et entretien à ${ville}`}
        subtitle={`Maisons, bureaux, espaces verts et personnel de maison : nos équipes interviennent à ${ville}. Devis gratuit, réponse rapide sur WhatsApp.`}
        breadcrumb={[{ name: 'Zones d’intervention', href: '/#zones' }, { name: ville }]}
      >
        {/* Trio d'actions (RG-06). Sur mobile, « Appeler » est déjà dans la barre fixe (MobileCTABar). */}
        <Button href={getWhatsAppLink(message)} size="lg" whatsappIcon>
          Devis sur WhatsApp
        </Button>
        <Button href={TEL_LINK} variant="outline" size="lg" icon={Phone} className="hidden lg:inline-flex">
          Appeler le {CONTACT.phoneDisplay}
        </Button>
        <Button href="/contact#contact" variant="outline" size="lg" icon={FileText}>
          Demander un devis
        </Button>
      </PageHero>

      <Section id="quartiers" labelledBy="quartiers-titre">
        <SectionHeader
          id="quartiers-titre"
          eyebrow={ville}
          title={quartiers.length > 0 ? `Quartiers desservis à ${ville}` : `Toute la ville de ${ville}`}
          intro={
            quartiers.length > 0
              ? 'Nous intervenons régulièrement dans ces quartiers. Le vôtre n’y figure pas ? Écrivez-nous : nous étudions toutes les demandes.'
              : 'Indiquez-nous votre quartier : nous vous confirmons l’intervention et les éventuels frais de déplacement.'
          }
        />
        {quartiers.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {quartiers.map((nom) => (
              <li key={nom} className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {nom}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ServicesSection title={`Nos prestations à ${ville}`} subtitle="Choisissez une prestation pour voir le détail et les tarifs indicatifs." />
      <ProcessSection whatsappMessage={message} />
      <CTASection
        title={`Un besoin à ${ville} ?`}
        subtitle="Envoyez-nous quelques photos sur WhatsApp : nous revenons vers vous avec un devis."
        formHref="/contact#contact"
        formLabel="Demander un devis"
        whatsappMessage={message}
      />
      <JsonLd data={villeServicesSchema(ville, quartiers, chemin)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Zones d’intervention', path: '/#zones' }, { name: ville, path: chemin }])} />
    </>
  );
}
