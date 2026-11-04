import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listerCollaborateurs } from '@/lib/collaborateurs/lecture';
import { ROLES } from '@/lib/domain/referentiels';
import { classeBouton, Pastille, TitrePage } from '@/components/backoffice/ui';
import { Plus } from 'lucide-react';

export const metadata = { title: 'Collaborateurs' };

export default async function PageCollaborateurs() {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'collaborateurs.gerer') && !peut(c.roles, 'collaborateurs.attributs')) forbidden();
  const collaborateurs = await listerCollaborateurs();

  return (
    <>
      <TitrePage titre="Collaborateurs" description="Comptes du Back-Office, rôles et état de sécurité.">
        {peut(c.roles, 'collaborateurs.gerer') && (
          <Link href="/admin/collaborateurs/nouveau" className={classeBouton()}>
            <Plus aria-hidden className="h-4 w-4" /> Nouveau compte
          </Link>
        )}
      </TitrePage>
      <ul className="grid gap-3 md:grid-cols-2">
        {collaborateurs.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/collaborateurs/${u.id}`} className="group flex h-full items-start gap-3 bg-white border border-ink-200/70 rounded-xl p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md">
              <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${u.actif ? 'bg-brand-100 text-brand-900' : 'bg-ink-100 text-ink-500'}`}>
                {u.nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]!.toUpperCase()).join('')}
              </span>
              <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink-900 group-hover:text-primary">{u.nom}</p>
                <div className="flex flex-wrap gap-1">
                  {!u.actif && <Pastille ton="rouge">Désactivé</Pastille>}
                  {u.actif && !u.active && <Pastille ton="orange">Activation en attente</Pastille>}
                  {u.actif && u.active && !u.deuxFacteurs && <Pastille>Sans 2FA</Pastille>}
                </div>
              </div>
              <p className="text-sm text-ink-600 break-all">{u.email}</p>
              <p className="text-xs text-ink-500 mt-1">{u.roles.map((r) => ROLES[r]).join(' · ')}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
