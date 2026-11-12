// COM4-01 RG-11 : écran Veille — pistes triées par score, filtres dans l'URL, actions en un clic.
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { iaActive } from '@/lib/ia/client';
import { listesLieux } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { listerPistes, canalParDefaut, type FiltresPistes } from '@/lib/veille/service';
import { CANAUX_CONTACT, MOTIFS_ECART, STATUTS_PISTE, relancePossible, type CanalContact, type MotifEcart, type StatutPiste } from '@/lib/veille/domaine';
import { formaterTelephone } from '@/lib/telephone';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Carte, classeBouton, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';
import { Radar } from 'lucide-react';
import { ActionsPiste, AjouterPiste } from './Composants';

export const metadata = { title: 'Veille' };
export const dynamic = 'force-dynamic';

const ONGLETS = { a_traiter: 'À traiter', nouvelle: 'Nouvelles', retenue: 'Retenues', contactee: 'Contactées', convertie: 'Converties', ecartee: 'Écartées', toutes: 'Toutes' } as const;
const TYPES = ['REC', 'MAD', 'NET', 'EV', 'ABO'] as const;
const tonStatut = (s: StatutPiste) => (s === 'convertie' ? 'vert' : s === 'ecartee' || s === 'sans_suite' ? 'neutre' : s === 'retenue' || s === 'contactee' || s === 'en_conversation' ? 'bleu' : 'orange');
const tonScore = (n: number | null) => (n === null ? 'neutre' : n >= 70 ? 'vert' : n >= 40 ? 'orange' : 'neutre');

