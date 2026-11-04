// Section « Paiements » de la page de suivi (specs/MVP2-05 RG-04, RG-15). Rendue côté serveur,
// uniquement après vérification des 4 chiffres (contrôlée par la page). Aucune donnée interne :
// voir lib/encaissements/suivi.ts. Un paiement annulé reste listé, barré, avec la mention
// « annulé » ; il n'entre pas dans les montants payés.
import { FileText } from 'lucide-react';
import { formaterMontant } from '@/lib/devis/domaine';
import { paiementsPourSuivi, type LignePaiementClient } from '@/lib/encaissements/suivi';
import type { Contexte } from '@/lib/propositions/client';
import { FUSEAU } from '@/lib/domain/referentiels';

const jour = (j: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long' }).format(new Date(`${j}T12:00:00+01:00`));
const lien = 'inline-flex min-h-11 items-center gap-2 text-primary font-semibold underline';

function libelleLigne(l: LignePaiementClient): string {
  switch (l.genre) {
    case 'paiement':
      return `${l.nature} — ${l.moyen}${l.reference ? ` (réf. ${l.reference})` : ''}`;
    case 'credit_utilise':
      return 'Crédit client imputé';
    case 'credit_verse':
      return 'Trop-perçu versé à votre crédit client';
    case 'remboursement':
      return 'Remboursement effectué';
  }
}

function Ligne({ label, valeur, fort = false }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${fort ? 'font-semibold' : ''}`}>
      <dt className={fort ? '' : 'text-ink-600'}>{label}</dt>
      <dd className="tabular-nums whitespace-nowrap">{valeur}</dd>
    </div>
  );
}

export async function SectionPaiements({ ctx }: { ctx: Contexte }) {
  const p = await paiementsPourSuivi(ctx);
  if (!p) return null;
  return (
    <section aria-labelledby="section-paiements" className="mb-8 rounded-2xl border border-ink-100 bg-white p-5 shadow-card space-y-4">
      <h2 id="section-paiements" className="text-lg font-display font-semibold">
        Paiements
      </h2>

      <dl className="space-y-1 text-sm">
        {p.devis && <Ligne label={`Montant du devis ${p.devis.numero}`} valeur={formaterMontant(p.devis.totalTtc)} />}
        {p.devis && p.devis.acompte > 0 && <Ligne label="Acompte demandé" valeur={formaterMontant(p.devis.acompte)} />}
        {p.devis && p.devis.deductionCredit > 0 && <Ligne label="Déduction de votre crédit client" valeur={`- ${formaterMontant(p.devis.deductionCredit)}`} />}
        {p.montantFinalTtc !== null && <Ligne label="Montant final (personnes placées)" valeur={formaterMontant(p.montantFinalTtc)} />}
        <Ligne label="Montants payés" valeur={formaterMontant(p.totalPaye)} />
      </dl>

      {p.tropPercu > 0 ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-800">
          Trop-perçu de <strong>{formaterMontant(p.tropPercu)}</strong> en cours de régularisation (remboursement ou crédit sur un prochain dossier, selon votre choix).
        </p>
      ) : (
        <div className={`flex justify-between gap-3 rounded-lg px-3 py-2 text-sm ${p.resteAPayer > 0 ? 'bg-cta/30' : 'bg-brand-50'}`}>
          <span className="font-medium">Reste à payer</span>
          <span className="tabular-nums font-semibold">{formaterMontant(p.resteAPayer)}</span>
        </div>
      )}

      {p.lignes.length > 0 ? (
        <ul className="divide-y divide-ink-100 text-sm">
          {p.lignes.map((l) => (
            <li key={l.id} className="py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`break-words ${l.genre === 'paiement' && l.annule ? 'line-through text-ink-500' : ''}`}>{libelleLigne(l)}</p>
                  <p className="text-xs text-ink-500">
                    {jour(l.date)}
                    {l.genre === 'paiement' && l.annule && <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 font-medium text-ink-700 no-underline">annulé</span>}
                  </p>
                </div>
                <span className={`shrink-0 tabular-nums ${l.genre === 'paiement' && l.annule ? 'line-through text-ink-500' : 'font-medium'}`}>
                  {l.genre === 'remboursement' || l.genre === 'credit_verse' ? '- ' : ''}
                  {formaterMontant(l.montant)}
                </span>
              </div>
              {l.genre === 'paiement' && l.recuNumero && (
                <a href={`${ctx.chemin}/documents/recus/${l.id}`} target="_blank" rel="noopener noreferrer" className={lien}>
                  <FileText className="w-4 h-4 shrink-0" aria-hidden /> Reçu {l.recuNumero}
                  {l.annule && <span className="font-normal text-ink-500"> (annulé)</span>}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">Aucun paiement enregistré pour le moment.</p>
      )}
      <p className="text-xs text-ink-500">Les reçus s’ouvrent dans un nouvel onglet (PDF). Les factures sont dans la rubrique « Documents ».</p>
    </section>
  );
}
