import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import Section from '@/components/ui/Section';
import { cx } from '@/components/ui/cx';
import { PILLARS, type PillarKey } from '@/components/ui/pillars';
import { icone } from '@/components/sections/icones';
import { HERO, type Porte } from '@/content/home-data';

const PILIER_DES_PORTES: PillarKey[] = ['proprete', 'recrutement', 'emploi'];

/**
 * Carte d'entrée. Toute la carte est cliquable (lien étiré sur le CTA) ; le lien secondaire passe au-dessus.
 * Sous `sm`, elle se réduit à une ligne pour que les trois tiennent au-dessus de la ligne de flottaison.
 */
function CartePorte({ porte, pillar }: { porte: Porte; pillar: PillarKey }) {
  return (
    <Card
      as="li"
      variant="pillar"
      pillar={pillar}
      padding="sm"
      className={cx('max-sm:py-2.5 max-sm:px-3 transition-shadow hover:shadow-card-hover', PILLARS[pillar].hoverBorder)}
    >
      <div className="flex items-center gap-3 sm:block">
        <IconBadge icon={icone(porte.icon)} tone={pillar} className="sm:mb-3" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-h3 text-ink-900">{porte.titre}</h2>
          <p className="mt-1 hidden text-small text-ink-600 sm:block">{porte.texte}</p>
          <div className="flex flex-col items-start sm:mt-2">
            <Link
              href={porte.cta.href}
              className={cx(
                'inline-flex items-center gap-1 text-sm font-semibold sm:min-h-8 after:absolute after:inset-0 after:rounded-card',
                PILLARS[pillar].text,
              )}
            >
              {porte.cta.label}
              <ArrowRight className="w-4 h-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {porte.lienSecondaire && (
              <Link
                href={porte.lienSecondaire.href}
                className="relative z-10 hidden min-h-8 items-center text-sm text-ink-600 underline underline-offset-2 hover:text-ink-900 sm:inline-flex"
              >
                {porte.lienSecondaire.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Premier écran (D-04) : promesse et trois portes visibles sans défiler, sur mobile comme sur desktop. */
export default function HeroSection({ villes }: { villes: string }) {
  return (
    <Section tone="dark" spacing="none" labelledBy="hero-titre" className="surface-dark py-5 sm:py-10 xl:py-12">
      <div className="lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <div>
          <h1 id="hero-titre" className="font-display text-display text-white">
            {HERO.h1}
          </h1>
          <p className="mt-3 max-w-2xl text-lead text-brand-100 max-sm:text-body sm:mt-5">{HERO.sousTitre(villes)}</p>
        </div>
        <div className="relative hidden h-64 overflow-hidden rounded-4xl lg:block">
          <Image src={HERO.photo.src} alt={HERO.photo.alt} fill priority sizes="400px" className="object-cover object-top" />
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:mt-8 sm:gap-4 md:grid-cols-3">
        {HERO.portes.map((porte, i) => (
          <CartePorte key={porte.titre} porte={porte} pillar={PILIER_DES_PORTES[i]} />
        ))}
      </ul>
    </Section>
  );
}
