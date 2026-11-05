import Card from '@/components/ui/Card';
import IconBadge from '@/components/ui/IconBadge';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { icone } from '@/components/sections/icones';
import { PARCOURS, PARCOURS_EN_TETE } from '@/content/home-data';

/** Parcours commun à toutes les demandes : demande → devis → exécution → suivi en ligne. */
export default function ParcoursSection() {
  return (
    <Section id="parcours" tone="muted" labelledBy="parcours-titre" className="scroll-mt-20">
      <SectionHeader
        id="parcours-titre"
        eyebrow={PARCOURS_EN_TETE.surtitre}
        title={PARCOURS_EN_TETE.titre}
        intro={PARCOURS_EN_TETE.sousTitre}
      />
      <Stagger as="ol" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PARCOURS.map((etape, i) => (
          <StaggerItem as="li" key={etape.titre}>
            <Card className="h-full">
              <div className="mb-4 flex items-center justify-between">
                <IconBadge icon={icone(etape.icon)} tone="cta" />
                <span aria-hidden="true" className="font-display text-h2 text-brand-200">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display text-h3 text-ink-900">{etape.titre}</h3>
              <p className="mt-2 text-small text-ink-600">{etape.texte}</p>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
