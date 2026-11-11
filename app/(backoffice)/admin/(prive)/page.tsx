// Accueil du Back-Office : compteurs (MVP1-05 RG-18, RG-19) et raccourcis.
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { compteursDirection, compteursReferent, PERIODES, type LigneCompteur, type Periode } from '@/lib/dossiers/compteurs';
import { PHASES, STATUTS, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { listerNotifications } from '@/lib/notifications';
import { formatHorodatage } from '@/lib/audit-lecture';
import { AlertTriangle, Bell, ChevronRight, Clock, FolderOpen, MapPin, MessageSquare, ScrollText, Settings, ShieldCheck, Shuffle, UserCog, UserPlus, Users } from 'lucide-react';
import { Carte, ChiffreCle, classeBouton, TitrePage } from '@/components/backoffice/ui';
import { peutAccederVivier } from '@/lib/candidats/acces';
import { compterCandidatsNonAttribues, compterNouveauxCandidats } from '@/lib/candidats/vivier';

export const metadata = { title: 'Accueil' };

function Tableau({ titre, lignes, libelle }: { titre: string; lignes: LigneCompteur[]; libelle?: (l: LigneCompteur) => string }) {
  return (
    <Carte titre={titre}>
      {lignes.length === 0 ? (
        <p className="text-sm text-ink-500">Aucun dossier.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-400 text-left">
              <th className="font-semibold pb-2">
                <span className="sr-only">Catégorie</span>
              </th>
              <th className="font-semibold pb-2 text-right w-20">Ouverts</th>
              <th className="font-semibold pb-2 text-right w-20">Créés</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle} className="border-t border-ink-100">
                <td className="py-2 pr-2 text-ink-800">{libelle ? libelle(l) : l.libelle}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{l.ouverts}</td>
                <td className="py-2 text-right tabular-nums text-ink-600">{l.crees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Carte>
  );
}

export default async function Accueil({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const c = await exigerCollaborateur();
  const { periode: p } = await searchParams;
  const periode: Periode = p && p in PERIODES ? (p as Periode) : '7j';
  const estReferent = c.roles.includes('referent');
  const estDirection = c.roles.includes('direction');

  const [moi, dir, notifs, vivier] = await Promise.all([estReferent ? compteursReferent(c.id) : null, estDirection ? compteursDirection(periode) : null, listerNotifications(c.id, 20), peutAccederVivier(c)]);
  // MVP2-02 : file « Nouveaux candidats » du référent, « Non attribués » pour la Direction.
  const [nouveauxCandidats, candidatsNonAttribues] = vivier
    ? await Promise.all([estReferent && !estDirection ? compterNouveauxCandidats(c.id) : null, estDirection ? compterCandidatsNonAttribues() : null])
    : [null, null];
  const nonLues = notifs.filter((n) => !n.luLe).slice(0, 5);

  const raccourcis = [
    { href: '/admin/dossiers', icone: FolderOpen, titre: peut(c.roles, 'dossier.voir_tous') ? 'Dossiers' : 'Mes dossiers', visible: peut(c.roles, 'dossier.voir_siens') || peut(c.roles, 'dossier.voir_tous') },
    { href: '/admin/collaborateurs', icone: UserCog, titre: 'Collaborateurs', visible: peut(c.roles, 'collaborateurs.gerer') || peut(c.roles, 'collaborateurs.attributs') },
    { href: '/admin/referentiel', icone: MapPin, titre: 'Référentiel géographique', visible: peut(c.roles, 'referentiel.gerer') },
    { href: '/admin/modeles', icone: MessageSquare, titre: 'Modèles de messages', visible: peut(c.roles, 'modeles.gerer') },
    { href: '/admin/parametres', icone: Settings, titre: 'Paramètres', visible: peut(c.roles, 'tarifs.modifier') },
    { href: '/admin/journal', icone: ScrollText, titre: "Journal d'audit", visible: peut(c.roles, 'audit.consulter') },
    { href: '/admin/securite', icone: ShieldCheck, titre: 'Ma sécurité', visible: true },
  ].filter((r) => r.visible);

  return (
    <>
      <TitrePage
        titre={`Bonjour ${c.nom.split(' ')[0]}`}
        description={new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, (x) => x.toUpperCase())}
      />
      {!c.deuxFacteurs && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-inset ring-amber-200">
            <ShieldCheck aria-hidden className="h-5 w-5" />
          </span>
          <p className="flex-1 text-sm text-amber-900">
            <strong className="font-semibold">Protégez votre compte.</strong> La double authentification empêche l’accès au Back-Office avec un mot de passe volé.
          </p>
          <Link href="/admin/securite" className={classeBouton('secondaire')}>
            Activer la double authentification
          </Link>
        </div>
      )}

      <div className="space-y-8">
        {nonLues.length > 0 && (
          <Carte
            titre="Notifications non lues"
            actions={
              <Link href="/admin/notifications" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
                Tout voir <ChevronRight aria-hidden className="h-4 w-4" />
              </Link>
            }
          >
            <ul className="-my-1 divide-y divide-ink-100 text-sm">
              {nonLues.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-2.5">
                  <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-primary">
                    <Bell className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-ink-900 break-words">{n.titre}</span>
                  <span className="text-xs text-ink-500 shrink-0 tabular-nums">{formatHorodatage(n.creeLe)}</span>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        {(nouveauxCandidats !== null || candidatsNonAttribues !== null) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Candidats</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {nouveauxCandidats !== null && <ChiffreCle icone={UserPlus} valeur={nouveauxCandidats} libelle="nouveaux candidats à traiter" href="/admin/candidats" alerte />}
              {candidatsNonAttribues !== null && <ChiffreCle icone={Users} valeur={candidatsNonAttribues} libelle="candidats non attribués" href="/admin/candidats?onglet=non_attribues" alerte />}
            </div>
          </section>
        )}

        {moi && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Mes dossiers</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ChiffreCle icone={FolderOpen} valeur={moi.parStatut.reduce((t, [, n]) => t + n, 0)} libelle="ouverts" href="/admin/dossiers" />
              <ChiffreCle icone={Clock} valeur={moi.sansAction.length} libelle={`sans action depuis ${moi.jours} j`} href="/admin/dossiers" alerte />
            </div>
            <div className="grid gap-3 md:grid-cols-2 md:items-start">
            {moi.parStatut.length > 0 && (
              <Carte titre="Par statut">
                <ul className="-my-1 text-sm divide-y divide-ink-100">
                  {moi.parStatut.map(([s, n]) => (
                    <li key={s}>
                      <Link href={`/admin/dossiers?statut=${s}`} className="group flex items-center justify-between gap-2 py-2 text-ink-800 hover:text-primary">
                        {STATUTS[s]}
                        <span className="rounded-full bg-ink-100 px-2 text-xs font-semibold leading-5 tabular-nums text-ink-700 group-hover:bg-brand-100 group-hover:text-brand-900">{n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Carte>
            )}
            {moi.sansAction.length > 0 && (
              <Carte titre="À relancer">
                <ul className="-my-1 text-sm divide-y divide-ink-100">
                  {moi.sansAction.slice(0, 10).map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-2">
                      <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <Link href={`/admin/dossiers/${d.id}`} className="rounded bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-700 hover:bg-brand-100 hover:text-brand-900">
                        {d.numero}
                      </Link>
                      <span className="min-w-0 truncate text-ink-700">{d.client}</span>
                    </li>
                  ))}
                </ul>
              </Carte>
            )}
            </div>
          </section>
        )}

        {dir && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Activité</h2>
              <nav aria-label="Période" className="flex flex-wrap gap-1 rounded-lg bg-ink-100/80 p-1">
                {(Object.keys(PERIODES) as Periode[]).map((k) => (
                  <Link
                    key={k}
                    href={`?periode=${k}`}
                    aria-current={k === periode ? 'page' : undefined}
                    className={`px-3 min-h-9 sm:min-h-8 inline-flex items-center rounded-md text-xs font-semibold transition ${k === periode ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
                  >
                    {PERIODES[k]}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ChiffreCle icone={Shuffle} valeur={dir.nonAttribues} libelle="non attribués" href="/admin/attribution" alerte />
              <ChiffreCle icone={Clock} valeur={dir.sansAction} libelle={`sans action depuis ${dir.jours} j`} href="/admin/dossiers" alerte />
            </div>
            <p className="text-xs text-ink-500">« Ouverts » : dossiers en cours aujourd’hui. « Créés » : dossiers reçus sur la période.</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Tableau titre="Par phase" lignes={dir.parPhase} libelle={(l) => PHASES[l.cle as Phase]} />
              <Tableau titre="Par type" lignes={dir.parType} libelle={(l) => DOSSIER_TYPES[l.cle as DossierType]} />
              <Tableau titre="Par ville" lignes={dir.parVille} />
              <Tableau titre="Par source" lignes={dir.parSource} />
              <Tableau titre="Par référent" lignes={dir.parReferent} />
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Raccourcis</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {raccourcis.map((r) => (
              <Link key={r.href} href={r.href} className="group flex min-h-12 items-center gap-3 rounded-xl border border-ink-200/70 bg-white px-3 py-2.5 text-sm font-medium text-ink-800 shadow-sm transition hover:border-brand-300 hover:shadow-md">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600 transition group-hover:bg-brand-50 group-hover:text-primary">
                  <r.icone aria-hidden className="h-4 w-4" />
                </span>
                {r.titre}
                <ChevronRight aria-hidden className="ml-auto h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
