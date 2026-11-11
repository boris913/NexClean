// Habillage des pages connectées. L'affichage du menu dépend des droits, mais chaque
// page vérifie elle-même l'accès côté serveur (exigerCollaborateur).
// ≥ lg : barre latérale fixe. < lg : barre supérieure + tiroir (MenuMobile).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, ShieldCheck } from 'lucide-react';
import { collaborateurCourant } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { ROLES } from '@/lib/domain/referentiels';
import BoutonDeconnexion from './BoutonDeconnexion';
import { compterNonLues } from '@/lib/notifications';
import { peutAccederVivier } from '@/lib/candidats/acces';
import { LiensNav, MenuMobile, type GroupeNav, type LienNav } from '@/components/backoffice/Navigation';
import { RechercheRapide } from '@/components/backoffice/RechercheRapide';

function Marque() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/brand/logo-symbole.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
      <span className="leading-tight">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink-900">NEXCLEAN</span>
        <span className="block text-[11px] font-medium text-ink-500">Back-Office</span>
      </span>
    </Link>
  );
}

function Initiales({ nom }: { nom: string }) {
  const initiales = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900">
      {initiales}
    </span>
  );
}

export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const c = await collaborateurCourant();
  if (!c) redirect('/admin/connexion');
  const [nonLues, vivier] = await Promise.all([compterNonLues(c.id), peutAccederVivier(c)]);

  const filtrer = (liens: (LienNav & { visible: boolean })[]) => liens.filter((l) => l.visible).map(({ visible: _, ...l }) => l);
  const groupes: GroupeNav[] = [
    {
      liens: filtrer([
        { href: '/admin', libelle: 'Accueil', icone: 'accueil', visible: true },
        { href: '/admin/notifications', libelle: 'Notifications', icone: 'notifications', badge: nonLues, visible: true },
      ]),
    },
    {
      titre: 'Activité',
      liens: filtrer([
        { href: '/admin/dossiers', libelle: 'Dossiers', icone: 'dossiers', visible: peut(c.roles, 'dossier.voir_siens') || peut(c.roles, 'dossier.voir_tous') },
        { href: '/admin/agenda', libelle: 'Agenda', icone: 'agenda', visible: peut(c.roles, 'dossier.voir_siens') || peut(c.roles, 'dossier.voir_tous') },
        { href: '/admin/attribution', libelle: 'Attribution', icone: 'attribution', visible: peut(c.roles, 'dossier.reaffecter') },
        { href: '/admin/candidats', libelle: 'Candidats', icone: 'candidats', visible: vivier },
        { href: '/admin/candidatures', libelle: 'Candidatures', icone: 'candidatures', visible: vivier },
        { href: '/admin/finances', libelle: 'Finances', icone: 'finances', visible: peut(c.roles, 'finances.tableau_de_bord') },
      ]),
    },
    {
      titre: 'Configuration',
      liens: filtrer([
        { href: '/admin/collaborateurs', libelle: 'Collaborateurs', icone: 'collaborateurs', visible: peut(c.roles, 'collaborateurs.gerer') || peut(c.roles, 'collaborateurs.attributs') },
        { href: '/admin/referentiel', libelle: 'Référentiel', icone: 'referentiel', visible: peut(c.roles, 'referentiel.gerer') },
        { href: '/admin/modeles', libelle: 'Modèles', icone: 'modeles', visible: peut(c.roles, 'modeles.gerer') },
        { href: '/admin/parametres', libelle: 'Paramètres', icone: 'parametres', visible: peut(c.roles, 'tarifs.modifier') },
        { href: '/admin/journal', libelle: 'Journal', icone: 'journal', visible: peut(c.roles, 'audit.consulter') },
      ]),
    },
  ].filter((g) => g.liens.length > 0);

  const roles = c.roles.map((r) => ROLES[r]).join(' · ');
  const compte = (
    <div className="space-y-1">
      <Link href="/admin/securite" className="flex items-center gap-3 rounded-lg p-2 hover:bg-ink-100/70">
        <Initiales nom={c.nom} />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-ink-900">{c.nom}</span>
          <span className="block truncate text-xs text-ink-500">{roles}</span>
        </span>
        <ShieldCheck aria-hidden className={`ml-auto h-4 w-4 shrink-0 ${c.deuxFacteurs ? 'text-primary' : 'text-amber-600'}`} />
        <span className="sr-only">{c.deuxFacteurs ? 'Sécurité du compte' : 'Sécurité du compte : double authentification non activée'}</span>
      </Link>
      <BoutonDeconnexion />
    </div>
  );

  return (
    <div className="lg:pl-64">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">
        Aller au contenu
      </a>

      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200/70 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Marque />
        </div>
        <div className="shrink-0 px-3 pb-1">
          <RechercheRapide groupes={groupes} />
        </div>
        <nav aria-label="Navigation du Back-Office" className="flex-1 overflow-y-auto px-3 py-3">
          <LiensNav groupes={groupes} />
        </nav>
        <div className="shrink-0 border-t border-ink-100 p-3">{compte}</div>
      </aside>

      {/* Barre supérieure (mobile et tablette) */}
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 lg:hidden">
        <div className="flex h-16 items-center justify-between gap-2 px-2 sm:px-4">
          <div className="flex items-center gap-1">
            <MenuMobile groupes={groupes} entete={<Marque />} pied={compte} />
            <Marque />
          </div>
          <div className="flex items-center">
            <RechercheRapide groupes={groupes} variante="icone" />
            <Link
              href="/admin/notifications"
              aria-label={`Notifications${nonLues ? ` : ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : ''}`}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-100"
            >
              <Bell aria-hidden className="h-5 w-5" />
              {nonLues > 0 && (
                <span className="absolute right-1 top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-white">{nonLues > 99 ? '99+' : nonLues}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
