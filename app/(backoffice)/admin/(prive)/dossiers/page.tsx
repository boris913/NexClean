// RG-21 / RG-23 : liste des dossiers, filtrable, en cartes sur mobile. Vue de pilotage
// (Direction, Finances) : tableau dense sur grand écran (≥ xl), cartes en dessous.
import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listerDossiers, sansActionDepuis, type FiltresDossiers } from '@/lib/dossiers/lecture';
import { lireParametre } from '@/lib/parametres';
import { PHASES, STATUTS, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import { getDb, schema } from '@/lib/db';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Clock, FolderOpen, MapPin, Plus, Search, SlidersHorizontal, User, Users } from 'lucide-react';
import { classeBouton, classeCarteLien, classeChamp, classeLibelle, classeSurface, EtatVide, Pagination, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Dossiers' };

const dateCourte = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', day: '2-digit', month: '2-digit', year: '2-digit' });
const tonStatut = (s: string) => (s === 'a_completer' ? 'orange' : s === 'refuse' || s === 'sans_suite' ? 'rouge' : 'neutre') as 'orange' | 'rouge' | 'neutre';

type Params = Record<string, string | undefined>;

export default async function PageDossiers({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur();
  const joursSansAction = await lireParametre('jours_sans_action');
  if (!peut(c.roles, 'dossier.voir_siens') && !peut(c.roles, 'dossier.voir_tous')) forbidden();
  const tous = peut(c.roles, 'dossier.voir_tous');
  const p = await searchParams;
  const filtres: FiltresDossiers = {
    q: p.q || undefined,
    type: DOSSIER_TYPE_CODES.includes(p.type as DossierType) ? (p.type as DossierType) : undefined,
    phase: p.phase && p.phase in PHASES ? (p.phase as Phase) : undefined,
    villeId: Number(p.ville) || undefined,
    referentId: tous ? p.referent || undefined : undefined,
    du: p.du || undefined,
    au: p.au || undefined,
    tri: p.tri === 'action' ? 'action' : 'creation',
    page: Number(p.page) || 1,
  };
  const db = getDb();
  const [{ lignes, suivante, page }, villes, referents] = await Promise.all([
    listerDossiers(c, filtres),
    db.select({ id: schema.ville.id, nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.actif, true)).orderBy(asc(schema.ville.ordre)),
    tous
      ? db
          .selectDistinct({ id: schema.user.id, nom: schema.user.name })
          .from(schema.user)
          .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
          .where(eq(schema.collaborateurRole.role, 'referent'))
          .orderBy(asc(schema.user.name))
      : Promise.resolve([]),
  ]);
  const lienPage = (n: number) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>), page: String(n) })}`;

  return (
    <>
      <TitrePage titre={tous ? 'Dossiers' : 'Mes dossiers'} description={tous ? 'Tous les dossiers clients, du plus récent au plus ancien.' : 'Les dossiers qui vous sont attribués.'}>
        {peut(c.roles, 'dossier.traiter') && (
          <Link href="/admin/dossiers/nouveau" className={classeBouton()}>
            <Plus aria-hidden className="h-4 w-4" /> Saisir une demande
          </Link>
        )}
      </TitrePage>

      <form className={`${classeSurface} p-4 mb-5 space-y-3`}>
        <div>
          <label htmlFor="q" className="sr-only">Rechercher</label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input id="q" name="q" type="search" defaultValue={filtres.q} placeholder="N° de dossier, client ou téléphone" className={`${classeChamp} pl-9`} />
          </div>
        </div>
        <details>
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg py-2 text-sm font-medium text-ink-700 hover:text-primary [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden className="h-4 w-4" /> Filtres
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label htmlFor="type" className={classeLibelle}>Type</label>
              <select id="type" name="type" defaultValue={filtres.type ?? ''} className={classeChamp}>
                <option value="">Tous</option>
                {DOSSIER_TYPE_CODES.map((t) => <option key={t} value={t}>{DOSSIER_TYPES[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="phase" className={classeLibelle}>Phase</label>
              <select id="phase" name="phase" defaultValue={filtres.phase ?? ''} className={classeChamp}>
                <option value="">Toutes</option>
                {(Object.keys(PHASES) as Phase[]).map((ph) => <option key={ph} value={ph}>{PHASES[ph]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ville" className={classeLibelle}>Ville</label>
              <select id="ville" name="ville" defaultValue={p.ville ?? ''} className={classeChamp}>
                <option value="">Toutes</option>
                {villes.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
            </div>
            {tous && (
              <div>
                <label htmlFor="referent" className={classeLibelle}>Référent</label>
                <select id="referent" name="referent" defaultValue={p.referent ?? ''} className={classeChamp}>
                  <option value="">Tous</option>
                  <option value="aucun">Non attribués</option>
                  {referents.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="du" className={classeLibelle}>Créés du</label>
              <input id="du" name="du" type="date" defaultValue={filtres.du} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="au" className={classeLibelle}>au</label>
              <input id="au" name="au" type="date" defaultValue={filtres.au} className={classeChamp} />
            </div>
            <div>
              <label htmlFor="tri" className={classeLibelle}>Tri</label>
              <select id="tri" name="tri" defaultValue={filtres.tri} className={classeChamp}>
                <option value="creation">Plus récents</option>
                <option value="action">Dernière action</option>
              </select>
            </div>
          </div>
        </details>
        <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
          <button type="submit" className={classeBouton()}>Rechercher</button>
          <Link href="/admin/dossiers" className={classeBouton('secondaire')}>Réinitialiser</Link>
        </div>
      </form>

      {lignes.length === 0 && (
        <EtatVide
          icone={FolderOpen}
          titre="Aucun dossier."
          description={Object.values(p).some(Boolean) ? 'Aucun dossier ne correspond à cette recherche. Modifiez ou retirez des filtres.' : 'Les demandes reçues du site et les saisies apparaîtront ici.'}
          action={
            Object.values(p).some(Boolean) ? (
              <Link href="/admin/dossiers" className={classeBouton('secondaire')}>
                Réinitialiser les filtres
              </Link>
            ) : undefined
          }
        />
      )}
      {tous && lignes.length > 0 && (
        <div className={`${classeSurface} hidden overflow-x-auto xl:block`}>
          <table className="w-full text-sm">
            <caption className="sr-only">Dossiers, page {page}</caption>
            <thead className="border-b border-ink-200 bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th scope="col" className="px-3 py-2.5">N°</th>
                <th scope="col" className="px-3 py-2.5">Client</th>
                <th scope="col" className="px-3 py-2.5">Type</th>
                <th scope="col" className="px-3 py-2.5 text-right">Pers.</th>
                <th scope="col" className="px-3 py-2.5">Ville</th>
                <th scope="col" className="px-3 py-2.5">Statut</th>
                <th scope="col" className="px-3 py-2.5">Référent</th>
                <th scope="col" className="px-3 py-2.5">Créé le</th>
                <th scope="col" className="px-3 py-2.5">Dernière action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {lignes.map((d) => {
                const jours = sansActionDepuis(d.derniereActionLe);
                const enRetard = jours >= joursSansAction && !['cloture', 'refuse', 'sans_suite'].includes(d.statut);
                return (
                  <tr key={d.id} className="relative hover:bg-brand-50/60 focus-within:bg-brand-50/60">
                    <td className="whitespace-nowrap px-3 py-2">
                      {/* Le lien couvre toute la ligne (after:absolute) : un seul arrêt de tabulation par dossier. */}
                      <Link href={`/admin/dossiers/${d.id}`} className="font-mono text-xs font-semibold text-ink-800 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-400">
                        {d.numero}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2 font-medium text-ink-900" title={d.clientNom}>{d.clientNom}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink-600"><abbr title={DOSSIER_TYPES[d.type]} className="no-underline">{d.type}</abbr></td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{d.personnes > 0 ? d.personnes : '—'}</td>
                    <td className="max-w-[9rem] truncate px-3 py-2 text-ink-600">{d.ville ?? d.villeAutre ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <Pastille ton={tonStatut(d.statut)} point>{STATUTS[d.statut]}</Pastille>
                    </td>
                    <td className={`max-w-[9rem] truncate px-3 py-2 ${d.referentNom ? 'text-ink-600' : 'font-medium text-amber-700'}`}>{d.referentNom ?? 'Non attribué'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-600">{dateCourte.format(d.creeLe)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {enRetard ? <Pastille ton="orange">{jours} j sans action</Pastille> : <span className="text-ink-600">{jours === 0 ? 'Aujourd’hui' : `Il y a ${jours} j`}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ul className={`grid gap-3 lg:grid-cols-2${tous ? ' xl:hidden' : ''}`}>
        {lignes.map((d) => {
          const jours = sansActionDepuis(d.derniereActionLe);
          return (
            <li key={d.id}>
              <Link href={`/admin/dossiers/${d.id}`} className={`${classeCarteLien} group h-full`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-ink-700">{d.numero}</span>
                  <Pastille ton={tonStatut(d.statut)} point>
                    {STATUTS[d.statut]}
                  </Pastille>
                </div>
                <p className="mt-2.5 font-semibold text-ink-900 break-words group-hover:text-primary">{d.clientNom}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
                  <span>{DOSSIER_TYPES[d.type]}</span>
                  {d.personnes > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                      {`${d.personnes} personne${d.personnes > 1 ? 's' : ''}`}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                    {d.ville ?? d.villeAutre ?? 'Ville ?'}
                  </span>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
                  <span className="inline-flex flex-wrap items-center gap-x-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden className="h-3.5 w-3.5" />
                      {formatHorodatage(d.creeLe)}
                    </span>
                    {tous && (
                      <span className="inline-flex items-center gap-1">
                        <User aria-hidden className="h-3.5 w-3.5" />
                        {d.referentNom ?? 'Non attribué'}
                      </span>
                    )}
                  </span>
                  {jours >= joursSansAction && !['cloture', 'refuse', 'sans_suite'].includes(d.statut) && <Pastille ton="orange">Sans action depuis {jours} j</Pastille>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <Pagination page={page} suivante={suivante} lien={lienPage} />
    </>
  );
}
