import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { icone } from '@/components/sections/icones';
import { SUIVI_EN_LIGNE } from '@/content/home-data';

/** Suivi de dossier en ligne : page de suivi par lien personnel, sans compte. */
export default function SuiviSection() {
  return (
    <Section id="suivi" tone="brand" labelledBy="suivi-titre" className="scroll-mt-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <SectionHeader
          id="suivi-titre"
          eyebrow={SUIVI_EN_LIGNE.surtitre}
          title={SUIVI_EN_LIGNE.titre}
          intro={SUIVI_EN_LIGNE.texte}
          actions={<Button href={SUIVI_EN_LIGNE.cta.href}>{SUIVI_EN_LIGNE.cta.label}</Button>}
          className="!mb-0"
        />
        <Card>
          <IconBadge icon={icone(SUIVI_EN_LIGNE.icon)} tone="brand" size="lg" className="mb-5" />
          <ul className="space-y-3">
            {SUIVI_EN_LIGNE.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-ink-900">
                <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-ink-100 pt-4 text-small text-ink-600">{SUIVI_EN_LIGNE.mention}</p>
        </Card>
      </div>
    </Section>
  );
}
