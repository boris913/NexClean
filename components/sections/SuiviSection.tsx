import { Check, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';
import Section from '@/components/ui/Section';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx } from '@/components/ui/cx';
import { PARCOURS, PARCOURS_EN_TETE, SUIVI_EN_LIGNE } from '@/content/home-data';

/** Étapes de l'exemple de page de suivi (données fictives, affichées comme telles). */
const EXEMPLE_ETAPES = [
  { libelle: 'Demande reçue', etat: 'fait' },
  { libelle: 'Devis accepté', etat: 'fait' },
  { libelle: 'Recherche de candidats', etat: 'en-cours' },
  { libelle: 'Placements confirmés', etat: 'a-venir' },
] as const;

const EXEMPLE_DOCUMENTS = ['Devis', "Facture d'acompte", 'Reçu de paiement'];

/** Aperçu d'interface de la page de suivi (audit design A2). Purement illustratif. */
function ApercuSuivi() {
  return (
    <figure className="overflow-hidden rounded-card border border-ink-200 bg-white shadow-card-hover">
      <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-ink-50 px-5 py-3">
        <span className="font-mono text-eyebrow uppercase text-ink-600">Page de suivi</span>
        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-eyebrow uppercase text-ink-600 ring-1 ring-ink-200">Exemple</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-small text-ink-600">Dossier n°</p>
        <p className="font-mono text-h3 tabular-nums text-navy">REC-2026-00042</p>
        <p className="mt-1 text-small text-ink-700">Recrutement · 3 agents d&apos;entretien · Douala</p>

        <ol className="mt-6 space-y-0">
          {EXEMPLE_ETAPES.map((e, i) => (
            <li key={e.libelle} className="relative flex gap-3 pb-5 last:pb-0">
              {i < EXEMPLE_ETAPES.length - 1 && (
                <span aria-hidden="true" className={cx('absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px', e.etat === 'fait' ? 'bg-primary' : 'bg-ink-200')} />
              )}
              <span
                aria-hidden="true"
                className={cx(
                  'relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                  e.etat === 'fait' && 'bg-primary text-white',
                  e.etat === 'en-cours' && 'bg-cta ring-4 ring-lime-100',
                  e.etat === 'a-venir' && 'border border-ink-300 bg-white',
                )}
              >
                {e.etat === 'fait' && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={cx('text-small', e.etat === 'a-venir' ? 'text-ink-600' : 'font-medium text-ink-900')}>
                {e.libelle}
                {e.etat === 'en-cours' && <span className="ml-2 font-mono text-eyebrow uppercase text-primary">En cours</span>}
              </span>
            </li>
          ))}
        </ol>

        <ul className="mt-6 divide-y divide-ink-200 border-y border-ink-200">
          {EXEMPLE_DOCUMENTS.map((d) => (
            <li key={d} className="flex items-center gap-3 py-2.5 text-small text-ink-900">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              {d}
              <span className="ml-auto font-mono text-eyebrow uppercase text-ink-600">PDF</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="border-t border-ink-200 bg-ink-50 px-5 py-3 text-small text-ink-600">{SUIVI_EN_LIGNE.mention}</figcaption>
    </figure>
  );
}

/**
 * Parcours commun (demande → devis → réalisation → suivi) et suivi en ligne, en une section :
 * étapes numérotées à gauche, aperçu de la page de suivi à droite (audit design M3 + A2).
 */
export default function SuiviSection() {
  return (
    <Section id="parcours" tone="muted" labelledBy="parcours-titre" className="scroll-mt-20">
      <span id="suivi" className="block scroll-mt-20" aria-hidden="true" />
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            id="parcours-titre"
            eyebrow={PARCOURS_EN_TETE.surtitre}
            title={PARCOURS_EN_TETE.titre}
            intro={SUIVI_EN_LIGNE.texte}
            className="!mb-8"
          />
          <ol className="divide-y divide-ink-200 border-y border-ink-200">
            {PARCOURS.map((etape, i) => (
              <li key={etape.titre} className="grid grid-cols-[3rem_1fr] gap-x-2 py-5">
                <span aria-hidden="true" className="font-mono text-h3 tabular-nums text-primary">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-h3 text-ink-900">{etape.titre}</h3>
                  <p className="mt-1 text-small text-ink-600">{etape.texte}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button href={SUIVI_EN_LIGNE.cta.href} className="mt-8">
            {SUIVI_EN_LIGNE.cta.label}
          </Button>
        </div>
        <div className="lg:pt-24">
          <ApercuSuivi />
        </div>
      </div>
    </Section>
  );
}
