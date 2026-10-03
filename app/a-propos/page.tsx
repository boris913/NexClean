import type { Metadata } from 'next';
import Image from 'next/image';
import { Target, Eye, Heart, ClipboardCheck } from 'lucide-react';
import PageHero from '@/components/ui/PageHero';
import WhyUsSection from '@/components/sections/WhyUsSection';
import ClientProcess from '@/components/sections/ClientProcess';
import CTASection from '@/components/sections/CTASection';
import { CITIES_LABEL } from '@/lib/constants';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'À propos',
  description: `NexClean SARL : entreprise camerounaise de nettoyage professionnel et d'entretien des espaces verts basée à ${CITIES_LABEL}. Mission, valeurs et méthode qualité.`,
  path: '/a-propos',
});

const pillars = [
  {
    icon: Target,
    title: 'Notre mission',
    text: 'Offrir aux particuliers et aux entreprises un service de propreté fiable, organisé et accessible.',
  },
  {
    icon: Eye,
    title: 'Notre vision',
    text: 'Devenir une référence camerounaise de la propreté et de l\'entretien, des services jusqu\'aux produits.',
  },
  {
    icon: Heart,
    title: 'Nos valeurs',
    text: 'Ponctualité, honnêteté, discrétion, rigueur et respect des lieux qui nous sont confiés.',
  },
];

const qualitySteps = [
  'Brief de l\'équipe avant chaque intervention (besoins du client, zones prioritaires).',
  'Matériel et produits adaptés aux surfaces à traiter.',
  'Contrôle du travail en fin d\'intervention, avec le client lorsque c\'est possible.',
  'Retour du client recueilli après la prestation pour corriger et progresser.',
];

export default function AProposPage() {
  return (
    <>
      <PageHero
        label="À propos"
        title="NexClean, la propreté organisée"
        subtitle={`NexClean SARL est une entreprise camerounaise implantée à ${CITIES_LABEL}. Nous accompagnons particuliers et professionnels dans le nettoyage de leurs espaces, l'entretien de leurs espaces verts et, désormais, avec nos propres produits d'entretien.`}
        breadcrumb={[{ name: 'À propos' }]}
      />

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-5">
          {pillars.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-100 p-6 shadow-card">
              <p.icon className="w-6 h-6 text-primary mb-3" strokeWidth={1.75} />
              <h2 className="font-semibold text-slate-900 mb-2">{p.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-3xl text-slate-900 mb-4 flex items-center gap-3">
              <ClipboardCheck className="w-7 h-7 text-primary" />
              Engagement qualité
            </h2>
            <p className="text-slate-600 mb-6">Notre méthode de contrôle, appliquée à chaque intervention :</p>
            <ol className="space-y-3">
              {qualitySteps.map((s, i) => (
                <li key={s} className="flex gap-3 text-slate-700">
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['/images/team/equipe-nexclean5.jpeg', '/images/team/equipe-nexclean7.jpeg'].map((src) => (
              <div key={src} className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                <Image src={src} alt="Équipe NexClean en intervention" fill className="object-cover" sizes="(max-width: 1024px) 50vw, 25vw" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhyUsSection />
      <ClientProcess />
      <CTASection />
    </>
  );
}
