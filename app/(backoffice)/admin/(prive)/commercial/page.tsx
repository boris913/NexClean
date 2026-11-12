// COM1-02 RG-05..08 : tableau de bord commercial. Période et ventilation dans l'URL.
import Link from 'next/link';
import { AlertTriangle, Download, FileBarChart } from 'lucide-react';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { bornesPeriode, PERIODES, type Periode } from '@/lib/dossiers/compteurs';
import { formaterMontant } from '@/lib/devis/domaine';
import { DIMENSIONS, demandesEnAttente, entonnoir, libelleDuree, totaux, ventiler, type Dimension, type EtapeEntonnoir } from '@/lib/commercial/indicateurs';
import { lignesCommerciales, voitTout } from '@/lib/commercial/service';
import { Carte, classeBouton, EtatVide, Pastille, TitrePage } from '@/components/backoffice/ui';
import { indicateursAgent } from '@/lib/ia/indicateurs-agent';
import { MOTIFS_PASSAGE } from '@/lib/ia/agent-regles';
import { indicateursVeille } from '@/lib/veille/indicateurs';

export const metadata = { title: 'Commercial' };

function Indicateur({ valeur, libelle, detail, alerte = false }: { valeur: string; libelle: string; detail?: string; alerte?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${alerte ? 'border-amber-300' : 'border-ink-200/70'}`}>
      <p className={`text-2xl font-semibold tabular-nums ${alerte ? 'text-amber-800' : 'text-ink-900'}`}>{valeur}</p>
      <p className="mt-1 text-sm text-ink-600">{libelle}</p>
      {detail && <p className="mt-0.5 text-xs text-ink-400">{detail}</p>}
    </div>
  );
}

function BarreEntonnoir({ e, max }: { e: EtapeEntonnoir; max: number }) {
  const etapes = [
    { libelle: 'Dossiers', n: e.dossiers },
    { libelle: 'Devis envoyé', n: e.devis },
    { libelle: 'Accepté', n: e.acceptes },
    { libelle: 'Encaissé', n: e.encaisses },
  ];
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink-800">{e.libelle}</p>
      <dl className="space-y-1">
        {etapes.map((x) => (
          <div key={x.libelle} className="grid grid-cols-[6.5rem,1fr,2.5rem] items-center gap-2 text-xs">
            <dt className="text-ink-500">{x.libelle}</dt>
            <dd className="h-2.5 rounded-full bg-ink-100">
              <div className="h-2.5 rounded-full bg-primary" style={{ width: `${max ? Math.max((x.n / max) * 100, x.n ? 2 : 0) : 0}%` }} />
            </dd>
            <dd className="text-right font-semibold tabular-nums text-ink-800">{x.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function Commercial({ searchParams }: { searchParams: Promise<{ periode?: string; dim?: string }> }) {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'commercial.tableau_de_bord')) return <EtatVide titre="Accès réservé aux référents et à la Direction." />;
  const p = await searchParams;
  const periode: Periode = p.periode && p.periode in PERIODES ? (p.periode as Periode) : 'mois';
  const dim: Dimension = p.dim && p.dim in DIMENSIONS ? (p.dim as Dimension) : 'source';
  const maintenant = new Date();
  const { du, au } = bornesPeriode(periode, maintenant);
  const lignes = await lignesCommerciales({ du, au }, c);
  const ctx = { du, au, maintenant };
  const t = totaux(lignes, ctx);
  const ventilation = ventiler(lignes, dim, ctx);
  const funnel = entonnoir(lignes, ctx);
  const attente = demandesEnAttente(lignes, maintenant);
  // COM3-02 RG-09 : indicateurs de l'assistant virtuel (Direction), s'il a eu de l'activité.
  const agent = voitTout(c) ? await indicateursAgent({ du, au }) : null;
  // COM4-01 RG-12 : veille prospects par source et par requête (Direction).
  const veille = voitTout(c) ? await indicateursVeille({ du, au }) : null;
  const lien = (x: { periode?: Periode; dim?: Dimension }) => `?${new URLSearchParams({ periode: x.periode ?? periode, dim: x.dim ?? dim })}`;
  const dimensions = (Object.keys(DIMENSIONS) as Dimension[]).filter((d) => d !== 'referent' || voitTout(c));

  return (
    <div className="space-y-5">
      <TitrePage titre="Commercial" description={voitTout(c) ? 'Prospects, devis, contrats et chiffre d’affaires.' : 'Vos dossiers : prospects, devis, contrats et chiffre d’affaires.'}>
        <Link href="/admin/commercial/rapports" className={classeBouton('secondaire')}>
          <FileBarChart aria-hidden className="h-4 w-4" /> Rapports hebdomadaires
        </Link>
        {peut(c.roles, 'export.donnees') && (
          <a href={`/admin/commercial/export?periode=${periode}`} className={classeBouton('secondaire')}>
            <Download aria-hidden className="h-4 w-4" /> Export CSV
          </a>
        )}
      </TitrePage>

      <nav aria-label="Période" className="flex w-fit flex-wrap gap-1 rounded-lg bg-ink-100/80 p-1">
        {(Object.keys(PERIODES) as Periode[]).map((k) => (
          <Link key={k} href={lien({ periode: k })} aria-current={k === periode ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${k === periode ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}>
            {PERIODES[k]}
          </Link>
        ))}
      </nav>

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicateur valeur={String(t.nouveaux)} libelle="Nouveaux prospects" />
        <Indicateur valeur={String(t.enAttente)} libelle="Demandes en attente" detail="Nouveau ou en qualification" />
        <Indicateur valeur={String(t.sansReponse)} libelle="Sans réponse > 24 h" alerte={t.sansReponse > 0} />
        <Indicateur valeur={libelleDuree(t.delaiPremiereReponseMin)} libelle="Délai moyen de 1re réponse" />
        <Indicateur valeur={`${t.devisEnvoyes} / ${t.devisAcceptes}`} libelle="Devis envoyés / acceptés" />
        <Indicateur valeur={t.tauxTransformation === null ? '—' : `${t.tauxTransformation} %`} libelle="Taux de transformation" detail="Acceptés / nouveaux prospects" />
        <Indicateur valeur={String(t.prestationsRealisees)} libelle="Prestations réalisées" />
        <Indicateur valeur={formaterMontant(t.facture)} libelle="CA facturé TTC" />
        <Indicateur valeur={formaterMontant(t.encaisse)} libelle="CA encaissé" />
      </section>

      {agent && agent.conversationsPrises + agent.brouillons > 0 && (
        <Carte titre="Assistant virtuel WhatsApp" actions={<Link href="/admin/agent" className="text-sm text-primary hover:underline">Détails</Link>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Indicateur valeur={String(agent.conversationsPrises)} libelle="Conversations prises" detail={agent.brouillons ? `+ ${agent.brouillons} brouillon(s) en mode fantôme` : undefined} />
            <Indicateur valeur={agent.tauxQualification === null ? '—' : `${agent.tauxQualification} %`} libelle="Qualification complète" detail={`${agent.qualificationsCompletes} conversation(s)`} />
            <Indicateur valeur={String(agent.passages.reduce((s, p) => s + p.n, 0))} libelle="Passages à un conseiller" detail={agent.passages.slice(0, 2).map((p) => `${MOTIFS_PASSAGE[p.motif] ?? p.motif} : ${p.taux ?? 0} %`).join(' · ') || undefined} />
            <Indicateur valeur={String(agent.bloques)} libelle="Messages bloqués" alerte={agent.bloques > 0} />
            <Indicateur valeur={`${agent.devisAcceptes} / ${agent.dossiersAgent}`} libelle="Devis acceptés / dossiers de l’agent" />
          </div>
        </Carte>
      )}

      {veille && veille.parSource.length > 0 && (
        <Carte titre="Veille prospects" actions={<Link href="/admin/veille/sources" className="text-sm text-primary hover:underline">Sources</Link>}>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-2 font-semibold">Source / requête</th>
                  <th className="pb-2 text-right font-semibold">Trouvées</th>
                  <th className="pb-2 text-right font-semibold">Retenues</th>
                  <th className="pb-2 text-right font-semibold">Contactées</th>
                  <th className="pb-2 text-right font-semibold">Converties</th>
                  <th className="pb-2 text-right font-semibold">CA encaissé</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[veille.total, ...veille.parRequete].map((l) => (
                  <tr key={l.cle} className={`border-t border-ink-100 ${l.cle === 'total' ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-2 text-ink-800">{l.libelle}</td>
                    <td className="py-2 text-right">{l.trouvees}</td>
                    <td className="py-2 text-right">{l.retenues}</td>
                    <td className="py-2 text-right">{l.contactees}</td>
                    <td className="py-2 text-right">{l.converties}</td>
                    <td className="py-2 text-right">{formaterMontant(l.ca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}

      <Carte titre="Ventilation">
        <nav aria-label="Ventiler par" className="-mt-1 mb-3 flex flex-wrap gap-1">
          {dimensions.map((d) => (
            <Link key={d} href={lien({ dim: d })} aria-current={d === dim ? 'page' : undefined} className={`rounded-md px-2.5 py-1 text-sm ${d === dim ? 'bg-brand-100 font-semibold text-brand-900' : 'text-ink-600 hover:bg-ink-100'}`}>
              {DIMENSIONS[d]}
            </Link>
          ))}
        </nav>
        {ventilation.length === 0 ? (
          <p className="text-sm text-ink-500">Aucune activité sur la période.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-2 font-semibold">{DIMENSIONS[dim]}</th>
                  <th className="pb-2 text-right font-semibold">Nouveaux</th>
                  <th className="pb-2 text-right font-semibold">En attente</th>
                  <th className="pb-2 text-right font-semibold">Devis env.</th>
                  <th className="pb-2 text-right font-semibold">Acceptés</th>
                  <th className="pb-2 text-right font-semibold">Taux</th>
                  <th className="pb-2 text-right font-semibold">Réalisées</th>
                  <th className="pb-2 text-right font-semibold">Facturé</th>
                  <th className="pb-2 text-right font-semibold">Encaissé</th>
                  <th className="pb-2 text-right font-semibold">1re rép.</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ventilation.map((v) => (
                  <tr key={v.cle} className="border-t border-ink-100">
                    <td className="py-2 pr-2 text-ink-800">{v.libelle}</td>
                    <td className="py-2 text-right font-semibold text-ink-900">{v.nouveaux}</td>
                    <td className="py-2 text-right">{v.enAttente}{v.sansReponse > 0 && <span className="ml-1 text-amber-700" title="Sans réponse > 24 h">({v.sansReponse})</span>}</td>
                    <td className="py-2 text-right">{v.devisEnvoyes}</td>
                    <td className="py-2 text-right">{v.devisAcceptes}</td>
                    <td className="py-2 text-right">{v.tauxTransformation === null ? '—' : `${v.tauxTransformation} %`}</td>
                    <td className="py-2 text-right">{v.prestationsRealisees}</td>
                    <td className="py-2 text-right">{formaterMontant(v.facture)}</td>
                    <td className="py-2 text-right">{formaterMontant(v.encaisse)}</td>
                    <td className="py-2 text-right text-ink-600">{libelleDuree(v.delaiPremiereReponseMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Carte titre="Entonnoir" description="Dossiers créés sur la période et ce qu’ils sont devenus depuis.">
          {funnel.total.dossiers === 0 ? (
            <p className="text-sm text-ink-500">Aucun dossier créé sur la période.</p>
          ) : (
            <div className="space-y-5">
              <BarreEntonnoir e={funnel.total} max={funnel.total.dossiers} />
              {funnel.parSource.map((e) => <BarreEntonnoir key={e.cle} e={e} max={funnel.total.dossiers} />)}
            </div>
          )}
        </Carte>

        <Carte titre="Demandes en attente" description="Phase Nouveau ou En qualification, de la plus ancienne à la plus récente.">
          {attente.length === 0 ? (
            <p className="text-sm text-ink-500">Aucune demande en attente.</p>
          ) : (
            <ul className="-my-1 divide-y divide-ink-100 text-sm">
              {attente.slice(0, 15).map((x) => (
                <li key={x.id} className="flex items-center gap-2 py-2">
                  {x.sansReponse && <AlertTriangle aria-label="Sans réponse depuis plus de 24 h" className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  <Link href={`/admin/dossiers/${x.id}`} className="rounded bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-700 hover:bg-brand-100 hover:text-brand-900">{x.numero}</Link>
                  <span className="min-w-0 flex-1 truncate text-ink-700">{x.client}</span>
                  <Pastille ton={x.ancienneteH >= 72 ? 'rouge' : x.ancienneteH >= 24 ? 'orange' : 'neutre'}>{libelleDuree(x.ancienneteH * 60)}</Pastille>
                </li>
              ))}
              {attente.length > 15 && <li className="py-2 text-xs text-ink-500">… et {attente.length - 15} autre(s).</li>}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}
