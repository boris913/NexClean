// MVP2-04 : section « Factures » d'un dossier (onglet Documents) — factures d'acompte, de solde
// et avoirs, immuables (RG-17) ; PDF archivé ou à générer ; avoir de correction (Direction).
import type { Demandeur } from '@/lib/dossiers/acces';
import { formaterMontant, TYPES_FACTURE, type TypeFacture } from '@/lib/devis/domaine';
import { listerFactures } from '@/lib/devis/facturation';
import { Receipt } from 'lucide-react';
import { Carte, Pastille } from '@/components/backoffice/ui';
import * as F from './Factures';

const TON: Record<TypeFacture, 'vert' | 'bleu' | 'orange'> = { acompte: 'bleu', solde: 'vert', avoir: 'orange' };
const dateCourte = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).format(d);

export default async function SectionFactures({ dossierId, demandeur, traiter }: { dossierId: number; demandeur: Demandeur; traiter: boolean }) {
  const factures = await listerFactures(dossierId, demandeur);
  if (factures.length === 0) return null;
  const direction = demandeur.roles.includes('direction');
  const peutGenerer = traiter || demandeur.roles.includes('finances');

  return (
    <Carte titre="Factures" description="Une facture émise ne se modifie pas ; une erreur se corrige par un avoir.">
      <ul className="-my-2 divide-y divide-ink-100">
        {factures.map((f) => (
          <li key={f.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean-50 text-ocean-600">
                <Receipt className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  {f.documentId ? (
                    <a href={`/admin/documents/${f.documentId}`} target="_blank" rel="noopener" className="text-primary font-medium tabular-nums">{f.numero}</a>
                  ) : (
                    <span className="font-medium text-ink-900 tabular-nums">{f.numero}</span>
                  )}
                  <Pastille ton={TON[f.type]}>{TYPES_FACTURE[f.type]}</Pastille>
                </p>
                <p className="text-xs text-ink-500">
                  {dateCourte(f.emiseLe)} · <span className="font-medium text-ink-800 tabular-nums">{formaterMontant(f.totalTtc)}</span>
                  {f.factureOrigine && <> · sur {f.factureOrigine}</>}
                </p>
                <p className="text-xs text-ink-600 mt-0.5 break-words">{f.libelle}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {!f.documentId && peutGenerer && <F.GenererPdf dossierId={dossierId} factureId={f.id} />}
              {direction && f.type !== 'avoir' && f.restantTtc > 0 && <F.EmettreAvoir dossierId={dossierId} factureId={f.id} numero={f.numero} montant={formaterMontant(f.restantTtc)} />}
            </div>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
