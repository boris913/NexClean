import { Check, MapPin } from 'lucide-react';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import Link from 'next/link';
import { lireCouverture } from '@/lib/geo/couverture';
import { cheminVille } from '@/lib/geo/slug';

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
  const { libelle, villes, quartiers } = await lireCouverture();
  const plusieursVilles = quartiers.length > 1;
  const introComplete = [intro, quartiers.length > 0 && 'Principaux quartiers couverts :'].filter(Boolean).join(' ');

  return (
    <Section id="zones" tone="muted" labelledBy="zones-titre" className="scroll-mt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
      <SectionHeader
        id="zones-titre"
        eyebrow={eyebrow}
        title={`Nous intervenons à ${libelle}`}
        intro={introComplete || undefined}
        className="!mb-0"
      />

      <div>
        {quartiers.map((groupe) => (
          <div key={groupe.ville} className="mb-10">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="text-sm font-semibold text-ink-700">{plusieursVilles ? groupe.ville : 'Zones actives'}</span>
              <span className="rounded-md border border-success-border bg-success-soft px-2 py-0.5 text-xs text-success">
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

        {/* Pages par ville (specs/COM1-01 RG-11) : maillage interne pour le référencement local. */}
        <ul className="mb-8 flex flex-wrap gap-x-5 gap-y-2" aria-label="Pages par ville">
          {villes.map((v) => (
            <li key={v}>
              <Link href={cheminVille(v)} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Nos services à {v}
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-l-2 border-primary pl-4">
          <p className="mb-1 font-semibold text-ink-900">Votre quartier n&apos;est pas listé ?</p>
          <p className="text-small text-ink-600">
            Contactez-nous : nous étudions toutes les demandes. Des frais de déplacement peuvent s&apos;appliquer.
          </p>
        </div>
      </div>
      </div>
    </Section>
  );
}
