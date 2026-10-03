import type { Metadata } from 'next';
import { Scissors, Leaf, Trees, Trash2, Sprout, Check } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import Button from '@/components/ui/Button';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import JsonLd from '@/components/ui/JsonLd';
import FAQSection from '@/components/sections/FAQSection';
import CTASection from '@/components/sections/CTASection';
import WhatsAppForm from '@/components/forms/WhatsAppForm';
import { greenSpacesQuoteForm } from '@/components/forms/quote-forms';
import { realisations } from '@/content/realisations-data';
import RealisationCard from '@/components/ui/RealisationCard';
import { services } from '@/content/services-data';
import { CITIES_LABEL, getWhatsAppLink } from '@/lib/constants';
import { pageMetadata, serviceSchema, faqSchema } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: `Entretien espaces verts à ${CITIES_LABEL}`,
  description: `Entretien d'espaces verts à ${CITIES_LABEL} : tonte de pelouse, débroussaillage, désherbage, taille de haies, ramassage des déchets verts. Ponctuel ou contrat régulier.`,
  path: '/espaces-verts',
});

const QUOTE_MSG = "Bonjour NexClean, je souhaite un état des lieux / devis pour l'entretien d'un espace vert.";

const prestations = [
  { icon: Sprout, title: 'Tonte de pelouse', text: 'Tonte régulière ou ponctuelle, finitions des bordures.' },
  { icon: Leaf, title: 'Débroussaillage', text: 'Remise en état de terrains et parcelles envahis.' },
  { icon: Trees, title: 'Désherbage', text: 'Allées, cours, massifs et pieds de murs.' },
  { icon: Scissors, title: 'Taille de haies', text: 'Taille d\'entretien et mise en forme.' },
  { icon: Trash2, title: 'Déchets verts', text: 'Nettoyage, ramassage et évacuation des déchets verts.' },
];

const sites = ['Jardins privés', 'Cours', 'Résidences', 'Entreprises', 'Hôtels', 'Administrations', 'Terrains'];

const greenFaq = [
  {
    question: 'Combien coûte l\'entretien d\'un espace vert ?',
    answer:
      'Le tarif dépend de la superficie, de l\'état du terrain, de l\'accès et de la fréquence. Nous établissons un devis après un état des lieux (photos/vidéos sur WhatsApp ou visite sur place).',
  },
  {
    question: 'Proposez-vous des contrats d\'entretien réguliers ?',
    answer: 'Oui : passages hebdomadaires, bimensuels ou mensuels selon vos besoins, ainsi que des interventions ponctuelles.',
  },
  {
    question: 'Les déchets verts sont-ils évacués ?',
    answer: 'Le ramassage des déchets verts fait partie de nos prestations. Les modalités d\'évacuation sont précisées sur le devis.',
  },
];

export default function EspacesVertsPage() {
  const greenRealisations = realisations.filter((r) => r.filter === 'Espaces verts');
  const service = services.find((s) => s.href === '/espaces-verts');

  return (
    <>
      <PageHero
        label="Espaces verts"
        title={`Entretien des espaces verts à ${CITIES_LABEL}`}
        subtitle="Tonte, débroussaillage, désherbage, taille de haies et ramassage des déchets verts — en intervention ponctuelle ou en contrat d'entretien régulier."
        breadcrumb={[{ name: 'Services', href: '/services' }, { name: 'Espaces verts' }]}
      >
        <Button href="#devis-espaces-verts" variant="primary" size="lg">
          Demander un état des lieux / devis espaces verts
        </Button>
        <Button href={getWhatsAppLink(QUOTE_MSG)} variant="whatsapp" size="lg">
          <WhatsAppIcon className="w-5 h-5" />
          WhatsApp
        </Button>
      </PageHero>

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl text-slate-900 mb-10 text-center">Nos prestations</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {prestations.map((p) => (
              <div key={p.title} className="rounded-2xl border border-slate-100 p-5 shadow-card">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                  <p.icon className="w-5 h-5 text-green-700" strokeWidth={1.75} />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{p.title}</h3>
                <p className="text-sm text-slate-500">{p.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-50 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Sites entretenus</h3>
              <ul className="flex flex-wrap gap-2">
                {sites.map((s) => (
                  <li key={s} className="text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-50 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Formules</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2"><Check className="w-4 h-4 text-success mt-0.5" /> Intervention ponctuelle (remise en état)</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-success mt-0.5" /> Contrat d&apos;entretien régulier</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-success mt-0.5" /> Tarif : sur devis après état des lieux</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {greenRealisations.length > 0 && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl text-slate-900 mb-8">Avant / Après</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {greenRealisations.map((r) => (
                <RealisationCard key={r.id} item={r} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="devis-espaces-verts" className="py-16 sm:py-20 bg-slate-50 scroll-mt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl text-slate-900 mb-2">Demander un état des lieux / devis</h2>
            <p className="text-slate-500">Envoyez ensuite vos photos ou vidéos du site sur WhatsApp.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 lg:p-8">
            <WhatsAppForm {...greenSpacesQuoteForm} submitLabel="Demander mon devis espaces verts" />
          </div>
        </div>
      </section>

      <FAQSection items={greenFaq} />
      <CTASection
        title="Un jardin ou un terrain à entretenir ?"
        subtitle="Envoyez-nous quelques photos : nous revenons vers vous avec une proposition."
        whatsappMessage={QUOTE_MSG}
        formHref="#devis-espaces-verts"
      />
      {service && <JsonLd data={serviceSchema(service)} />}
      <JsonLd data={faqSchema(greenFaq)} />
    </>
  );
}
