// COM1-02 RG-01 : rendez-vous du dossier (fiche, onglet Résumé).
import { CalendarClock } from 'lucide-react';
import { Carte, Pastille } from '@/components/backoffice/ui';
import { estACloturer, libelleDebut, partiesDouala, RDV_STATUTS, RDV_TYPES, type RdvStatut } from '@/lib/rendezvous/domaine';
import { collaborateursCommerciaux, rendezVousDuDossier } from '@/lib/rendezvous/service';
import { ActionsRdv, FormulaireRdv } from './RendezVous';

const TON: Record<RdvStatut, 'bleu' | 'vert' | 'rouge' | 'neutre'> = { prevu: 'bleu', fait: 'vert', non_honore: 'rouge', annule: 'neutre' };

export default async function SectionRendezVous({ dossierId, traiter, ouvert, referentId }: { dossierId: number; traiter: boolean; ouvert: boolean; referentId: string | null }) {
  const [liste, collaborateurs] = await Promise.all([rendezVousDuDossier(dossierId), traiter ? collaborateursCommerciaux() : []]);
  if (!traiter && liste.length === 0) return null;
  const maintenant = new Date();
  const noms = new Map(collaborateurs.map((c) => [c.id, c.nom]));
  return (
    <Carte titre="Rendez-vous">
      {liste.length > 0 && (
        <ul className="-mt-1 mb-4 divide-y divide-ink-100 text-sm" id="rendez-vous">
          {liste.map((r) => {
            const { jour, heure } = partiesDouala(r.debut);
            return (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarClock aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium text-ink-900">{RDV_TYPES[r.type]}</span>
                  <span className="text-ink-700">{libelleDebut(r.debut)}</span>
                  <Pastille ton={TON[r.statut]}>{RDV_STATUTS[r.statut]}</Pastille>
                  {estACloturer(r, maintenant) && <Pastille ton="orange">À clôturer</Pastille>}
                </div>
                {r.lieu && <p className="mt-1 text-ink-600">{r.lieu}</p>}
                {r.participants.length > 0 && <p className="mt-1 text-xs text-ink-500">Avec {r.participants.map((p) => noms.get(p) ?? 'un collaborateur').join(', ')}</p>}
                {r.compteRendu && <p className="mt-1 whitespace-pre-line text-ink-700">{r.compteRendu}</p>}
                {traiter && r.statut === 'prevu' && (
                  <ActionsRdv
                    dossierId={dossierId}
                    rdvId={r.id}
                    passe={r.debut <= maintenant}
                    initial={{ type: r.type, jour, heure, dureeMinutes: r.dureeMinutes, lieu: r.lieu ?? '', participants: r.participants }}
                    collaborateurs={collaborateurs}
                    referentId={referentId}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {traiter && ouvert && (
        <details open={liste.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-primary">Planifier un rendez-vous</summary>
          <div className="mt-3">
            <FormulaireRdv dossierId={dossierId} collaborateurs={collaborateurs} referentId={referentId} />
          </div>
        </details>
      )}
    </Carte>
  );
}
