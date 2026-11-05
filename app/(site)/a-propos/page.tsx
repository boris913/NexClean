import type { Metadata } from 'next';
import { lireCouverture } from '@/lib/geo/couverture';
import { Target, Eye, Heart } from 'lucide-react';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import PageHero from '@/components/ui/PageHero';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import WhyUsSection from '@/components/sections/WhyUsSection';
import ClientProcess from '@/components/sections/ClientProcess';
import CTASection from '@/components/sections/CTASection';
import { CTA_FINAL } from '@/content/home-data';
import { COMPANY } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { libelle: villes } = await lireCouverture();
  return pageMetadata({
    title: 'À propos',
    description: `NEXCLEAN SARL, entreprise camerounaise de services aux entreprises et aux particuliers à ${villes} : propreté, recrutement et placement, espaces verts. Mission et méthode.`,
    path: '/a-propos',
  });
}

const VALEURS = ['Ponctualité', 'Honnêteté et discrétion', 'Clarté des prix', 'Respect des candidats'];

export default async function AProposPage() {
  const { libelle: villes } = await lireCouverture();

  const pillars = [
    {
      icon: Target,
      title: 'Notre mission',
      text: 'Rendre simples et fiables les services du quotidien : un espace entretenu, un poste pourvu, une demande suivie de bout en bout.',
    },
    {
      // [À CONFIRMER : formulation de la vision par la direction]
      icon: Eye,
      title: 'Notre vision',
      text: `Devenir l'interlocuteur de référence à ${villes} pour les services aux entreprises et aux particuliers.`,
    },
  ];

  // [À COMPLÉTER : informations légales (COMPANY.rccm, COMPANY.niu, COMPANY.director)] : bloc masqué tant que tout est vide.
  const infosLegales = [
    { label: 'RCCM', valeur: COMPANY.rccm },
    { label: 'NIU', valeur: COMPANY.niu },
    { label: 'Dirigeant', valeur: COMPANY.director },
  ].filter((info) => info.valeur);

  return (
    <>
      <PageHero
        label="À propos"
        title="NEXCLEAN, des services organisés pour vos espaces et vos équipes"
        subtitle={`NEXCLEAN SARL est une entreprise camerounaise implantée à ${villes}. Nous accompagnons entreprises et particuliers pour la propreté de leurs espaces, le recrutement de leur personnel et l'entretien de leurs espaces verts.`}
        breadcrumb={[{ name: 'À propos' }]}
      />

      <Section tone="muted" spacing="sm">
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <Card key={p.title}>
              <IconBadge icon={p.icon} className="mb-4" />
              <h2 className="mb-2 text-h3 text-ink-900">{p.title}</h2>
              <p className="text-small text-ink-600">{p.text}</p>
            </Card>
          ))}
          <Card>
            <IconBadge icon={Heart} className="mb-4" />
            <h2 className="mb-2 text-h3 text-ink-900">Nos valeurs</h2>
            <ul className="space-y-1 text-small text-ink-600">
              {VALEURS.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      <WhyUsSection />
      <ClientProcess />

      {infosLegales.length > 0 && (
        <Section spacing="sm" labelledBy="entreprise-titre">
          <SectionHeader id="entreprise-titre" title="L'entreprise" className="!mb-6" />
          <dl className="grid gap-6 sm:grid-cols-3">
            {infosLegales.map((info) => (
              <div key={info.label}>
                <dt className="text-small text-muted">{info.label}</dt>
                <dd className="font-semibold text-ink-900">{info.valeur}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* [À COMPLÉTER : chiffres réels (dossiers traités, placements confirmés, clients) — ne rien afficher sans source] */}

      <CTASection
        title={CTA_FINAL.titre}
        subtitle={CTA_FINAL.texte}
        formLabel={CTA_FINAL.cta.label}
        formHref={CTA_FINAL.cta.href}
        whatsappLabel={CTA_FINAL.whatsapp.label}
        whatsappMessage={CTA_FINAL.whatsapp.message}
      />
    </>
  );
}
