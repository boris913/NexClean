// RG-21 / RG-23 : liste des dossiers, filtrable, en cartes sur mobile.
import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { JOURS_SANS_ACTION, listerDossiers, sansActionDepuis, type FiltresDossiers } from '@/lib/dossiers/lecture';
import { PHASES, STATUTS, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import { getDb, schema } from '@/lib/db';
import { formatHorodatage } from '@/lib/audit-lecture';
import { classeBouton, classeChamp, classeLibelle, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Dossiers' };

type Params = Record<string, string | undefined>;

export default async function PageDossiers({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur();
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
      <TitrePage titre={tous ? 'Dossiers' : 'Mes dossiers'}>
        {peut(c.roles, 'dossier.traiter') && (
          <Link href="/admin/dossiers/nouveau" className={classeBouton()}>
            + Saisir une demande
          </Link>
        )}
      </TitrePage>

      <form className="bg-white border border-ink-100 rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <div>
          <label htmlFor="q" className="sr-only">Rechercher</label>
          <input id="q" name="q" type="search" defaultValue={filtres.q} placeholder="N° de dossier, client ou téléphone" className={classeChamp} />
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-primary py-2">Filtres</summary>
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
        <div className="flex gap-2">
          <button type="submit" className={classeBouton()}>Rechercher</button>
          <Link href="/admin/dossiers" className={classeBouton('secondaire')}>Réinitialiser</Link>
        </div>
      </form>

      <ul className="space-y-2">
        {lignes.length === 0 && <li className="text-sm text-ink-600">Aucun dossier.</li>}
        {lignes.map((d) => {
          const jours = sansActionDepuis(d.derniereActionLe);
          return (
            <li key={d.id}>
              <Link href={`/admin/dossiers/${d.id}`} className="block bg-white border border-ink-100 rounded-xl p-4 shadow-sm hover:border-primary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{d.numero}</span>
                  <Pastille ton={d.statut === 'a_completer' ? 'orange' : d.statut === 'refuse' || d.statut === 'sans_suite' ? 'rouge' : 'neutre'}>{STATUTS[d.statut]}</Pastille>
                </div>
                <p className="font-medium mt-1">{d.clientNom}</p>
                <p className="text-sm text-ink-600">
                  {DOSSIER_TYPES[d.type]}
                  {d.personnes > 0 && ` · ${d.personnes} personne${d.personnes > 1 ? 's' : ''}`}
                  {` · ${d.ville ?? d.villeAutre ?? 'Ville ?'}`}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-xs text-ink-500">
                  <span>{formatHorodatage(d.creeLe)}{tous && ` · ${d.referentNom ?? 'Non attribué'}`}</span>
                  {jours >= JOURS_SANS_ACTION && !['cloture', 'refuse', 'sans_suite'].includes(d.statut) && <Pastille ton="orange">Sans action depuis {jours} j</Pastille>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <nav className="flex justify-between mt-4">
        {page > 1 ? <Link href={lienPage(page - 1)} className={classeBouton('secondaire')}>← Précédents</Link> : <span />}
        {suivante && <Link href={lienPage(page + 1)} className={classeBouton('secondaire')}>Suivants →</Link>}
      </nav>
    </>
  );
}
