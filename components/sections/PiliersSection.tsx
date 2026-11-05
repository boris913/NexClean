import { Check } from 'lucide-react';
import PillarCard from '@/components/ui/PillarCard';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { icone } from '@/components/sections/icones';
import { PILIERS, PILIERS_EN_TETE } from '@/content/home-data';

/** Une carte par pilier (D-01) : 3 + 2 sur grand écran. */
export default function PiliersSection() {
  return (
    <Section id="piliers" labelledBy="piliers-titre" className="scroll-mt-20">
      <SectionHeader
        id="piliers-titre"
        eyebrow={PILIERS_EN_TETE.surtitre}
        title={PILIERS_EN_TETE.titre}
        intro={PILIERS_EN_TETE.sousTitre}
      />
      <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        {PILIERS.map((pilier, i) => (
          <StaggerItem
            key={pilier.cle}
            className={cx(i < 3 ? 'lg:col-span-2' : 'lg:col-span-3', i === PILIERS.length - 1 && 'sm:col-span-2')}
          >
            <PillarCard
              pillar={pilier.cle}
              icon={icone(pilier.icon)}
              title={pilier.titre}
              description={pilier.accroche}
              href={pilier.href}
              ctaLabel={pilier.cta}
            >
              <p className="text-small font-medium text-ink-900">{pilier.benefice}</p>
              <ul className="mt-3 space-y-1.5">
                {pilier.liste.map((element) => (
                  <li key={element} className="flex items-start gap-2 text-small text-ink-600">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                    {element}
                  </li>
                ))}
              </ul>
            </PillarCard>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
