'use client';
// Réponse du client au devis (specs/MVP2-04 RG-13, RG-14) : « J'accepte le devis » (nom,
// fonction, case des conditions) et « Refuser » (motif facultatif, confirmation).
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { accepterDevis, refuserDevis } from './actions';

const erreurClass = 'rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger';
const succesClass = 'rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm text-ink-800';

type Etat = { type: 'erreur' | 'succes'; texte: string } | null;
const ERREUR_RESEAU = 'Connexion au serveur impossible. Réessayez dans un instant.';

function Message({ etat }: { etat: Etat }) {
  return (
    <div aria-live="polite" role="status">
      {etat && <p className={etat.type === 'erreur' ? erreurClass : succesClass}>{etat.texte}</p>}
    </div>
  );
}

function Erreur({ id, texte }: { id: string; texte?: string }) {
  return texte ? (
    <p id={id} className="mt-1 text-xs text-danger">
      {texte}
    </p>
  ) : null;
}

export function ReponseDevis({ jeton, devisId, libelle, montantAcompte }: { jeton: string; devisId: number; libelle: string; montantAcompte: string | null }) {
  const router = useRouter();
  const id = useId();
  const [mode, setMode] = useState<'choix' | 'accepter' | 'refuser'>('choix');
  const [nom, setNom] = useState('');
  const [fonction, setFonction] = useState('');
  const [conditions, setConditions] = useState(false);
  const [motif, setMotif] = useState('');
  const [erreurs, setErreurs] = useState<{ nom?: string; fonction?: string; conditions?: string }>({});
  const [etat, setEtat] = useState<Etat>(null);
  const [envoi, setEnvoi] = useState(false);

  const accepter = async () => {
    const err: typeof erreurs = {};
    if (!nom.trim()) err.nom = 'Indiquez votre nom.';
    if (!fonction.trim()) err.fonction = 'Indiquez votre fonction.';
    if (!conditions) err.conditions = 'Cochez cette case pour accepter le devis.';
    setErreurs(err);
    if (Object.keys(err).length) return;
    setEnvoi(true);
    setEtat(null);
    try {
      const r = await accepterDevis(jeton, devisId, { signataireNom: nom, signataireFonction: fonction, conditionsAcceptees: conditions });
      setEtat(r.ok ? { type: 'succes', texte: r.message ?? 'Acceptation enregistrée.' } : { type: 'erreur', texte: r.erreur });
      if (r.ok) router.refresh();
    } catch {
      setEtat({ type: 'erreur', texte: ERREUR_RESEAU });
    }
    setEnvoi(false);
  };

  const refuser = async () => {
    setEnvoi(true);
    setEtat(null);
    try {
      const r = await refuserDevis(jeton, devisId, motif.trim() || null);
      setEtat(r.ok ? { type: 'succes', texte: r.message ?? 'Réponse enregistrée.' } : { type: 'erreur', texte: r.erreur });
      if (r.ok) router.refresh();
    } catch {
      setEtat({ type: 'erreur', texte: ERREUR_RESEAU });
    }
    setEnvoi(false);
  };

  if (mode === 'choix') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button fullWidth onClick={() => setMode('accepter')}>
            J’accepte le devis
          </Button>
          <Button variant="outline" fullWidth onClick={() => setMode('refuser')}>
            Refuser
          </Button>
        </div>
        <Message etat={etat} />
      </div>
    );
  }

  if (mode === 'refuser') {
    return (
      <form
        noValidate
        className="space-y-3 rounded-2xl border border-ink-200 bg-ink-50 p-4"
        aria-labelledby={`${id}-titre-refus`}
        onSubmit={(e) => {
          e.preventDefault();
          void refuser();
        }}
      >
        <h4 id={`${id}-titre-refus`} className="font-semibold">
          Refuser le {libelle} ?
        </h4>
        <p className="text-sm text-ink-700">Votre référent NEXCLEAN sera prévenu et pourra vous proposer un nouveau devis.</p>
        <div>
          <label htmlFor={`${id}-motif`} className={labelClass}>
            Motif (facultatif)
          </label>
          <textarea id={`${id}-motif`} rows={3} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
        </div>
        <Message etat={etat} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="submit" variant="secondary" fullWidth loading={envoi}>
            Confirmer le refus
          </Button>
          <Button variant="outline" fullWidth disabled={envoi} onClick={() => setMode('choix')}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"
      aria-labelledby={`${id}-titre-acceptation`}
      onSubmit={(e) => {
        e.preventDefault();
        void accepter();
      }}
    >
      <h4 id={`${id}-titre-acceptation`} className="font-semibold">
        Accepter le {libelle}
      </h4>
      <div>
        <label htmlFor={`${id}-nom`} className={labelClass}>
          Votre nom (signataire)
        </label>
        <input id={`${id}-nom`} autoComplete="name" maxLength={120} value={nom} onChange={(e) => setNom(e.target.value)} aria-invalid={!!erreurs.nom || undefined} aria-describedby={erreurs.nom ? `${id}-nom-err` : undefined} className={inputClass} />
        <Erreur id={`${id}-nom-err`} texte={erreurs.nom} />
      </div>
      <div>
        <label htmlFor={`${id}-fonction`} className={labelClass}>
          Votre fonction
        </label>
        <input id={`${id}-fonction`} autoComplete="organization-title" maxLength={120} value={fonction} onChange={(e) => setFonction(e.target.value)} aria-invalid={!!erreurs.fonction || undefined} aria-describedby={erreurs.fonction ? `${id}-fonction-err` : undefined} className={inputClass} />
        <Erreur id={`${id}-fonction-err`} texte={erreurs.fonction} />
      </div>
      <div>
        <label className="flex items-start gap-3 min-h-11 text-sm text-ink-800">
          <input
            type="checkbox"
            checked={conditions}
            onChange={(e) => setConditions(e.target.checked)}
            aria-invalid={!!erreurs.conditions || undefined}
            aria-describedby={erreurs.conditions ? `${id}-conditions-err` : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          />
          <span>J’ai lu et j’accepte les conditions du devis.</span>
        </label>
        <Erreur id={`${id}-conditions-err`} texte={erreurs.conditions} />
      </div>
      {montantAcompte && <p className="text-xs text-ink-600">Une facture d’acompte de {montantAcompte} sera émise à l’acceptation.</p>}
      <p className="text-xs text-muted">Votre acceptation est enregistrée avec la date, l’heure, votre adresse IP et la version du devis.</p>
      <Message etat={etat} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="submit" fullWidth loading={envoi}>
          Je confirme mon acceptation
        </Button>
        <Button variant="outline" fullWidth disabled={envoi} onClick={() => setMode('choix')}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
