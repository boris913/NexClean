import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { PILLARS } from '@/components/ui/pillars';
import { icone } from '@/components/sections/icones';
import { PILIERS, PILIERS_EN_TETE } from '@/content/home-data';

/**
 * Les cinq piliers (D-01) en liste dense à filets plutôt qu'en cartes (audit design M3) :
 * une ligne cliquable par pilier, lisible d'un coup d'œil, sans répéter les portes du premier écran.
 */
export default function PiliersSection() {
  return (
    <Section id="piliers" labelledBy="piliers-titre" className="scroll-mt-20">
      <SectionHeader id="piliers-titre" eyebrow={PILIERS_EN_TETE.surtitre} title={PILIERS_EN_TETE.titre} intro={PILIERS_EN_TETE.sousTitre} />
      <ul className="divide-y divide-ink-200 border-y border-ink-200">
        {PILIERS.map((pilier) => {
          const Icone = icone(pilier.icon);
          const p = PILLARS[pilier.cle];
          return (
            <li key={pilier.cle}>
              <Link
                href={pilier.href}
                className="group grid gap-x-8 gap-y-3 py-6 sm:py-7 lg:grid-cols-[17rem_minmax(0,1fr)_auto] lg:items-start"
              >
                <span className="flex items-center gap-3">
                  <span className={cx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', p.soft, p.text)}>
                    <Icone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-h3 text-ink-900 group-hover:text-primary">{pilier.titre}</span>
                </span>
                <span className="block">
                  <span className="block text-body text-ink-900">
                    {pilier.accroche} {pilier.benefice}
                  </span>
                  <span className="mt-1.5 block text-small text-ink-600">{pilier.liste.join(' · ')}</span>
                </span>
                <span className={cx('inline-flex items-center gap-1.5 text-sm font-semibold lg:pt-1', p.text)}>
                  {pilier.cta}
                  <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
