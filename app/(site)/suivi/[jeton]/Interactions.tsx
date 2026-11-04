'use client';
// Formulaires du client : vérification des 4 chiffres (RG-07), retours sur un profil (RG-11),
// confirmation de prise de poste (RG-16). Partagés par la page de suivi et les liens temporaires.
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { confirmerPriseDePoste, repondreProfil, verifierChiffres, type Source } from './actions';

const bouton = 'inline-flex w-full items-center justify-center gap-2 min-h-11 px-5 rounded-full font-semibold disabled:opacity-60';
const erreurClass = 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800';
const succesClass = 'rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink-800';

type Etat = { type: 'erreur' | 'succes'; texte: string } | null;

function Message({ etat }: { etat: Etat }) {
  return (
    <div aria-live="polite" role="status">
      {etat && <p className={etat.type === 'erreur' ? erreurClass : succesClass}>{etat.texte}</p>}
    </div>
  );
}

export function FormulaireVerification({ source, jeton, bloque }: { source: Source; jeton: string; bloque: string | null }) {
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
        <p id={`${id}-aide`} className="mt-1 text-xs text-ink-500">
          Le numéro WhatsApp communiqué à NEXCLEAN pour cette demande.
        </p>
      </div>
      <Message etat={etat} />
      <button type="submit" disabled={envoi} className={`${bouton} bg-cta text-ink-900`}>
        {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Afficher les profils
      </button>
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
        <button type="button" disabled={envoi} onClick={() => envoyer('rencontrer')} className={`${bouton} bg-cta text-ink-900`} aria-label={`Je souhaite rencontrer ${prenom}`}>
          Je souhaite le / la rencontrer
        </button>
        <button type="button" disabled={envoi} onClick={() => setMotifOuvert((o) => !o)} aria-expanded={motifOuvert} aria-controls={`${id}-motif-bloc`} className={`${bouton} border border-ink-200 bg-white text-ink-800`}>
          Ne correspond pas
        </button>
      </div>
      {motifOuvert && (
        <div id={`${id}-motif-bloc`} className="space-y-2">
          <label htmlFor={`${id}-motif`} className={labelClass}>
            Motif (facultatif)
          </label>
          <textarea id={`${id}-motif`} rows={2} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} />
          <button type="button" disabled={envoi} onClick={() => envoyer('ne_correspond_pas')} className={`${bouton} bg-ink-800 text-white`}>
            {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Envoyer ma réponse
          </button>
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
          <p id={`${id}-nom-err`} className="mt-1 text-xs text-red-700">
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
          <p id={`${id}-fonction-err`} className="mt-1 text-xs text-red-700">
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
            <p id={`${id}-date-err`} className="mt-1 text-xs text-red-700">
              {erreurs.date}
            </p>
          )}
        </div>
      )}
      <Message etat={etat} />
      <button type="submit" disabled={envoi} className={`${bouton} bg-cta text-ink-900 text-left`}>
        {envoi && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Je confirme la prise de poste de {prenom} le {dateLongue(dateEffective)}
      </button>
    </form>
  );
}
