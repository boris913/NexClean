'use client';
// Formulaires du client : vérification des 4 chiffres (RG-07), retours sur un profil (RG-11),
// confirmation de prise de poste (RG-16). Partagés par la page de suivi et les liens temporaires.
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button, { buttonClasses } from '@/components/ui/Button';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { confirmerPriseDePoste, repondreProfil, verifierChiffres, type Source } from './actions';

const erreurClass = 'rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger';
const succesClass = 'rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm text-ink-800';

type Etat = { type: 'erreur' | 'succes'; texte: string } | null;

function Message({ etat }: { etat: Etat }) {
  return (
    <div aria-live="polite" role="status">
      {etat && <p className={etat.type === 'erreur' ? erreurClass : succesClass}>{etat.texte}</p>}
    </div>
  );
}

export function FormulaireVerification({ source, jeton, bloque, libelle = 'Afficher les profils' }: { source: Source; jeton: string; bloque: string | null; libelle?: string }) {
  const router = useRouter();
  const id = useId();
  const [chiffres, setChiffres] = useState('');
  const [etat, setEtat] = useState<Etat>(bloque ? { type: 'erreur', texte: bloque } : null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^\d{4}$/.test(chiffres)) return setEtat({ type: 'erreur', texte: 'Saisissez les 4 derniers chiffres de votre numéro WhatsApp.' });
        setEnvoi(true);
        setEtat(null);
        try {
          const r = await verifierChiffres(source, jeton, chiffres);
          if (r.ok) {
            router.refresh();
            return;
          }
          setEtat({ type: 'erreur', texte: r.erreur });
          setChiffres('');
        } catch {
          setEtat({ type: 'erreur', texte: 'Connexion au serveur impossible. Réessayez dans un instant.' });
        }
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor={`${id}-chiffres`} className={labelClass}>
          4 derniers chiffres de votre numéro WhatsApp
        </label>
        <input
          id={`${id}-chiffres`}
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          value={chiffres}
          aria-invalid={etat?.type === 'erreur' || undefined}
          aria-describedby={`${id}-aide`}
          onChange={(e) => setChiffres(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`${inputClass} font-mono tracking-[0.5em] text-center text-lg`}
        />
        <p id={`${id}-aide`} className="mt-1 text-xs text-muted">
          Le numéro WhatsApp communiqué à NEXCLEAN pour cette demande.
        </p>
      </div>
      <Message etat={etat} />
      <Button type="submit" fullWidth loading={envoi}>
        {libelle}
      </Button>
    </form>
  );
}

