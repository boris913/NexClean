// COM1-02 RG-10 : un rapport hebdomadaire (instantané figé à sa génération).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { lireRapport } from '@/lib/commercial/rapport-service';
import { lignesIndicateurs, titreRapport } from '@/lib/commercial/rapport';
import { libelleDuree } from '@/lib/commercial/indicateurs';
import { libelleDebut, RDV_TYPES } from '@/lib/rendezvous/domaine';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Carte, EtatVide, TitrePage } from '@/components/backoffice/ui';

const Numero = ({ id, numero }: { id: number; numero: string }) => (
  <Link href={`/admin/dossiers/${id}`} className="rounded bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-700 hover:bg-brand-100 hover:text-brand-900">{numero}</Link>
);

function Liste<T>({ titre, vide, items, rendu }: { titre: string; vide: string; items: T[]; rendu: (x: T) => React.ReactNode }) {
  return (
    <Carte titre={`${titre} (${items.length})`}>
      {items.length === 0 ? <p className="text-sm text-ink-500">{vide}</p> : <ul className="-my-1 divide-y divide-ink-100 text-sm">{items.map((x, i) => <li key={i} className="flex flex-wrap items-center gap-2 py-2">{rendu(x)}</li>)}</ul>}
    </Carte>
  );
}

export default async function Rapport({ params }: { params: Promise<{ semaine: string }> }) {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'commercial.tableau_de_bord')) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const r = await lireRapport((await params).semaine, c);
  if (!r) notFound();
  const x = r.contenu;
  return (
    <div className="space-y-4">
      <TitrePage titre={titreRapport(x)} description={`${x.portee === 'referent' ? 'Vos dossiers · ' : ''}Généré le ${formatHorodatage(r.genereLe)}`} retour={{ href: '/admin/commercial/rapports', libelle: 'Rapports' }} />
      <Carte titre="Indicateurs" description="Entre parenthèses : l’écart par rapport à la semaine précédente.">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&>div]:border-b [&>div]:border-ink-100 [&>div]:pb-2">
          {lignesIndicateurs(x).map(([k, v]) => (
            <div key={k}><dt className="text-ink-600">{k}</dt><dd className="text-right font-medium tabular-nums text-ink-900">{v}</dd></div>
          ))}
        </dl>
      </Carte>
      {x.commentaire && <Carte titre="Commentaire"><p className="whitespace-pre-line text-sm text-ink-700">{x.commentaire}</p></Carte>}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Liste titre="Meilleures sources" vide="Aucun nouveau prospect." items={x.topSources} rendu={(s) => <><span className="flex-1 text-ink-800">{s.libelle}</span><span className="tabular-nums text-ink-600">{s.nouveaux} prospect(s) · {s.acceptes} accepté(s)</span></>} />
        <Liste titre="Sans réponse depuis plus de 24 h" vide="Aucune demande en souffrance." items={x.enSouffrance} rendu={(d) => <><Numero id={d.dossierId} numero={d.numero} /><span className="text-ink-600">{libelleDuree(d.ancienneteH * 60)}</span></>} />
        <Liste titre={`Sans action depuis ${x.joursSansAction} jours ou plus`} vide="Aucun dossier à relancer." items={x.sansAction} rendu={(d) => <><Numero id={d.dossierId} numero={d.numero} /><span className="text-ink-600">{d.jours} j</span></>} />
        <Liste titre="Rendez-vous à clôturer" vide="Aucun." items={x.aCloturer} rendu={(v) => <><Numero id={v.dossierId} numero={v.numero} /><span className="text-ink-700">{RDV_TYPES[v.type]} du {libelleDebut(new Date(v.debut))}</span></>} />
        <Liste titre="Rendez-vous de la semaine" vide="Aucun rendez-vous prévu." items={x.aVenir} rendu={(v) => <><span className="text-ink-800">{libelleDebut(new Date(v.debut))}</span><span className="text-ink-600">{RDV_TYPES[v.type]}</span><Numero id={v.dossierId} numero={v.numero} />{v.ville && <span className="text-xs text-ink-500">{v.ville}</span>}</>} />
      </div>
    </div>
  );
}
