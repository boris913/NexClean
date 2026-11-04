// MVP1-05 RG-10 : liste des notifications du collaborateur connecté.
import { exigerCollaborateur } from '@/lib/authz/session';
import { listerNotifications } from '@/lib/notifications';
import { formatHorodatage } from '@/lib/audit-lecture';
import { classeBouton, EtatVide, TitrePage } from '@/components/backoffice/ui';
import { ouvrirNotification, toutMarquerLu } from './actions';
import { Bell } from 'lucide-react';

export const metadata = { title: 'Notifications' };

export default async function PageNotifications() {
  const c = await exigerCollaborateur();
  const liste = await listerNotifications(c.id, 100);
  const nonLues = liste.filter((n) => !n.luLe).length;
  return (
    <>
      <TitrePage titre="Notifications">
        {nonLues > 0 && (
          <form action={toutMarquerLu}>
            <button className={classeBouton('secondaire')}>Tout marquer comme lu</button>
          </form>
        )}
      </TitrePage>
      {liste.length === 0 ? (
        <EtatVide icone={Bell} titre="Aucune notification." description="Vous serez prévenu ici des dossiers attribués, des relances et des demandes à traiter." />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-sm divide-y divide-ink-100">
          {liste.map((n) => (
            <li key={n.id}>
              <form action={ouvrirNotification.bind(null, n.id)}>
                <button className={`relative flex w-full gap-3 text-left p-3 sm:px-4 text-sm transition-colors hover:bg-ink-50 ${n.luLe ? '' : 'bg-brand-50/50'}`}>
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.luLe ? 'bg-transparent' : 'bg-primary'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-xs text-ink-500">
                      <span className={n.luLe ? '' : 'font-semibold text-primary'}>{n.luLe ? 'Lu' : 'Nouveau'}</span>
                      <span className="tabular-nums">{formatHorodatage(n.creeLe)}</span>
                    </span>
                    <span className={`mt-0.5 block text-ink-900 ${n.luLe ? '' : 'font-semibold'}`}>{n.titre}</span>
                    <span className="block whitespace-pre-wrap text-ink-600">{n.texte}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
