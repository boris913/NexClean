// POST-03 RG-05 : liste des dépenses (Responsable finances, Direction), filtrée par période et
// catégorie ; total des dépenses non annulées. Filtres dans l'URL.
import Link from 'next/link';
import { Paperclip, Plus, Receipt } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { formaterMontant } from '@/lib/devis/domaine';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { dateDuJour, MOYENS_PAIEMENT } from '@/lib/encaissements/domaine';
import { libellePeriode, periodeDepuis } from '@/lib/depenses/domaine';
import { listerCategories, listerDepenses } from '@/lib/depenses/service';
import { Carte, classeBouton, classeChamp, classeLibelle, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Dépenses' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;

const jour = (j: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${j}T00:00:00Z`));
const classeLigne = 'flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-3 sm:px-4 text-sm hover:bg-ink-50/60 focus-visible:bg-ink-50';

export default async function PageDepenses({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur({ permission: 'depense.saisir' });
  const p = await searchParams;
  const periode = periodeDepuis({ mois: p.mois, du: p.du, au: p.au }, dateDuJour());
  const categorieId = Number(p.categorie) || null;
  const annulees = p.annulees === '1';
  const acteur = { id: c.id, roles: c.roles, ip: c.ip };
  const [{ lignes, total, nombre, tronquee }, categories] = await Promise.all([listerDepenses({ ...periode, categorieId, annulees }, acteur), listerCategories()]);
  const exporter = peut(c.roles, 'export.donnees');

  return (
    <>
      <TitrePage titre="Dépenses" description="Sorties d’argent de l’agence, par date de dépense. Une erreur se corrige en modifiant ou en annulant la dépense : rien n’est supprimé.">
        {exporter && (
          <a href={`/admin/pilotage/export?du=${periode.du}&au=${periode.au}`} className={classeBouton('secondaire')}>
            Export comptable (CSV)
          </a>
        )}
        <Link href="/admin/depenses/nouvelle" className={classeBouton()}>
          <Plus aria-hidden className="h-4 w-4" /> Nouvelle dépense
        </Link>
      </TitrePage>

      <Carte>
        <form className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label htmlFor="du" className={classeLibelle}>Du</label>
            <input id="du" name="du" type="date" defaultValue={periode.du} className={classeChamp} />
          </div>
          <div>
            <label htmlFor="au" className={classeLibelle}>Au</label>
            <input id="au" name="au" type="date" defaultValue={periode.au} className={classeChamp} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="categorie" className={classeLibelle}>Catégorie</label>
            <select id="categorie" name="categorie" defaultValue={categorieId ?? ''} className={classeChamp}>
              <option value="">Toutes</option>
              {categories.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.libelle}
                  {k.actif ? '' : ' (désactivée)'}
                </option>
              ))}
            </select>
          </div>
          <label className="col-span-2 flex min-h-11 items-end gap-2 pb-2 text-sm sm:col-span-1">
            <input type="checkbox" name="annulees" value="1" defaultChecked={annulees} className="h-5 w-5 accent-primary" /> Voir les annulées
          </label>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
            <button type="submit" className={classeBouton()}>Filtrer</button>
            <Link href="/admin/depenses" className={classeBouton('secondaire')}>Mois en cours</Link>
          </div>
        </form>

        <p className="mb-3 text-sm text-ink-600">
          {libellePeriode(periode)} : <strong className="tabular-nums text-ink-900">{formaterMontant(total)}</strong> ({nombre} dépense{nombre > 1 ? 's' : ''}, annulées exclues)
        </p>

        {lignes.length === 0 ? (
          <EtatVide icone={Receipt} titre="Aucune dépense sur cette période." action={<Link href="/admin/depenses/nouvelle" className={classeBouton()}>Saisir une dépense</Link>} />
        ) : (
          <ul className="-mx-1 divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 sm:mx-0">
            {lignes.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/depenses/${d.id}`} className={classeLigne}>
                  <span className="min-w-0 space-y-0.5">
                    <span className={`block font-medium ${d.annuleeLe ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{d.libelle}</span>
                    <span className="block text-xs text-ink-500">
                      {jour(d.depenseLe)} · {d.categorie} · {MOYENS_PAIEMENT[d.moyen]}
                      {d.numeroDossier ? ` · ${d.numeroDossier}` : d.service ? ` · ${DOSSIER_TYPES[d.service]}` : ''}
                      {d.ville ? ` · ${d.ville}` : ''}
                      {d.auteurNom ? ` · ${d.auteurNom}` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {d.aJustificatif && <Paperclip aria-label="Justificatif joint" className="h-4 w-4 text-ink-400" />}
                    {d.annuleeLe && <Pastille ton="rouge">Annulée</Pastille>}
                    <span className={`tabular-nums font-semibold ${d.annuleeLe ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{formaterMontant(d.montant)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {tronquee && <p className="mt-2 text-xs text-ink-500">Seules les {lignes.length} dépenses les plus récentes sont affichées : précisez la période ou la catégorie.</p>}
      </Carte>
    </>
  );
}
