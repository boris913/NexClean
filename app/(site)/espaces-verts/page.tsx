import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import { Scissors, Leaf, Trees, Trash2, Sprout, Check } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import JsonLd from '@/components/ui/JsonLd';
import PillarCard from '@/components/ui/PillarCard';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { greenSpacesQuoteForm } from '@/components/forms/quote-forms';
import { realisations } from '@/content/realisations-data';
import RealisationCard from '@/components/ui/RealisationCard';
import { services } from '@/content/services-data';
import { WHATSAPP_MESSAGES, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata, serviceSchema, faqSchema } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: `Entretien d'espaces verts à ${villes}`,
    description: `Tonte, débroussaillage, désherbage, taille de haies et déchets verts à ${villes}. Intervention ponctuelle ou contrat régulier, après état des lieux.`,
    path: '/espaces-verts',
  });
}

const QUOTE_MSG = WHATSAPP_MESSAGES.espacesVerts;

const prestations = [
  { icon: Sprout, title: 'Tonte de pelouse', text: 'Tonte régulière ou ponctuelle, finitions des bordures.' },
  { icon: Leaf, title: 'Débroussaillage', text: 'Remise en état de terrains et parcelles envahis.' },
  { icon: Trees, title: 'Désherbage', text: 'Allées, cours, massifs et pieds de murs.' },
  { icon: Scissors, title: 'Taille de haies', text: "Taille d'entretien et mise en forme." },
  { icon: Trash2, title: 'Déchets verts', text: 'Nettoyage, ramassage et évacuation des déchets verts.' },
];

const sites = ['Jardins privés', 'Cours', 'Résidences', 'Entreprises', 'Hôtels', 'Administrations', 'Terrains'];

const formules = ['Intervention ponctuelle (remise en état)', "Contrat d'entretien régulier", 'Tarif : sur devis après état des lieux'];

const greenFaq = [
  {
    question: "Combien coûte l'entretien d'un espace vert ?",
    answer:
      "Le tarif dépend de la superficie, de l'état du terrain, de l'accès et de la fréquence. Nous établissons un devis après un état des lieux (photos/vidéos sur WhatsApp ou visite sur place).",
  },
  {
    question: "Proposez-vous des contrats d'entretien réguliers ?",
    answer: 'Oui : passages hebdomadaires, bimensuels ou mensuels selon vos besoins, ainsi que des interventions ponctuelles.',
  },
  {
    question: 'Les déchets verts sont-ils évacués ?',
    answer: "Le ramassage des déchets verts fait partie de nos prestations. Les modalités d'évacuation sont précisées sur le devis.",
  },
];

export default async function EspacesVertsPage() {
  const couverture = await lireCouverture();
  const villes = couverture.libelle;
  // [À COMPLÉTER : photos avant/après espaces verts] : le bloc reste masqué tant qu'aucune réalisation n'existe.
  const greenRealisations = realisations.filter((r) => r.filter === 'Espaces verts');
  const service = services.find((s) => s.href === '/espaces-verts');

  return (
    <>
      <PageHero
        label="Espaces verts"
        pillar="espaces-verts"
        title={`Entretien des espaces verts à ${villes}`}
        subtitle="Tonte, débroussaillage, désherbage, taille de haies et ramassage des déchets verts, en intervention ponctuelle ou en contrat régulier."
        breadcrumb={[{ name: 'Espaces verts' }]}
      >
        <Button href="#devis-espaces-verts" size="lg">
          Demander un état des lieux
        </Button>
        <Button href={getWhatsAppLink(QUOTE_MSG)} variant="whatsapp" size="lg" whatsappIcon>
          WhatsApp
        </Button>
      </PageHero>

      <Section labelledBy="prestations-titre">
        <SectionHeader id="prestations-titre" align="center" pillar="espaces-verts" title="Nos prestations" />
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {prestations.map((p, i) => (
            <StaggerItem
              key={p.title}
              className={cx(i < 3 ? 'lg:col-span-2' : 'lg:col-span-3', i === prestations.length - 1 && 'sm:col-span-2 lg:col-span-3')}
            >
              <PillarCard pillar="espaces-verts" icon={p.icon} title={p.title} description={p.text} />
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-display text-h3 text-ink-900">Sites entretenus</h3>
            <ul className="flex flex-wrap gap-2">
              {sites.map((s) => (
                <li key={s} className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-small text-ink-700">
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="mb-3 font-display text-h3 text-ink-900">Formules</h3>
            <ul className="space-y-2 text-small text-ink-600">
              {formules.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {greenRealisations.length > 0 && (
        <Section tone="muted" labelledBy="avant-apres-titre">
          <SectionHeader id="avant-apres-titre" pillar="espaces-verts" title="Avant / Après" />
          <div className="grid gap-6 md:grid-cols-2">
            {greenRealisations.map((r) => (
              <RealisationCard key={r.id} item={r} />
            ))}
          </div>
        </Section>
      )}

      <Section id="devis-espaces-verts" tone="muted" container="narrow" labelledBy="devis-espaces-verts-titre" className="scroll-mt-24">
        <SectionHeader
          id="devis-espaces-verts-titre"
          align="center"
          title="Demander un état des lieux / devis"
          intro="Envoyez ensuite vos photos ou vidéos du site sur WhatsApp."
          className="!mb-8"
        />
        <Card>
          <WhatsAppForm {...greenSpacesQuoteForm} submitLabel="Demander mon devis espaces verts" />
        </Card>
      </Section>

      <FAQSection items={greenFaq} />
      <CTASection
        title="Un jardin ou un terrain à entretenir ?"
        subtitle="Envoyez-nous quelques photos : nous revenons vers vous avec une proposition."
        whatsappMessage={QUOTE_MSG}
        formHref="#devis-espaces-verts"
        formLabel="Demander un état des lieux"
      />
      {service && <JsonLd data={serviceSchema(service, couverture.villes)} />}
      <JsonLd data={faqSchema(greenFaq)} />
    </>
  );
}
