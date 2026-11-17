// POST-03 RG-08..RG-14 : tableau de bord direction (permission `finances.tableau_de_bord`).
// Indicateurs selon les définitions uniques de l'ADR 0020 §2, sur une période (mois en cours par
// défaut), calculés en SQL (lib/depenses/indicateurs.ts). Lecture seule.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Download, Hourglass, PieChart, Receipt } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { formaterMontant } from '@/lib/devis/domaine';
import { DOSSIER_TYPES } from '@/lib/domain/referentiels';
import { dateDuJour } from '@/lib/encaissements/domaine';
import { lienFinancesDossier } from '@/lib/encaissements/vue-finances';
import { libellePeriode, moisDe, moisPrecedent, periodeDepuis } from '@/lib/depenses/domaine';
import { tableauDirection } from '@/lib/depenses/indicateurs';
import { Carte, classeBouton, classeChamp, classeLibelle, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Pilotage' };
export const dynamic = 'force-dynamic';

type Params = Record<string, string | undefined>;

const jour = (j: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${j}T00:00:00Z`));
const classeListe = '-mx-1 divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-100 sm:mx-0';
const classeLigne = 'flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-3 sm:px-4 text-sm';

function Indicateur({ libelle, montant, definition, signe = false }: { libelle: string; montant: number; definition: ReactNode; signe?: boolean }) {
  const ton = signe ? (montant < 0 ? 'text-red-700' : 'text-leaf-700') : 'text-ink-900';
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink-200/70 bg-white p-4 shadow-sm">
      <span className="text-sm leading-tight text-ink-600">{libelle}</span>
      <span className={`font-display text-2xl font-semibold tabular-nums tracking-tight ${ton}`}>{formaterMontant(montant)}</span>
      <span className="text-xs text-ink-500">{definition}</span>
    </div>
  );
}

const pourcent = (t: number | null) => (t === null ? '—' : `${t} %`);

export default async function PagePilotage({ searchParams }: { searchParams: Promise<Params> }) {
  const c = await exigerCollaborateur({ permission: 'finances.tableau_de_bord' });
  const p = await searchParams;
  const aujourdhui = dateDuJour();
  const periode = periodeDepuis({ mois: p.mois, du: p.du, au: p.au }, aujourdhui);
  const t = await tableauDirection(periode);
  const i = t.indicateurs;
  const exporter = peut(c.roles, 'export.donnees');
  const enCours = moisDe(aujourdhui);
  const precedent = moisPrecedent(aujourdhui);
  const lien = (x: { du: string; au: string }) => `/admin/pilotage?du=${x.du}&au=${x.au}`;
  const chargesGenerales = t.sommes.depenses - t.margesServices.reduce((s, m) => s + m.depenses, 0);

  return (
    <>
      <TitrePage titre="Pilotage" description={`Indicateurs de la direction — ${libellePeriode(periode)}. Définitions de l’ADR 0020 : facturation, encaissement, dépense et résultat restent distincts.`}>
        {exporter && (
          <a href={`/admin/pilotage/export?du=${periode.du}&au=${periode.au}`} className={classeBouton('secondaire')}>
            <Download aria-hidden className="h-4 w-4" /> Export comptable (CSV)
          </a>
        )}
        {peut(c.roles, 'depense.saisir') && (
          <Link href="/admin/depenses/nouvelle" className={classeBouton()}>
            <Receipt aria-hidden className="h-4 w-4" /> Saisir une dépense
          </Link>
        )}
      </TitrePage>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href={lien(enCours)} aria-current={periode.du === enCours.du && periode.au === enCours.au ? 'page' : undefined} className={classeBouton(periode.du === enCours.du && periode.au === enCours.au ? 'principal' : 'secondaire')}>
            Mois en cours
          </Link>
          <Link href={lien(precedent)} aria-current={periode.du === precedent.du && periode.au === precedent.au ? 'page' : undefined} className={classeBouton(periode.du === precedent.du && periode.au === precedent.au ? 'principal' : 'secondaire')}>
            Mois précédent
          </Link>
          <Link href={lien({ du: `${aujourdhui.slice(0, 4)}-01-01`, au: aujourdhui })} className={classeBouton('secondaire')}>
            Depuis le 1er janvier
          </Link>
        </div>
        <div>
          <label htmlFor="du" className={classeLibelle}>Du</label>
          <input id="du" name="du" type="date" defaultValue={periode.du} className={classeChamp} />
        </div>
        <div>
          <label htmlFor="au" className={classeLibelle}>Au</label>
          <input id="au" name="au" type="date" defaultValue={periode.au} className={classeChamp} />
        </div>
        <button type="submit" className={classeBouton('secondaire')}>Afficher</button>
      </form>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur libelle="Facturé TTC" montant={i.factureTtc} definition={`Factures émises sur la période, avoirs déduits (${formaterMontant(t.sommes.avoirsTtc)} d’avoirs). HT : ${formaterMontant(i.factureHt)}.`} />
        <Indicateur libelle="Encaissé" montant={i.encaisse} definition="Encaissements reçus sur la période, annulations et remboursements déduits (hors crédit client)." />
        <Indicateur libelle="Dépenses" montant={i.depenses} definition={<Link href={`/admin/depenses?du=${periode.du}&au=${periode.au}`} className="underline-offset-2 hover:underline">Dépenses saisies, par date de dépense (annulées exclues).</Link>} />
        <Indicateur libelle="Résultat mensuel estimé" montant={i.resultatEstime} signe definition="Facturé HT − Dépenses. Indicatif, non comptable." />
        <Indicateur libelle="Trésorerie du mois" montant={i.tresorerie} signe definition="Encaissé − Dépenses payées." />
        <Indicateur libelle="Impayés" montant={t.impayes.total} definition={`Facturé non encaissé au ${jour(t.impayes.arrete)}, toutes périodes d’émission confondues.`} />
      </div>

      <div className="space-y-5">
        <div id="impayes" className="scroll-mt-20">
          <Carte titre="Impayés par ancienneté" description={`Au ${jour(t.impayes.arrete)} : part de chaque facture non couverte par les encaissements et avoirs de son dossier (les plus anciennes factures sont réglées en premier).`}>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {t.impayes.tranches.map((tr) => (
                <div key={tr.code} className={`rounded-lg border p-3 ${tr.code === 'plus_90' && tr.montant > 0 ? 'border-red-200 bg-red-50/50' : 'border-ink-100'}`}>
                  <p className="text-xs text-ink-500">{tr.libelle}</p>
                  <p className="font-semibold tabular-nums text-ink-900">{formaterMontant(tr.montant)}</p>
                  <p className="text-xs text-ink-500">{tr.nombre} facture{tr.nombre > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
            {t.impayes.factures.length === 0 ? (
              <EtatVide icone={Hourglass} titre="Aucune facture impayée." />
            ) : (
              <ul className={classeListe}>
                {t.impayes.factures.map((f) => (
                  <li key={f.factureId}>
                    <Link href={lienFinancesDossier(f.dossierId)} className={`${classeLigne} hover:bg-ink-50/60`}>
                      <span className="min-w-0 space-y-0.5">
                        <span className="block">
                          <span className="font-mono text-xs font-semibold text-ink-800">{f.numeroDossier}</span>
                          <span className="text-ink-600"> · {f.clientNom}</span>
                        </span>
                        <span className="block text-xs text-ink-500">
                          {f.numero} émise le {jour(f.emiseLe)} · {formaterMontant(f.totalTtc)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Pastille ton={f.ancienneteJours > 90 ? 'rouge' : f.ancienneteJours > 30 ? 'orange' : 'neutre'}>{f.ancienneteJours} j</Pastille>
                        <span className="font-semibold tabular-nums">{formaterMontant(f.restant)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Carte titre="Marge par service" description="Facturé HT − dépenses rattachées au service (par leur dossier ou directement).">
            {t.margesServices.length === 0 ? (
              <EtatVide icone={PieChart} titre="Rien de facturé ni de rattaché sur la période." />
            ) : (
              <div className="-mx-1 overflow-x-auto sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-3 font-medium">Service</th>
                      <th className="py-2 pr-3 text-right font-medium">Facturé HT</th>
                      <th className="py-2 pr-3 text-right font-medium">Dépenses</th>
                      <th className="py-2 pr-3 text-right font-medium">Marge</th>
                      <th className="py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 tabular-nums">
                    {t.margesServices.map((m) => (
                      <tr key={m.service}>
                        <td className="py-2 pr-3">{DOSSIER_TYPES[m.service]}</td>
                        <td className="py-2 pr-3 text-right">{formaterMontant(m.factureHt)}</td>
                        <td className="py-2 pr-3 text-right">{formaterMontant(m.depenses)}</td>
                        <td className={`py-2 pr-3 text-right font-semibold ${m.marge < 0 ? 'text-red-700' : ''}`}>{formaterMontant(m.marge)}</td>
                        <td className="py-2 text-right">{pourcent(m.taux)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-500">Charges générales (sans service) : {formaterMontant(chargesGenerales)}.</p>
              </div>
            )}
          </Carte>

          <Carte titre="Dépenses par catégorie">
            {t.depensesParCategorie.length === 0 ? (
              <EtatVide icone={Receipt} titre="Aucune dépense sur la période." />
            ) : (
              <ul className={classeListe}>
                {t.depensesParCategorie.map((d) => (
                  <li key={d.categorieId}>
                    <Link href={`/admin/depenses?du=${periode.du}&au=${periode.au}&categorie=${d.categorieId}`} className={`${classeLigne} hover:bg-ink-50/60`}>
                      <span>
                        {d.libelle} <span className="text-xs text-ink-500">({d.nombre})</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formaterMontant(d.montant)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <Carte titre="Marge par dossier" description="Dossiers facturés ou ayant des dépenses rattachées sur la période : Facturé HT − dépenses rattachées.">
          {t.margesDossiers.length === 0 ? (
            <EtatVide icone={PieChart} titre="Aucun dossier facturé ni dépense rattachée sur la période." />
          ) : (
            <div className="-mx-1 overflow-x-auto sm:mx-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                    <th className="py-2 pr-3 font-medium">Dossier</th>
                    <th className="py-2 pr-3 text-right font-medium">Facturé HT</th>
                    <th className="py-2 pr-3 text-right font-medium">Dépenses</th>
                    <th className="py-2 pr-3 text-right font-medium">Marge</th>
                    <th className="py-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 tabular-nums">
                  {t.margesDossiers.map((m) => (
                    <tr key={m.dossierId}>
                      <td className="py-2 pr-3">
                        <Link href={lienFinancesDossier(m.dossierId)} className="font-mono text-xs font-semibold text-ink-800 hover:text-primary">
                          {m.numero}
                        </Link>
                        <span className="block text-xs text-ink-500">{m.clientNom}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">{formaterMontant(m.factureHt)}</td>
                      <td className="py-2 pr-3 text-right">{formaterMontant(m.depenses)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${m.marge < 0 ? 'text-red-700' : ''}`}>{formaterMontant(m.marge)}</td>
                      <td className="py-2 text-right">{pourcent(m.taux)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      </div>
    </>
  );
}
