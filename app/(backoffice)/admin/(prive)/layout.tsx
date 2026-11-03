// Habillage des pages connectées. L'affichage du menu dépend des droits, mais chaque
// page vérifie elle-même l'accès côté serveur (exigerCollaborateur).
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { collaborateurCourant } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { ROLES } from '@/lib/domain/referentiels';
import BoutonDeconnexion from './BoutonDeconnexion';

export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const c = await collaborateurCourant();
  if (!c) redirect('/admin/connexion');

  const liens = [
    { href: '/admin', libelle: 'Accueil', visible: true },
    { href: '/admin/dossiers', libelle: 'Dossiers', visible: peut(c.roles, 'dossier.voir_siens') || peut(c.roles, 'dossier.voir_tous') },
    { href: '/admin/collaborateurs', libelle: 'Collaborateurs', visible: peut(c.roles, 'collaborateurs.gerer') || peut(c.roles, 'collaborateurs.attributs') },
    { href: '/admin/referentiel', libelle: 'Référentiel', visible: peut(c.roles, 'referentiel.gerer') },
    { href: '/admin/journal', libelle: 'Journal', visible: peut(c.roles, 'audit.consulter') },
    { href: '/admin/securite', libelle: 'Sécurité', visible: true },
  ].filter((l) => l.visible);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/admin" className="font-display font-semibold text-lg">
            NEXCLEAN <span className="text-ink-500 font-normal text-sm">Back-Office</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-ink-600 text-right leading-tight">
              {c.nom}
              <br />
              <span className="text-xs text-ink-500">{c.roles.map((r) => ROLES[r]).join(' · ')}</span>
            </span>
            <BoutonDeconnexion />
          </div>
        </div>
        <nav aria-label="Navigation du Back-Office" className="max-w-5xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {liens.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 px-3 py-3 text-sm font-medium text-ink-700 hover:text-primary">
              {l.libelle}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
    </>
  );
}
