'use client';
// Formulaires de devis « enregistrer d'abord, puis WhatsApp » (MVP1-04, ADR 0022).
// 1. La demande est enregistrée (dossier + numéro + lien de suivi).
// 2. WhatsApp s'ouvre avec le message structuré habituel, enrichi du numéro et du lien.
// Si l'enregistrement échoue (erreur, délai > 8 s, hors ligne), WhatsApp s'ouvre quand même
// avec le message sans numéro : le client n'est jamais bloqué (RG-06).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import { construireMessage, lieuVide, type FormField, type NomsLieu, type ValeurLieu } from '@/lib/dossiers/formulaire-devis';
import type { ListesLieux } from '@/lib/geo/service';
import { chargerLieux, enregistrerDemandeDevis } from './actions';

export type { FormField } from '@/lib/dossiers/formulaire-devis';

interface WhatsAppFormProps {
  /** Titre de la demande, en tête du message WhatsApp. */
  subject: string;
  fields: FormField[];
  submitLabel?: string;
  /** Rappel affiché sous le bouton (ex. envoi des photos). */
  note?: string;
  formId: string;
}

export const inputClass =
  'w-full px-4 py-3 text-base sm:text-sm text-ink-900 bg-ink-50 border border-ink-300 rounded-2xl outline-none focus:border-primary focus:bg-white focus-ring transition-all placeholder:text-ink-400';

export const labelClass = 'block text-xs font-medium text-ink-700 mb-1.5';

const DELAI_MS = 8000;

type Fin = { numero: string | null; lienSuivi: string | null; lienWhatsApp: string; bloque: boolean };

function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
}

