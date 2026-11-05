import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PhotoTraitee from '@/components/ui/PhotoTraitee';
import Section from '@/components/ui/Section';
import SectionLabel from '@/components/ui/SectionLabel';
import SimulateurEstimation from '@/components/sections/SimulateurEstimation';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';
import { icone } from '@/components/sections/icones';
import { HERO, type Porte } from '@/content/home-data';

const PILIER_DES_PORTES: PillarKey[] = ['proprete', 'recrutement', 'emploi'];

/** Porte d'entrée : une ligne cliquable (icône, titre, texte, flèche), séparée par des filets. */
function LignePorte({ porte, pillar }: { porte: Porte; pillar: PillarKey }) {
  const Icone = icone(porte.icon);
  return (
    <li>
      <Link
        href={porte.cta.href}
        className="group flex min-h-tap items-center gap-4 py-3 sm:py-4"
        aria-label={`${porte.titre} : ${porte.cta.label}`}
      >
        <span className={cx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', PILLARS[pillar].soft, PILLARS[pillar].text)}>
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-900 group-hover:text-primary">{porte.titre}</span>
          <span className="hidden text-small text-ink-600 sm:block">{porte.texte}</span>
        </span>
        <ArrowRight
          className={cx('h-5 w-5 flex-shrink-0 transition-transform motion-safe:group-hover:translate-x-1', PILLARS[pillar].text)}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/**
 * Premier écran (D-04, audit design A1) : promesse et trois portes visibles sans défiler,
 * puis la signature « Opérations » : photo d'équipe et simulateur d'estimation du recrutement.
 */
export default function HeroSection({ villes, commission }: { villes: string; commission: number }) {
  return (
    <Section spacing="none" labelledBy="hero-titre" className="border-b border-ink-200 bg-ink-50 py-6 sm:py-12 xl:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
        <div>
          <SectionLabel className="mb-3 sm:mb-5">NEXCLEAN SARL · {villes}</SectionLabel>
          <h1 id="hero-titre" className="text-display text-navy">
            {HERO.h1}
          </h1>
          <p className="mt-3 max-w-xl text-lead text-ink-600 max-sm:text-body sm:mt-5">{HERO.sousTitre(villes)}</p>
          <ul className="mt-4 divide-y divide-ink-200 border-y border-ink-200 sm:mt-8">
            {HERO.portes.map((porte, i) => (
              <LignePorte key={porte.titre} porte={porte} pillar={PILIER_DES_PORTES[i]!} />
            ))}
          </ul>
        </div>

        <div className="relative">
          <PhotoTraitee
            src={HERO.photo.src}
            alt={HERO.photo.alt}
            traitement="douce"
            sizes="(min-width: 1024px) 480px, 100vw"
            priority
            cadrage="object-top"
            className="h-48 sm:h-64 lg:h-72"
          />
          <SimulateurEstimation commission={commission} className="relative -mt-8 mx-3 sm:mx-8 lg:-mt-16" />
        </div>
      </div>
    </Section>
  );
}
