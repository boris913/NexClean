import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { peut } from '@/lib/authz/permissions';
import { listerCollaborateurs } from '@/lib/collaborateurs/lecture';
import { ROLES } from '@/lib/domain/referentiels';
import { classeBouton, Pastille, TitrePage } from '@/components/backoffice/ui';

export const metadata = { title: 'Collaborateurs' };

export default async function PageCollaborateurs() {
  const c = await exigerCollaborateur();
  if (!peut(c.roles, 'collaborateurs.gerer') && !peut(c.roles, 'collaborateurs.attributs')) forbidden();
  const collaborateurs = await listerCollaborateurs();

  return (
    <>
      <TitrePage titre="Collaborateurs">
        {peut(c.roles, 'collaborateurs.gerer') && (
          <Link href="/admin/collaborateurs/nouveau" className={classeBouton()}>
            + Nouveau compte
          </Link>
        )}
      </TitrePage>
      <ul className="space-y-2">
        {collaborateurs.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/collaborateurs/${u.id}`} className="block bg-white border border-ink-100 rounded-xl p-4 shadow-sm hover:border-primary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{u.nom}</p>
                <div className="flex flex-wrap gap-1">
                  {!u.actif && <Pastille ton="rouge">Désactivé</Pastille>}
                  {u.actif && !u.active && <Pastille ton="orange">Activation en attente</Pastille>}
                  {u.actif && u.active && !u.deuxFacteurs && <Pastille>Sans 2FA</Pastille>}
                </div>
              </div>
              <p className="text-sm text-ink-600 break-all">{u.email}</p>
              <p className="text-xs text-ink-500 mt-1">{u.roles.map((r) => ROLES[r]).join(' · ')}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
