import { Check, MapPin } from 'lucide-react';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { lireCouverture } from '@/lib/geo/couverture';

interface CoverageSectionProps {
  eyebrow?: string;
  /** Phrase ajoutée avant l'annonce des quartiers. */
  intro?: string;
}

/**
 * Villes couvertes et quartiers cochés « Afficher sur le site » (M1-GEO-05).
 * « Nous intervenons à {villes} » et l'id `zones` sont vérifiés par e2e/parcours.spec.ts.
 */
export default async function CoverageSection({ eyebrow = 'Zone de couverture', intro }: CoverageSectionProps) {
  const { libelle, quartiers } = await lireCouverture();
  const plusieursVilles = quartiers.length > 1;
  const introComplete = [intro, quartiers.length > 0 && 'Principaux quartiers couverts :'].filter(Boolean).join(' ');

  return (
    <Section id="zones" tone="muted" labelledBy="zones-titre" className="scroll-mt-20">
      <SectionHeader
        id="zones-titre"
        align="center"
        eyebrow={eyebrow}
        title={`Nous intervenons à ${libelle}`}
        intro={introComplete || undefined}
      />

      <div className="mx-auto max-w-container-narrow">
        {quartiers.map((groupe) => (
          <div key={groupe.ville} className="mb-10">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="text-sm font-semibold text-ink-700">{plusieursVilles ? groupe.ville : 'Zones actives'}</span>
              <span className="rounded-full border border-success-border bg-success-soft px-2 py-0.5 text-xs text-success">
                Couverts régulièrement
              </span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {groupe.noms.map((nom) => (
                <li key={nom} className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {nom}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="rounded-card bg-navy p-6 text-center text-white sm:p-7">
          <p className="mb-1 font-semibold">Votre quartier n&apos;est pas listé ?</p>
          <p className="text-small text-brand-100">
            Contactez-nous : nous étudions toutes les demandes. Des frais de déplacement peuvent s&apos;appliquer.
          </p>
        </div>
      </div>
    </Section>
  );
}
