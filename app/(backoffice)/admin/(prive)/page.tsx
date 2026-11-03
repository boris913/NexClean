// Accueil du Back-Office : compteurs (MVP1-05 RG-18, RG-19) et raccourcis.
import Link from 'next/link';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { compteursDirection, compteursReferent, PERIODES, type LigneCompteur, type Periode } from '@/lib/dossiers/compteurs';
import { PHASES, STATUTS, type Phase } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { listerNotifications } from '@/lib/notifications';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Carte, TitrePage } from '@/components/backoffice/ui';
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
            <tr className="text-xs text-ink-500 text-left">
              <th className="font-medium py-1">
                <span className="sr-only">Catégorie</span>
              </th>
              <th className="font-medium py-1 text-right w-20">Ouverts</th>
              <th className="font-medium py-1 text-right w-20">Créés</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle} className="border-t border-ink-100">
                <td className="py-1.5 pr-2">{libelle ? libelle(l) : l.libelle}</td>
                <td className="py-1.5 text-right tabular-nums">{l.ouverts}</td>
                <td className="py-1.5 text-right tabular-nums">{l.crees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Carte>
  );
}

function Chiffre({ valeur, libelle, href, alerte }: { valeur: number; libelle: string; href: string; alerte?: boolean }) {
  return (
    <Link href={href} className={`block rounded-xl border p-4 bg-white shadow-sm hover:border-primary ${alerte && valeur > 0 ? 'border-amber-300' : 'border-ink-100'}`}>
      <span className={`block text-2xl font-bold tabular-nums ${alerte && valeur > 0 ? 'text-amber-700' : 'text-ink-900'}`}>{valeur}</span>
      <span className="text-sm text-ink-600">{libelle}</span>
    </Link>
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
    { href: '/admin/dossiers', titre: peut(c.roles, 'dossier.voir_tous') ? 'Dossiers' : 'Mes dossiers', visible: peut(c.roles, 'dossier.voir_siens') || peut(c.roles, 'dossier.voir_tous') },
    { href: '/admin/collaborateurs', titre: 'Collaborateurs', visible: peut(c.roles, 'collaborateurs.gerer') || peut(c.roles, 'collaborateurs.attributs') },
    { href: '/admin/referentiel', titre: 'Référentiel géographique', visible: peut(c.roles, 'referentiel.gerer') },
    { href: '/admin/modeles', titre: 'Modèles de messages', visible: peut(c.roles, 'modeles.gerer') },
    { href: '/admin/parametres', titre: 'Paramètres', visible: peut(c.roles, 'tarifs.modifier') },
    { href: '/admin/journal', titre: "Journal d'audit", visible: peut(c.roles, 'audit.consulter') },
    { href: '/admin/securite', titre: 'Ma sécurité', visible: true },
  ].filter((r) => r.visible);

  return (
    <>
      <TitrePage titre={`Bonjour ${c.nom.split(' ')[0]}`} />
      {!c.deuxFacteurs && (
        <div className="mb-4">
          <Carte>
            <p className="text-sm text-ink-700">
              Protégez votre compte :{' '}
              <Link href="/admin/securite" className="text-primary font-medium">
                activez la double authentification
              </Link>
              .
            </p>
          </Carte>
        </div>
      )}

      <div className="space-y-6">
        {nonLues.length > 0 && (
          <Carte
            titre="Notifications non lues"
            actions={
              <Link href="/admin/notifications" className="text-sm text-primary">
                Tout voir
              </Link>
            }
          >
            <ul className="space-y-1 text-sm">
              {nonLues.map((n) => (
                <li key={n.id} className="flex justify-between gap-2">
                  <span className="font-medium">{n.titre}</span>
                  <span className="text-xs text-ink-500 shrink-0">{formatHorodatage(n.creeLe)}</span>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        {(nouveauxCandidats !== null || candidatsNonAttribues !== null) && (
          <section className="space-y-3">
            <h2 className="font-semibold text-ink-900">Candidats</h2>
            <div className="grid grid-cols-2 gap-3">
              {nouveauxCandidats !== null && <Chiffre valeur={nouveauxCandidats} libelle="nouveaux candidats à traiter" href="/admin/candidats" alerte />}
              {candidatsNonAttribues !== null && <Chiffre valeur={candidatsNonAttribues} libelle="candidats non attribués" href="/admin/candidats?onglet=non_attribues" alerte />}
            </div>
          </section>
        )}

        {moi && (
          <section className="space-y-3">
            <h2 className="font-semibold text-ink-900">Mes dossiers</h2>
            <div className="grid grid-cols-2 gap-3">
              <Chiffre valeur={moi.parStatut.reduce((t, [, n]) => t + n, 0)} libelle="ouverts" href="/admin/dossiers" />
              <Chiffre valeur={moi.sansAction.length} libelle={`sans action depuis ${moi.jours} j`} href="/admin/dossiers" alerte />
            </div>
            {moi.parStatut.length > 0 && (
              <Carte titre="Par statut">
                <ul className="text-sm divide-y divide-ink-100">
                  {moi.parStatut.map(([s, n]) => (
                    <li key={s} className="flex justify-between py-1.5">
                      <Link href={`/admin/dossiers?statut=${s}`} className="text-primary">
                        {STATUTS[s]}
                      </Link>
                      <span className="tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
              </Carte>
            )}
            {moi.sansAction.length > 0 && (
              <Carte titre="À relancer">
                <ul className="text-sm space-y-1">
                  {moi.sansAction.slice(0, 10).map((d) => (
                    <li key={d.id}>
                      <Link href={`/admin/dossiers/${d.id}`} className="text-primary font-mono">
                        {d.numero}
                      </Link>{' '}
                      · {d.client}
                    </li>
                  ))}
                </ul>
              </Carte>
            )}
          </section>
        )}

        {dir && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink-900">Activité</h2>
              <nav aria-label="Période" className="flex flex-wrap gap-1">
                {(Object.keys(PERIODES) as Periode[]).map((k) => (
                  <Link
                    key={k}
                    href={`?periode=${k}`}
                    aria-current={k === periode ? 'page' : undefined}
                    className={`px-3 min-h-9 inline-flex items-center rounded-full text-xs font-medium border ${k === periode ? 'bg-primary text-white border-primary' : 'border-ink-200 text-ink-700'}`}
                  >
                    {PERIODES[k]}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Chiffre valeur={dir.nonAttribues} libelle="non attribués" href="/admin/attribution" alerte />
              <Chiffre valeur={dir.sansAction} libelle={`sans action depuis ${dir.jours} j`} href="/admin/dossiers" alerte />
            </div>
            <p className="text-xs text-ink-500">« Ouverts » : dossiers en cours aujourd’hui. « Créés » : dossiers reçus sur la période.</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Tableau titre="Par phase" lignes={dir.parPhase} libelle={(l) => PHASES[l.cle as Phase]} />
              <Tableau titre="Par type" lignes={dir.parType} libelle={(l) => DOSSIER_TYPES[l.cle as DossierType]} />
              <Tableau titre="Par ville" lignes={dir.parVille} />
              <Tableau titre="Par référent" lignes={dir.parReferent} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-semibold text-ink-900 mb-2">Raccourcis</h2>
          <div className="flex flex-wrap gap-2">
            {raccourcis.map((r) => (
              <Link key={r.href} href={r.href} className="px-3 min-h-11 inline-flex items-center rounded-lg border border-ink-100 bg-white text-sm font-medium hover:border-primary">
                {r.titre}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
