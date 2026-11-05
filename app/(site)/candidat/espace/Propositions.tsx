'use client';
// Propositions en attente de réponse (MVP2-01 RG-13, RG-14 ; MVP2-03 RG-03, RG-04, RG-08) et
// notifications du candidat. Mobile d'abord ; retours annoncés aux lecteurs d'écran.
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, X } from 'lucide-react';
import Button, { buttonClasses } from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import { inputClass } from '@/components/forms/WhatsAppForm';
import { marquerNotificationsLues, repondre } from '../actions';

type Retour = { ok: boolean; texte: string } | null;

export interface PropositionAffichee {
  id: number;
  poste: string;
  client: string;
  details: { libelle: string; valeur: string }[];
  recueLe: string;
}

const MessageRetour = ({ r }: { r: Retour }) => (
  <p aria-live="polite" role={r && !r.ok ? 'alert' : 'status'} className={`text-sm ${r?.ok ? 'text-success' : 'text-danger'}`}>
    {r?.texte}
  </p>
);

/** Carte d'une Proposition en attente : accord explicite (ce client, ce poste) ou refus confirmé. */
export function CarteProposition({ p }: { p: PropositionAffichee }) {
  const router = useRouter();
  const id = useId();
  const [numero, setNumero] = useState(false);
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState<'accepte' | 'refuse' | null>(null);
  const [r, setR] = useState<Retour>(null);

  const envoyer = async (reponse: 'accepte' | 'refuse') => {
    setEnvoi(reponse);
    setR(null);
    const res = await repondre({ propositionId: p.id, reponse, motif: reponse === 'refuse' ? motif : undefined, numeroCommunicable: reponse === 'accepte' && numero }).catch(() => ({
      ok: false as const,
      erreur: 'Connexion au serveur impossible. Réessayez.',
    }));
    setR(res.ok ? { ok: true, texte: res.message ?? 'Réponse enregistrée.' } : { ok: false, texte: res.erreur });
    setEnvoi(null);
    if (res.ok) router.refresh();
  };

  return (
    <article aria-labelledby={`${id}-titre`} className={cardClasses({ variant: 'pillar', pillar: 'emploi', padding: 'sm', className: 'space-y-3' })}>
      <div>
        <h3 id={`${id}-titre`} className="font-display text-h3 text-ink-900">
          {p.poste}
        </h3>
        <p className="text-sm text-ink-700">
          Employeur : <strong>{p.client}</strong>
        </p>
        <p className="text-xs text-muted">Reçue le {p.recueLe}</p>
      </div>
      {p.details.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {p.details.map((d) => (
            <div key={d.libelle} className="flex gap-1">
              <dt className="text-muted shrink-0">{d.libelle} :</dt>
              <dd className="text-ink-900 min-w-0 break-words">{d.valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      <p id={`${id}-accord`} className="rounded-2xl bg-ink-50 p-3 text-sm text-ink-700">
        En acceptant, vous autorisez NEXCLEAN à transmettre à <strong>{p.client}</strong> votre profil résumé et votre CV <strong>tel quel</strong>, y compris les coordonnées qu’il contient (téléphone, adresse…), pour le poste « {p.poste} ». Cet accord ne vaut que pour cet employeur et ce poste.
      </p>

      {!refus ? (
        <>
          <label className="flex items-start gap-3 text-sm text-ink-700 min-h-11 cursor-pointer">
            <input type="checkbox" checked={numero} onChange={(e) => setNumero(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
            <span>
              J’accepte que mon numéro soit communiqué à l’employeur <span className="text-muted">(facultatif — sinon, votre conseiller organise l’entretien)</span>
            </span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!!envoi}
              aria-describedby={`${id}-accord`}
              onClick={() => envoyer('accepte')}
              className={buttonClasses({ className: 'flex-1' })}
            >
              {envoi === 'accepte' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} J’accepte d’être présenté(e)
            </button>
            <Button
              variant="outline"
              icon={X}
              className="flex-1"
              disabled={!!envoi}
              onClick={() => {
                setRefus(true);
                setR(null);
              }}
            >
              Je refuse
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-2 rounded-2xl border border-danger-border bg-danger-soft p-3">
          <p className="text-sm font-semibold text-ink-900">Confirmer le refus ?</p>
          <p className="text-sm text-ink-700">Votre refus est définitif pour cette proposition : votre profil ne sera pas transmis à {p.client} pour ce poste.</p>
          <label htmlFor={`${id}-motif`} className="block text-sm text-ink-700">
            Motif <span className="text-muted">(facultatif)</span>
          </label>
          <textarea id={`${id}-motif`} value={motif} maxLength={500} rows={2} onChange={(e) => setMotif(e.target.value)} className={inputClass} placeholder="Ex. trop loin de chez moi" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="flex-1 !bg-danger hover:!bg-danger" disabled={!!envoi} loading={envoi === 'refuse'} onClick={() => envoyer('refuse')}>
              Confirmer le refus
            </Button>
            <Button variant="outline" className="flex-1" disabled={!!envoi} onClick={() => setRefus(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      <MessageRetour r={r} />
    </article>
  );
}

export interface NotificationAffichee {
  id: number;
  titre: string;
  texte: string;
  le: string;
  lu: boolean;
}

/** Notifications non lues (placement confirmé, proposition retirée…), avec « marquer comme lu ». */
export function Notifications({ notifications }: { notifications: NotificationAffichee[] }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState<number | 'toutes' | null>(null);
  const [r, setR] = useState<Retour>(null);
  const nonLues = notifications.filter((n) => !n.lu);
  const lues = notifications.filter((n) => n.lu);
  if (!notifications.length) return null;

  const marquer = async (id?: number) => {
    setEnvoi(id ?? 'toutes');
    const res = await marquerNotificationsLues(id).catch(() => ({ ok: false as const, erreur: 'Connexion au serveur impossible.' }));
    setR(res.ok ? { ok: true, texte: id ? 'Notification marquée comme lue.' : 'Notifications marquées comme lues.' } : { ok: false, texte: res.erreur });
    setEnvoi(null);
    router.refresh();
  };

  return (
    <section aria-labelledby="titre-notifications" className={cardClasses({ padding: 'sm', className: 'space-y-3' })}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titre-notifications" className="font-display text-h3 text-ink-900 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifications
          {nonLues.length > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">{nonLues.length}<span className="sr-only"> non lue{nonLues.length > 1 ? 's' : ''}</span></span>}
        </h2>
        {nonLues.length > 1 && (
          <button type="button" disabled={!!envoi} onClick={() => marquer()} className="min-h-11 text-sm text-primary underline disabled:opacity-60">
            Tout marquer comme lu
          </button>
        )}
      </div>
      {nonLues.length > 0 ? (
        <ul className="space-y-2">
          {nonLues.map((n) => (
            <li key={n.id} className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <p className="font-semibold text-sm text-ink-900">{n.titre}</p>
              <p className="text-sm text-ink-700">{n.texte}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{n.le}</span>
                <button type="button" disabled={!!envoi} onClick={() => marquer(n.id)} className="inline-flex items-center gap-1 min-h-11 text-sm text-primary underline disabled:opacity-60">
                  {envoi === n.id && <Loader2 className="w-3 h-3 animate-spin" />} Marquer comme lu
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aucune nouvelle notification.</p>
      )}
      {lues.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 flex items-center cursor-pointer text-ink-600">Notifications précédentes ({lues.length})</summary>
          <ul className="divide-y divide-ink-100">
            {lues.map((n) => (
              <li key={n.id} className="py-2">
                <p className="font-medium text-ink-900">{n.titre}</p>
                <p className="text-ink-600">{n.texte}</p>
                <span className="text-xs text-muted">{n.le}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <MessageRetour r={r} />
    </section>
  );
}