export default function WhatsAppForm({ subject, fields, submitLabel = 'Envoyer ma demande', note, formId }: WhatsAppFormProps) {
  const vide = Object.fromEntries(fields.filter((f) => f.type !== 'lieu').map((f) => [f.name, '']));
  const [form, setForm] = useState<Record<string, string>>(vide);
  const [lieu, setLieu] = useState<ValeurLieu>(lieuVide);
  const [listes, setListes] = useState<ListesLieux | null>(null);
  const [consentement, setConsentement] = useState(false);
  const [siteWeb, setSiteWeb] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fin, setFin] = useState<Fin | null>(null);
  const champLieu = fields.find((f) => f.type === 'lieu');

  // Référentiel Ville → Quartier ; sans réponse, saisie libre (le formulaire reste utilisable).
  useEffect(() => {
    if (!champLieu) return;
    let actif = true;
    avecDelai(chargerLieux(), DELAI_MS)
      .then((l) => actif && setListes(l.length ? l : null))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [champLieu]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const majLieu = (v: Partial<ValeurLieu>) => {
    setLieu((x) => ({ ...x, ...v }));
    setErreurs((e) => {
      const r = { ...e };
      delete r[`${champLieu?.name}.ville`];
      delete r[`${champLieu?.name}.quartier`];
      return r;
    });
  };

  const ville = listes?.find((v) => v.id === lieu.villeId);
  const noms: NomsLieu = {
    ville: ville?.nom ?? (lieu.villeAutre.trim() || null),
    quartier: ville?.quartiers.find((q) => q.id === lieu.quartierId)?.nom ?? (lieu.quartierAutre.trim() || null),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (champLieu?.required) {
      if (!noms.ville) e2[`${champLieu.name}.ville`] = 'Ville obligatoire';
      if (!noms.quartier) e2[`${champLieu.name}.quartier`] = 'Quartier obligatoire';
    }
    if (!consentement) e2.consentement = 'Votre accord est nécessaire pour envoyer la demande';
    setErreurs(e2);
    if (Object.keys(e2).length) return;

    setLoading(true);
    // Fenêtre ouverte pendant le clic : ouverte après l'attente réseau, elle serait bloquée.
    const fenetre = window.open('', '_blank');
    if (fenetre) {
      try {
        fenetre.opener = null;
        fenetre.document.title = 'NEXCLEAN';
        fenetre.document.body.innerHTML = '<p style="font-family:sans-serif;padding:2rem;text-align:center">Préparation de votre demande…</p>';
      } catch {
        /* fenêtre d'une autre origine : ignoré */
      }
    }

    let numero: string | null = null;
    let lienSuivi: string | null = null;
    let type = '';
    try {
      const r = await avecDelai(enregistrerDemandeDevis({ formId, valeurs: form, lieu, consentement, siteWeb }), DELAI_MS);
      if (r.ok) {
        numero = r.numero;
        lienSuivi = r.lienSuivi;
        type = r.type;
      } else if (r.erreurs && Object.keys(r.erreurs).length) {
        // Saisie refusée par le serveur : le client corrige, rien n'est ouvert.
        fenetre?.close();
        setErreurs(r.erreurs);
        setLoading(false);
        return;
      }
    } catch {
      /* repli ci-dessous */
    }

    const lienWhatsApp = getWhatsAppLink(construireMessage({ formId, subject, fields }, form, noms, numero && lienSuivi ? { numero, lienSuivi } : null));
    if (numero) trackEvent('quote_form_submit', { form: formId, type });
    else trackEvent('quote_form_fallback', { form: formId });

    let bloque = true;
    if (fenetre && !fenetre.closed) {
      fenetre.location.href = lienWhatsApp;
      bloque = false;
    }
    setLoading(false);
    setFin({ numero, lienSuivi, lienWhatsApp, bloque });
  }

  if (fin) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center" role="status">
        <CheckCircle className="w-12 h-12 text-success mb-3" strokeWidth={1.5} />
        {fin.numero ? (
          <>
            <p className="text-sm text-muted">Demande enregistrée</p>
            <p className="font-mono font-bold text-2xl text-ink-900 mb-2">n° {fin.numero}</p>
          </>
        ) : (
          <p className="font-semibold text-ink-900 mb-1">Demande prête !</p>
        )}
        <p className="text-sm text-ink-600 max-w-xs mb-5">
          {fin.bloque ? 'Ouvrez WhatsApp pour envoyer votre demande.' : 'Envoyez le message dans WhatsApp.'} Joignez vos photos ou vidéos dans la conversation WhatsApp pour un devis plus précis.
        </p>
        <Button href={fin.lienWhatsApp} variant={fin.bloque ? 'whatsapp' : 'outline'} whatsappIcon className="mb-4">
          Ouvrir WhatsApp
        </Button>
        {fin.lienSuivi && (
          <a href={fin.lienSuivi} className="text-sm text-primary underline mb-4">
            Suivre ma demande
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setForm(vide);
            setLieu(lieuVide());
            setConsentement(false);
            setFin(null);
          }}
        >
          Faire une nouvelle demande
        </Button>
      </div>
    );
  }

  const erreur = (cle: string) => erreurs[cle] && <p className="text-xs text-danger mt-1">{erreurs[cle]}</p>;

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
      {/* Champ piège anti-robot */}
      <div className="hidden" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" name="siteWeb" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
      </div>

      {fields.map((f) => {
        const id = `${formId}-${f.name}`;
        if (f.type === 'lieu') {
          const idV = `${id}-ville`;
          const idQ = `${id}-quartier`;
          return (
            <div key={f.name} className="contents">
              <div>
                <label htmlFor={idV} className={labelClass}>
                  Ville {f.required && <span className="text-accent">*</span>}
                </label>
                {listes ? (
                  <>
                    <select
                      id={idV}
                      value={lieu.villeId ?? (lieu.villeAutre !== '' ? 'autre' : '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        majLieu(v === 'autre' ? { villeId: null, villeAutre: ' ', quartierId: null, quartierAutre: '' } : { villeId: v ? Number(v) : null, villeAutre: '', quartierId: null, quartierAutre: '' });
                      }}
                      className={inputClass}
                    >
                      <option value="">Sélectionnez…</option>
                      {listes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nom}
                        </option>
                      ))}
                      <option value="autre">Autre</option>
                    </select>
                    {lieu.villeId === null && lieu.villeAutre !== '' && (
                      <input aria-label="Nom de la ville" placeholder="Nom de la ville" maxLength={80} value={lieu.villeAutre.trimStart()} onChange={(e) => majLieu({ villeAutre: e.target.value || ' ' })} className={`${inputClass} mt-2`} />
                    )}
                  </>
                ) : (
                  <input id={idV} maxLength={80} placeholder="Douala, Yaoundé…" value={lieu.villeAutre} onChange={(e) => majLieu({ villeId: null, villeAutre: e.target.value })} className={inputClass} />
                )}
                {erreur(`${f.name}.ville`)}
              </div>
              <div>
                <label htmlFor={idQ} className={labelClass}>
                  Quartier {f.required && <span className="text-accent">*</span>}
                </label>
                {ville && lieu.quartierAutre === '' ? (
                  <select
                    id={idQ}
                    value={lieu.quartierId ?? ''}
                    onChange={(e) => (e.target.value === 'autre' ? majLieu({ quartierId: null, quartierAutre: ' ' }) : majLieu({ quartierId: e.target.value ? Number(e.target.value) : null }))}
                    className={inputClass}
                  >
                    <option value="">Sélectionnez…</option>
                    {ville.quartiers.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.nom}
                      </option>
                    ))}
                    <option value="autre">Autre</option>
                  </select>
                ) : (
                  <input
                    id={idQ}
                    maxLength={80}
                    placeholder="Bonapriso, Akwa…"
                    value={lieu.quartierAutre.trimStart()}
                    onChange={(e) => majLieu({ quartierId: null, quartierAutre: e.target.value || (ville ? ' ' : '') })}
                    className={inputClass}
                  />
                )}
                {erreur(`${f.name}.quartier`)}
              </div>
            </div>
          );
        }
        const common = {
          id,
          name: f.name,
          required: f.required,
          value: form[f.name],
          onChange: handleChange,
          placeholder: f.placeholder,
        };
        return (
          <div key={f.name} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label htmlFor={id} className={labelClass}>
              {f.label} {f.required && <span className="text-accent">*</span>}
            </label>
            {f.type === 'select' ? (
              <select {...common} className={inputClass}>
                <option value="">Sélectionnez…</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea {...common} rows={3} className={`${inputClass} resize-none`} />
            ) : (
              <input {...common} type={f.type || 'text'} inputMode={f.type === 'tel' ? 'tel' : undefined} className={inputClass} />
            )}
            {erreur(f.name)}
          </div>
        );
      })}

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-sm text-ink-600">
          <input type="checkbox" checked={consentement} onChange={(e) => {
              setConsentement(e.target.checked);
              setErreurs(({ consentement: _c, ...reste }) => reste);
            }} className="h-5 w-5 mt-0.5 accent-primary shrink-0" />
          <span>
            J’accepte que NEXCLEAN traite ces informations pour répondre à ma demande et me contacte sur WhatsApp (
            <Link href="/confidentialite" target="_blank" className="text-primary underline">
              politique de confidentialité
            </Link>
            ). <span className="text-accent">*</span>
          </span>
        </label>
        {erreur('consentement')}
      </div>

      <div className="sm:col-span-2 space-y-3">
        <Button type="submit" size="lg" fullWidth loading={loading} loadingLabel="Envoi en cours…" whatsappIcon>
          {submitLabel}
        </Button>
        <p className="text-center text-xs text-muted">{note || 'Vous serez redirigé vers WhatsApp pour envoyer votre demande.'}</p>
      </div>
    </form>
  );
}
