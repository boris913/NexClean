// MVP1-05 RG-10 : liste des notifications du collaborateur connecté.
import { exigerCollaborateur } from '@/lib/authz/session';
import { listerNotifications } from '@/lib/notifications';
import { formatHorodatage } from '@/lib/audit-lecture';
import { TitrePage, classeBouton } from '@/components/backoffice/ui';
import { ouvrirNotification, toutMarquerLu } from './actions';

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
        <p className="text-sm text-ink-600">Aucune notification.</p>
      ) : (
        <ul className="space-y-2">
          {liste.map((n) => (
            <li key={n.id}>
              <form action={ouvrirNotification.bind(null, n.id)}>
                <button className={`w-full text-left bg-white border rounded-lg p-3 text-sm ${n.luLe ? 'border-ink-100' : 'border-primary/40 bg-primary/5'}`}>
                  <span className="flex justify-between gap-2 text-xs text-ink-500">
                    <span>{n.luLe ? 'Lu' : 'Nouveau'}</span>
                    <span>{formatHorodatage(n.creeLe)}</span>
                  </span>
                  <span className={`block ${n.luLe ? '' : 'font-semibold'}`}>{n.titre}</span>
                  <span className="block whitespace-pre-wrap text-ink-600">{n.texte}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
