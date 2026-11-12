// COM1-02 RG-03 : agenda des rendez-vous (jour / semaine), filtrable par référent et par ville.
// L'état (vue, jour, filtres) vit dans l'URL : partageable et compatible avec le bouton Retour.
import Link from 'next/link';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listesLieux } from '@/lib/geo/service';
import { bornesAgenda, decalerJour, libelleDebut, libelleHeure, partiesDouala, RDV_STATUTS, RDV_TYPES, type RdvStatut, type VueAgenda } from '@/lib/rendezvous/domaine';
import { agenda, collaborateursCommerciaux, rendezVousACloturer } from '@/lib/rendezvous/service';
import { Carte, classeBouton, classeChamp, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Agenda' };

const TON: Record<RdvStatut, 'bleu' | 'vert' | 'rouge' | 'neutre'> = { prevu: 'bleu', fait: 'vert', non_honore: 'rouge', annule: 'neutre' };
const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long' });
const libelleJour = (j: string) => FORMAT_JOUR.format(new Date(`${j}T12:00:00+01:00`));

type Params = { vue?: string; jour?: string; referent?: string; ville?: string };

export default async function Agenda({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'dossier.voir_siens') && !peut(c.roles, 'dossier.voir_tous')) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const p = await searchParams;
  const vue: VueAgenda = p.vue === 'jour' ? 'jour' : 'semaine';
  const aujourdhui = partiesDouala(new Date()).jour;
  const jour = p.jour && /^\d{4}-\d{2}-\d{2}$/.test(p.jour) ? p.jour : aujourdhui;
  const voirTous = peut(c.roles, 'dossier.voir_tous');
  const referentId = voirTous && p.referent ? p.referent : null;
  const villeId = p.ville && /^\d+$/.test(p.ville) ? Number(p.ville) : null;

  const { du, au, jours } = bornesAgenda(vue, jour);
  const [rdvs, aCloturer, collaborateurs, lieux] = await Promise.all([
    agenda({ du, au, referentId, villeId }, c),
    rendezVousACloturer(c),
    voirTous ? collaborateursCommerciaux() : [],
    listesLieux(),
  ]);

  const lien = (changements: Partial<Params>) => {
    const q = new URLSearchParams();
    const v = { vue, jour, referent: referentId ?? undefined, ville: villeId ? String(villeId) : undefined, ...changements };
    for (const [k, val] of Object.entries(v)) if (val) q.set(k, val);
    return `?${q}`;
  };
  const pas = vue === 'semaine' ? 7 : 1;

  return (
    <div className="space-y-4">
      <TitrePage titre="Agenda" description="Rendez-vous planifiés sur les dossiers (heure de Douala)." />

      {aCloturer.length > 0 && (
        <Carte titre="À relancer : rendez-vous à clôturer">
          <ul className="-my-1 divide-y divide-ink-100 text-sm">
            {aCloturer.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <Link href={`/admin/dossiers/${r.dossierId}`} className="rounded bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-700 hover:bg-brand-100 hover:text-brand-900">{r.numero}</Link>
                <span className="text-ink-800">{RDV_TYPES[r.type]} du {libelleDebut(r.debut)}</span>
                <span className="min-w-0 truncate text-ink-500">{r.client}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <nav aria-label="Vue" className="flex gap-1 rounded-lg bg-ink-100/80 p-1">
          {(['jour', 'semaine'] as const).map((v) => (
            <Link key={v} href={lien({ vue: v })} aria-current={v === vue ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${v === vue ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
              {v === 'jour' ? 'Jour' : 'Semaine'}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href={lien({ jour: decalerJour(jour, -pas) })} className={classeBouton('secondaire')} aria-label={vue === 'semaine' ? 'Semaine précédente' : 'Jour précédent'}><ChevronLeft aria-hidden className="h-4 w-4" /></Link>
          <Link href={lien({ jour: aujourdhui })} className={classeBouton('secondaire')}>Aujourd’hui</Link>
          <Link href={lien({ jour: decalerJour(jour, pas) })} className={classeBouton('secondaire')} aria-label={vue === 'semaine' ? 'Semaine suivante' : 'Jour suivant'}><ChevronRight aria-hidden className="h-4 w-4" /></Link>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name="vue" value={vue} />
          <input type="hidden" name="jour" value={jour} />
          {voirTous && (
            <select name="referent" defaultValue={referentId ?? ''} aria-label="Référent" className={classeChamp + ' w-auto'}>
              <option value="">Tous les référents</option>
              {collaborateurs.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
          )}
          <select name="ville" defaultValue={villeId ?? ''} aria-label="Ville" className={classeChamp + ' w-auto'}>
            <option value="">Toutes les villes</option>
            {lieux.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
          </select>
          <button type="submit" className={classeBouton('secondaire')}>Filtrer</button>
        </form>
      </div>

      <div className={vue === 'semaine' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4' : ''}>
        {jours.map((j) => {
          const duJour = rdvs.filter((r) => partiesDouala(r.debut).jour === j);
          return (
            <section key={j} aria-label={libelleJour(j)} className={`rounded-xl border bg-white p-3 shadow-sm ${j === aujourdhui ? 'border-primary/50' : 'border-ink-200/70'}`}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-ink-800">{libelleJour(j)}</h2>
              {duJour.length === 0 ? (
                <p className="text-xs text-ink-400">Aucun rendez-vous.</p>
              ) : (
                <ul className="space-y-2">
                  {duJour.map((r) => (
                    <li key={r.id} className="rounded-lg border border-ink-100 p-2 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CalendarClock aria-hidden className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold tabular-nums text-ink-900">{libelleHeure(r.debut)}</span>
                        <span className="text-ink-700">{RDV_TYPES[r.type]}</span>
                        {r.statut !== 'prevu' && <Pastille ton={TON[r.statut]}>{RDV_STATUTS[r.statut]}</Pastille>}
                      </div>
                      <Link href={`/admin/dossiers/${r.dossierId}`} className="mt-1 block truncate text-ink-800 hover:text-primary">
                        <span className="font-mono text-xs font-semibold">{r.numero}</span> · {r.client}
                      </Link>
                      {(r.lieu || r.ville) && <p className="truncate text-xs text-ink-500">{[r.lieu, r.ville].filter(Boolean).join(' · ')}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