export default async function Veille({ searchParams }: { searchParams: Promise<{ statut?: string; ville?: string; type?: string; mes?: string }> }) {
  const c = await exigerCollaborateur({ permission: 'veille.utiliser' });
  const p = await searchParams;
  const statut = (p.statut && p.statut in ONGLETS ? p.statut : 'a_traiter') as keyof typeof ONGLETS;
  const type = TYPES.find((t) => t === p.type);
  const villeId = Number(p.ville) || undefined;
  const filtres: FiltresPistes = { statut, villeId, type, mes: p.mes === '1' };
  const [pistes, lieux, delai] = await Promise.all([listerPistes(filtres, { id: c.id, roles: c.roles }), listesLieux(), lireParametre('veille_delai_relance_jours')]);
  const maintenant = new Date();
  const lien = (x: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ statut, ville: p.ville, type: p.type, mes: p.mes, ...x }).filter((e): e is [string, string] => !!e[1]))}`;
  const ia = iaActive();

  return (
    <div className="space-y-5">
      <TitrePage titre="Veille" description="Besoins de personnel repérés en ligne. Le premier contact se fait toujours par un humain, sur le canal d’origine.">
        {peut(c.roles, 'veille.gerer') && (
          <Link href="/admin/veille/sources" className={classeBouton('secondaire')}>
            Sources
          </Link>
        )}
      </TitrePage>
      <AjouterPiste iaConfiguree={ia} />

      <nav aria-label="Statut" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-ink-100/80 p-1">
        {(Object.keys(ONGLETS) as (keyof typeof ONGLETS)[]).map((k) => (
          <Link key={k} href={lien({ statut: k })} aria-current={k === statut ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${k === statut ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
            {ONGLETS[k]}
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap items-end gap-2 text-sm" action="/admin/veille">
        <input type="hidden" name="statut" value={statut} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-500">Ville</span>
          <select name="ville" defaultValue={p.ville ?? ''} className="min-h-11 rounded-lg border border-ink-200 bg-white px-2">
            <option value="">Toutes</option>
            {lieux.filter((v) => v.couverte).map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-500">Service</span>
          <select name="type" defaultValue={p.type ?? ''} className="min-h-11 rounded-lg border border-ink-200 bg-white px-2">
            <option value="">Tous</option>
            {TYPES.map((t) => <option key={t} value={t}>{DOSSIER_TYPES[t]}</option>)}
          </select>
        </label>
        {peut(c.roles, 'veille.gerer') && (
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="mes" value="1" defaultChecked={p.mes === '1'} className="h-5 w-5 accent-primary" /> Mes pistes
          </label>
        )}
        <button type="submit" className="min-h-11 rounded-lg border border-ink-200 bg-white px-3 font-medium text-ink-700 hover:bg-ink-50">Filtrer</button>
      </form>

      {pistes.length === 0 ? (
        <EtatVide icone={Radar} titre="Aucune piste." description="Ajoutez une publication repérée sur un réseau social ou un site d’annonces." />
      ) : (
        <ul className="space-y-3">
          {pistes.map((x) => {
            const relance = relancePossible(x.contacts, maintenant, delai);
            const lieu = [x.quartier ?? x.lieuTexte, x.ville].filter(Boolean).join(', ');
            return (
              <li key={x.id}>
                <Carte>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-700">{x.reference}</span>
                      <Pastille ton={tonScore(x.score)}>{x.score === null ? 'Non noté' : `Score ${x.score}`}</Pastille>
                      <Pastille ton={tonStatut(x.statut)}>{STATUTS_PISTE[x.statut]}</Pastille>
                      {x.motifEcart && <span className="text-xs text-ink-500">{MOTIFS_ECART[x.motifEcart as MotifEcart] ?? x.motifEcart}</span>}
                      {x.type && <span className="text-xs font-medium text-ink-700">{DOSSIER_TYPES[x.type]}</span>}
                      {x.source !== 'saisie_assistee' && <span className="text-xs text-ink-500">collecte {x.sourceNom ?? ''}{x.requete ? ` · « ${x.requete} »` : ''}</span>}
                      {lieu && <span className="text-xs text-ink-600">{lieu}</span>}
                      <span className="ml-auto text-xs text-ink-400">{formatHorodatage(x.creeLe)}{x.assigne && ` · ${x.assigne}`}</span>
                    </div>
                    {x.besoin && <p className="font-medium text-ink-900">{x.besoin}{x.effectif ? ` (${x.effectif} pers.)` : ''}</p>}
                    {x.justification && <p className="text-xs text-ink-500">{x.justification}</p>}
                    <details>
                      <summary className="cursor-pointer text-xs text-primary">Publication{x.url && ' et lien'}</summary>
                      <p className="mt-1 whitespace-pre-line rounded-lg bg-ink-50 p-2 text-ink-700">{x.extrait}</p>
                      {x.url && (
                        <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block break-all text-xs text-primary hover:underline">
                          {x.url}
                        </a>
                      )}
                    </details>
                    {(x.contactNom || x.contactEmail || x.contactTelephone) && (
                      // RG-08 : coordonnées affichées en texte seul — pas de lien WhatsApp ni d'appel direct.
                      <p className="text-xs text-ink-600">
                        Contact publié : {[x.contactNom, x.contactEmail, x.contactTelephone && formaterTelephone(x.contactTelephone)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {x.contacts.length > 0 && (
                      <p className="text-xs text-ink-500">
                        {x.contacts.map((k) => `${k.type === 'premier' ? 'Contactée' : 'Relancée'} le ${formatHorodatage(k.creeLe)} (${CANAUX_CONTACT[k.canal as CanalContact] ?? k.canal})`).join(' · ')}
                      </p>
                    )}
                    {x.dossierId && (
                      <Link href={`/admin/dossiers/${x.dossierId}`} className="text-xs font-medium text-primary hover:underline">
                        Voir le dossier créé →
                      </Link>
                    )}
                    {x.statut !== 'convertie' && <ActionsPiste key={`${x.id}-${x.statut}-${x.message ?? ''}`} piste={{ id: x.id, reference: x.reference, statut: x.statut, message: x.message, canalDefaut: canalParDefaut(x), relance, contactEmail: x.contactEmail }} iaConfiguree={ia} />}
                  </div>
                </Carte>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