export function RetourProfil({ source, jeton, propositionId, prenom, retour }: { source: Source; jeton: string; propositionId: number; prenom: string; retour: 'rencontrer' | 'ne_correspond_pas' | null }) {
  const router = useRouter();
  const id = useId();
  const [motifOuvert, setMotifOuvert] = useState(false);
  const [motif, setMotif] = useState('');
  const [etat, setEtat] = useState<Etat>(null);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async (r: 'rencontrer' | 'ne_correspond_pas') => {
    setEnvoi(true);
    setEtat(null);
    try {
      const res = await repondreProfil(source, jeton, propositionId, r, r === 'ne_correspond_pas' ? motif : null);
      setEtat(res.ok ? { type: 'succes', texte: res.message ?? 'Réponse enregistrée.' } : { type: 'erreur', texte: res.erreur });
      if (res.ok) {
        setMotifOuvert(false);
        router.refresh();
      }
    } catch {
      setEtat({ type: 'erreur', texte: 'Connexion au serveur impossible. Réessayez dans un instant.' });
    }
    setEnvoi(false);
  };

  return (
    <div className="space-y-2">
      {retour && (
        <p className="text-sm text-ink-700">
          Votre réponse : <strong>{retour === 'rencontrer' ? 'je souhaite le / la rencontrer' : 'ne correspond pas'}</strong>
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button fullWidth disabled={envoi} onClick={() => envoyer('rencontrer')} aria-label={`Je souhaite rencontrer ${prenom}`}>
          Je souhaite le / la rencontrer
        </Button>
        <button type="button" disabled={envoi} onClick={() => setMotifOuvert((o) => !o)} aria-expanded={motifOuvert} aria-controls={`${id}-motif-bloc`} className={buttonClasses({ variant: 'outline', fullWidth: true })}>
          Ne correspond pas
        </button>
      </div>
      {motifOuvert && (
        <div id={`${id}-motif-bloc`} className="space-y-2">
          <label htmlFor={`${id}-motif`} className={labelClass}>
            Motif (facultatif)
          </label>
          <textarea id={`${id}-motif`} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
          <Button variant="secondary" fullWidth loading={envoi} onClick={() => envoyer('ne_correspond_pas')}>
            Envoyer ma réponse
          </Button>
        </div>
      )}
      <Message etat={etat} />
    </div>
  );
}

const dateLongue = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [a, m, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(Date.UTC(a!, m! - 1, j!)));
};

export function ConfirmationPlacement({ source, jeton, placementId, prenom, datePrevue }: { source: Source; jeton: string; placementId: number; prenom: string; datePrevue: string }) {
  const router = useRouter();
  const id = useId();
  const [nom, setNom] = useState('');
  const [fonction, setFonction] = useState('');
  const [autreDate, setAutreDate] = useState(false);
  const [date, setDate] = useState(datePrevue);
  const [erreurs, setErreurs] = useState<{ nom?: string; fonction?: string; date?: string }>({});
  const [etat, setEtat] = useState<Etat>(null);
  const [envoi, setEnvoi] = useState(false);
  const dateEffective = autreDate ? date : datePrevue;

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const err: typeof erreurs = {};
        if (!nom.trim()) err.nom = 'Indiquez votre nom.';
        if (!fonction.trim()) err.fonction = 'Indiquez votre fonction.';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEffective)) err.date = 'Indiquez la date de prise de poste.';
        setErreurs(err);
        if (Object.keys(err).length) return;
        setEnvoi(true);
        setEtat(null);
        try {
          const r = await confirmerPriseDePoste(source, jeton, placementId, { signataireNom: nom, signataireFonction: fonction, datePriseDePoste: dateEffective });
          setEtat(r.ok ? { type: 'succes', texte: r.message ?? 'Prise de poste confirmée.' } : { type: 'erreur', texte: r.erreur });
          if (r.ok) router.refresh();
        } catch {
          setEtat({ type: 'erreur', texte: 'Connexion au serveur impossible. Réessayez dans un instant.' });
        }
        setEnvoi(false);
      }}
    >
      <div>
        <label htmlFor={`${id}-nom`} className={labelClass}>
          Votre nom (signataire)
        </label>
        <input id={`${id}-nom`} autoComplete="name" maxLength={120} value={nom} onChange={(e) => setNom(e.target.value)} aria-invalid={!!erreurs.nom || undefined} aria-describedby={erreurs.nom ? `${id}-nom-err` : undefined} className={inputClass} />
        {erreurs.nom && (
          <p id={`${id}-nom-err`} className="mt-1 text-xs text-danger">
            {erreurs.nom}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-fonction`} className={labelClass}>
          Votre fonction
        </label>
        <input id={`${id}-fonction`} autoComplete="organization-title" maxLength={120} value={fonction} onChange={(e) => setFonction(e.target.value)} aria-invalid={!!erreurs.fonction || undefined} aria-describedby={erreurs.fonction ? `${id}-fonction-err` : undefined} className={inputClass} />
        {erreurs.fonction && (
          <p id={`${id}-fonction-err`} className="mt-1 text-xs text-danger">
            {erreurs.fonction}
          </p>
        )}
      </div>
      <label className="flex items-center gap-3 min-h-11 text-sm text-ink-700">
        <input type="checkbox" checked={autreDate} onChange={(e) => setAutreDate(e.target.checked)} className="h-5 w-5 accent-primary" />
        La prise de poste a eu lieu à une autre date
      </label>
      {autreDate && (
        <div>
          <label htmlFor={`${id}-date`} className={labelClass}>
            Date effective de prise de poste
          </label>
          <input id={`${id}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!erreurs.date || undefined} aria-describedby={erreurs.date ? `${id}-date-err` : undefined} className={inputClass} />
          {erreurs.date && (
            <p id={`${id}-date-err`} className="mt-1 text-xs text-danger">
              {erreurs.date}
            </p>
          )}
        </div>
      )}
      <Message etat={etat} />
      <Button type="submit" fullWidth loading={envoi} className="text-left">
        Je confirme la prise de poste de {prenom} le {dateLongue(dateEffective)}
      </Button>
    </form>
  );
}
