'use client';

import { useId, useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { estimer, formaterFCFA, MAX_PERSONNES_PAR_LIGNE } from '@/lib/dossiers/formulaire-personnel';

/** Postes les plus demandés ; « Autre poste » laisse l'intitulé vide dans le formulaire. */
const POSTES = ["Agent d'entretien", 'Serveur / serveuse', 'Cuisinier / cuisinière', 'Gardien', 'Nounou', 'Autre poste'];

const champ =
  'min-h-tap w-full rounded-lg border border-ink-300 bg-white px-3 text-body text-ink-900 focus-ring focus:border-primary';

/**
 * Simulateur du premier écran (audit design A1) : poste × nombre de personnes × commission en vigueur.
 * Simple estimation (CONTEXT.md « Estimation ») : le montant engageant reste celui du devis.
 * Le bouton ouvre le formulaire « Demander du personnel » prérempli (?poste=&personnes=).
 */
export default function SimulateurEstimation({ commission, className }: { commission: number; className?: string }) {
  const id = useId();
  const [poste, setPoste] = useState(POSTES[0]!);
  const [personnes, setPersonnes] = useState(2);
  const { montant } = estimer(commission, personnes);

  const changer = (n: number) => setPersonnes(Math.min(MAX_PERSONNES_PAR_LIGNE, Math.max(1, Math.round(n) || 1)));
  const params = new URLSearchParams({ personnes: String(personnes) });
  if (poste !== 'Autre poste') params.set('poste', poste);

  return (
    <div className={cx('rounded-card border border-ink-200 bg-white p-5 text-ink-900 shadow-card-hover sm:p-6', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-eyebrow uppercase text-primary">Estimer un recrutement</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-eyebrow uppercase text-ink-600">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cta" />
          Immédiat
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`${id}-poste`} className="mb-1.5 block text-small font-medium text-ink-700">
            Poste
          </label>
          <select id={`${id}-poste`} value={poste} onChange={(e) => setPoste(e.target.value)} className={champ}>
            {POSTES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-nombre`} className="mb-1.5 block text-small font-medium text-ink-700">
            Personnes
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changer(personnes - 1)}
              disabled={personnes <= 1}
              aria-label="Une personne de moins"
              className="tap-target inline-flex items-center justify-center rounded-lg border border-ink-300 text-ink-900 hover:border-primary disabled:opacity-40"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              id={`${id}-nombre`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PERSONNES_PAR_LIGNE}
              value={personnes}
              onChange={(e) => changer(Number(e.target.value))}
              className={cx(champ, 'w-16 text-center font-mono tabular-nums')}
            />
            <button
              type="button"
              onClick={() => changer(personnes + 1)}
              disabled={personnes >= MAX_PERSONNES_PAR_LIGNE}
              aria-label="Une personne de plus"
              className="tap-target inline-flex items-center justify-center rounded-lg border border-ink-300 text-ink-900 hover:border-primary disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-ink-200 pt-5" aria-live="polite">
        <p className="text-small text-ink-600">Commission estimée</p>
        <p className="mt-1 font-mono text-figure tabular-nums text-navy">{formaterFCFA(montant)}</p>
        <p className="mt-2 font-mono text-small text-ink-600">
          {personnes} × {formaterFCFA(commission)} par personne placée
        </p>
      </div>

      <Button href={`/recrutement/demander-du-personnel?${params}`} fullWidth icon={ArrowRight} iconPosition="right" className="mt-5">
        Demander du personnel
      </Button>
      <p className="mt-3 text-small text-ink-600">
        Estimation indicative. Vous ne payez que les placements confirmés ; le salaire est versé directement par vous.
      </p>
    </div>
  );
}
