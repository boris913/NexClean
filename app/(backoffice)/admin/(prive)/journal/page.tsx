// M1-AUD-04 : consultation du journal d'audit (Direction, Administrateur).
import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { actionsConnues, formatHorodatage, lireJournal, type FiltresJournal } from '@/lib/audit-lecture';
import { getDb, schema } from '@/lib/db';
import { classeBouton, classeChamp, classeLibelle, EtatVide, Pagination, TitrePage } from '@/components/backoffice/ui';
import { ScrollText } from 'lucide-react';

export const metadata = { title: "Journal d'audit" };

type Params = Record<string, string | undefined>;

export default async function PageJournal({ searchParams }: { searchParams: Promise<Params> }) {
  await exigerCollaborateur({ permission: 'audit.consulter' });
  const p = await searchParams;
  const filtres: FiltresJournal = {
    du: p.du || undefined,
    au: p.au || undefined,
    acteur: p.acteur || undefined,
    action: p.action || undefined,
    objetType: p.objetType || undefined,
    objetId: p.objetId || undefined,
    page: Number(p.page) || 1,
  };
  const [{ lignes, suivante, page }, familles, collaborateurs] = await Promise.all([
    lireJournal(filtres),
    actionsConnues(),
    getDb().select({ id: schema.user.id, nom: schema.user.name }).from(schema.user).orderBy(asc(schema.user.name)),
  ]);
  const lienPage = (n: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter(([, v]) => v)), page: String(n) } as Record<string, string>)}`;

  return (
    <>
      <TitrePage titre="Journal d'audit" description="Toutes les actions sensibles, horodatées et non modifiables." />
      <form className="bg-white border border-ink-200/70 rounded-xl p-4 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div>
          <label htmlFor="du" className={classeLibelle}>Du</label>
          <input id="du" name="du" type="date" defaultValue={filtres.du} className={classeChamp} />
        </div>
        <div>
          <label htmlFor="au" className={classeLibelle}>Au</label>
          <input id="au" name="au" type="date" defaultValue={filtres.au} className={classeChamp} />
        </div>
        <div>
          <label htmlFor="acteur" className={classeLibelle}>Auteur</label>
          <select id="acteur" name="acteur" defaultValue={filtres.acteur ?? ''} className={classeChamp}>
            <option value="">Tous</option>
            {collaborateurs.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="action" className={classeLibelle}>Type d’action</label>
          <select id="action" name="action" defaultValue={filtres.action ?? ''} className={classeChamp}>
            <option value="">Toutes</option>
            {familles.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="objetType" className={classeLibelle}>Objet</label>
          <input id="objetType" name="objetType" defaultValue={filtres.objetType} placeholder="user, ville…" className={classeChamp} />
        </div>
        <div>
          <label htmlFor="objetId" className={classeLibelle}>Identifiant</label>
          <input id="objetId" name="objetId" defaultValue={filtres.objetId} className={classeChamp} />
        </div>
        <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
          <button type="submit" className={classeBouton()}>Filtrer</button>
          <Link href="/admin/journal" className={classeBouton('secondaire')}>Réinitialiser</Link>
        </div>
      </form>

      {lignes.length === 0 && <EtatVide icone={ScrollText} titre="Aucune entrée." description="Aucune action ne correspond à ces filtres." />}
      <ul className="overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-sm divide-y divide-ink-100">
        {lignes.map((l) => (
          <li key={l.id} className="p-3 sm:px-4 text-sm hover:bg-ink-50/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-medium text-ink-800">{l.action}</span>
              <span className="font-mono text-xs text-ink-500 tabular-nums">{formatHorodatage(l.horodatage)}</span>
            </div>
            <p className="mt-1.5 text-ink-700">
              {l.acteurNom ?? (l.acteurType === 'systeme' ? 'Système' : l.acteurType === 'anonyme' ? 'Anonyme' : l.acteurId ?? '—')}
              {l.objetType && (
                <span className="text-ink-500"> → {l.objetType} {l.objetId}</span>
              )}
              {l.ip && <span className="text-ink-400 text-xs"> · {l.ip}</span>}
            </p>
            {(l.avant != null || l.apres != null || l.details != null) && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-primary py-1">Détails</summary>
                <pre className="text-xs bg-ink-50 border border-ink-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify({ avant: l.avant ?? undefined, apres: l.apres ?? undefined, details: l.details ?? undefined }, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
      <Pagination page={page} suivante={suivante} lien={lienPage} libelles={['Plus récentes', 'Plus anciennes']} />
    </>
  );
}
