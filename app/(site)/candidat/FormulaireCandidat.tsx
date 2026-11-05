'use client';
// MVP2-01 RG-02 : inscription en 7 étapes (brouillon conservé dans le navigateur, sans le mot de
// passe ni les fichiers), et modification du profil depuis l'espace (étapes 1 à 5).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, FileText, Plus, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card, { cardClasses } from '@/components/ui/Card';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import type { ListesLieux } from '@/lib/geo/service';
import {
  CONSENTEMENTS,
  CONTRATS,
  DISPONIBILITES,
  ETAPES_INSCRIPTION,
  HORAIRES,
  MAX_COMPETENCES,
  MAX_EXPERIENCES,
  MAX_JUSTIFICATIFS,
  MAX_METIERS,
  MENTION_GRATUITE,
  NIVEAUX_ETUDES,
  SECTEURS,
  brouillonCandidatVide,
  experienceVide,
  schemaMotDePasse,
  validerEtapeCandidat,
  type BrouillonCandidat,
  type Disponibilite,
  type ExperienceBrouillon,
  type Horaire,
} from '@/lib/candidats/domaine';
import { inscrire, modifierProfil, televerser } from './actions';

const CLE_BROUILLON = 'nexclean:inscription-candidat:v1';
const TAILLE_MAX = 5 * 1024 * 1024;
const EXTENSIONS = /\.(pdf|docx|jpe?g|png)$/i;
const idChamp = (cle: string) => `cand-${cle.replace(/\./g, '-')}`;
/** `text-red-700` reste : sélecteur des tests e2e (`p.text-red-700`, e2e/candidat.spec.ts). */
const erreurChamp = 'text-xs text-red-700 mt-1';
function Champ({ cle, libelle, requis, erreurs, aide, children }: { cle: string; libelle: string; requis?: boolean; erreurs: Record<string, string>; aide?: string; children: React.ReactNode }) {
  const err = erreurs[cle];
  return (
    <div>
      <label htmlFor={idChamp(cle)} className={labelClass}>
        {libelle} {requis && <span className="text-accent" aria-hidden>*</span>}
      </label>
      {children}
      {aide && !err && <p className="text-xs text-muted mt-1">{aide}</p>}
      {err && (
        <p id={`${idChamp(cle)}-err`} className={erreurChamp}>
          {err}
        </p>
      )}
    </div>
  );
}

const a11y = (cle: string, erreurs: Record<string, string>) => ({
  id: idChamp(cle),
  'aria-invalid': erreurs[cle] ? true : undefined,
  'aria-describedby': erreurs[cle] ? `${idChamp(cle)}-err` : undefined,
});

/** Cases à cocher multiples (secteurs, contrats, horaires, zones). */
function Cases<T extends string | number>({ nom, options, valeurs, onChange }: { nom: string; options: { valeur: T; libelle: string }[]; valeurs: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const coche = valeurs.includes(o.valeur);
        return (
          <label key={String(o.valeur)} className={`flex items-center gap-2 min-h-11 px-3 rounded-2xl border text-sm ${coche ? 'border-primary bg-primary/5' : 'border-ink-200'}`}>
            <input type="checkbox" name={nom} checked={coche} onChange={() => onChange(coche ? valeurs.filter((v) => v !== o.valeur) : [...valeurs, o.valeur])} className="h-5 w-5 accent-primary shrink-0" />
            <span>{o.libelle}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Saisie d'étiquettes (métiers, compétences), avec suggestions facultatives. */
function Etiquettes({ cle, valeurs, max, suggestions, placeholder, onChange, erreurs }: { cle: string; valeurs: string[]; max: number; suggestions?: string[]; placeholder: string; onChange: (v: string[]) => void; erreurs: Record<string, string> }) {
  const [saisie, setSaisie] = useState('');
  const ajouter = () => {
    const v = saisie.trim().replace(/\s+/g, ' ');
    if (!v || valeurs.some((x) => x.toLowerCase() === v.toLowerCase()) || valeurs.length >= max) return setSaisie('');
    onChange([...valeurs, v.slice(0, 80)]);
    setSaisie('');
  };
  const liste = `${idChamp(cle)}-suggestions`;
  return (
    <div>
      {valeurs.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {valeurs.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 pl-3 pr-1 min-h-9 rounded-full bg-primary/10 text-sm text-ink-900">
              {v}
              <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(valeurs.filter((x) => x !== v))} className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-primary/20">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {valeurs.length < max && (
        <div className="flex gap-2">
          <input
            {...a11y(cle, erreurs)}
            value={saisie}
            list={suggestions ? liste : undefined}
            placeholder={placeholder}
            maxLength={80}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                ajouter();
              }
            }}
            className={inputClass}
          />
          <Button variant="outline" icon={Plus} onClick={ajouter} className="shrink-0">
            Ajouter
          </Button>
        </div>
      )}
      {suggestions && (
        <datalist id={liste}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

type Props =
  | { mode: 'inscription'; listes: ListesLieux; metiers: string[]; dejaConnecte: boolean }
  | { mode: 'modification'; listes: ListesLieux; metiers: string[]; initial: BrouillonCandidat };

type Envois = { nom: string; ok: boolean; message: string }[];

export default function FormulaireCandidat(props: Props) {
  const { listes, metiers, mode } = props;
  const inscription = mode === 'inscription';
  const derniere = inscription ? 7 : 5;
  const etapes = inscription ? ETAPES_INSCRIPTION : ETAPES_INSCRIPTION.slice(0, 5);
  const router = useRouter();
  const [b, setB] = useState<BrouillonCandidat>(() => (props.mode === 'modification' ? props.initial : brouillonCandidatVide()));
  const [etape, setEtape] = useState(1);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [charge, setCharge] = useState(!inscription);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [dejaInscrit, setDejaInscrit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [termine, setTermine] = useState<Envois | null>(null);
  const [siteWeb, setSiteWeb] = useState('');
  // Étapes 6 et 7 (inscription) : jamais conservées dans le brouillon.
  const [cv, setCv] = useState<File | null>(null);
  const [justificatifs, setJustificatifs] = useState<File[]>([]);
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [voirMdp, setVoirMdp] = useState(false);
  const [resterConnecte, setResterConnecte] = useState(true);
  const haut = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!inscription) return;
    try {
      const s = localStorage.getItem(CLE_BROUILLON);
      if (s) {
        const lu = JSON.parse(s) as { etape?: number; b?: Partial<BrouillonCandidat> };
        if (lu.b) setB({ ...brouillonCandidatVide(), ...lu.b, consentementTraitement: false, consentementContact: false, consentementMajorite: false });
        if (lu.etape && lu.etape >= 1 && lu.etape <= 7) setEtape(lu.etape);
      }
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
    setCharge(true);
  }, [inscription]);
  useEffect(() => {
    if (!inscription || !charge || termine) return;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify({ etape, b: { ...b, consentementTraitement: false, consentementContact: false, consentementMajorite: false } }));
    } catch {
      /* stockage plein ou désactivé */
    }
  }, [b, etape, charge, termine, inscription]);

  const ville = listes.find((v) => v.id === b.villeId);
  const quartiers = useMemo(() => (ville ? ville.quartiers.filter((q) => !b.arrondissementId || q.arrondissementId === b.arrondissementId) : []), [ville, b.arrondissementId]);

  const maj = (champs: Partial<BrouillonCandidat>) => {
    setB((x) => ({ ...x, ...champs }));
    setMessage(null);
    setErreurs((e) => {
      const r = { ...e };
      for (const k of Object.keys(champs)) delete r[k];
      if ('zonesTouteVille' in champs || 'zonesArrondissementIds' in champs || 'zonesQuartierIds' in champs) delete r.zones;
      return r;
    });
  };
  const majExperience = (i: number, champs: Partial<ExperienceBrouillon>) => {
    setB((x) => ({ ...x, experiences: x.experiences.map((e, j) => (j === i ? { ...e, ...champs } : e)) }));
    setErreurs((e) => {
      const r = { ...e };
      for (const k of Object.keys(champs)) delete r[`experiences.${i}.${k}`];
      return r;
    });
  };

  const allerA = (n: number) => {
    setEtape(n);
    setErreurs({});
    setEchec(null);
    setMessage(null);
    requestAnimationFrame(() => haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const erreursEtape = (n: number): Record<string, string> => {
    if (n === 6) {
      const e: Record<string, string> = {};
      if (cv && (cv.size > TAILLE_MAX || !EXTENSIONS.test(cv.name))) e.cv = 'PDF, DOCX, JPEG ou PNG, 5 Mo maximum';
      if (justificatifs.some((f) => f.size > TAILLE_MAX || !EXTENSIONS.test(f.name))) e.justificatifs = 'Chaque fichier : PDF, DOCX, JPEG ou PNG, 5 Mo maximum';
      return e;
    }
    const e = validerEtapeCandidat(n, b);
    if (n === 7) {
      const m = schemaMotDePasse.safeParse(motDePasse);
      if (!m.success) e.motDePasse = m.error.issues[0]!.message;
      else if (motDePasse !== confirmation) e.confirmation = 'Les deux mots de passe ne correspondent pas';
    }
    return e;
  };

  const valider = (n: number) => {
    const e = erreursEtape(n);
    setErreurs(e);
    const premiere = Object.keys(e)[0];
    if (premiere) {
      requestAnimationFrame(() => {
        const el = document.getElementById(idChamp(premiere)) ?? haut.current;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
      });
      return false;
    }
    return true;
  };

  const suivant = () => valider(etape) && allerA(etape + 1);

  /** Revient sur la première étape invalide (validation complète avant l'envoi). */
  const premiereEtapeInvalide = () => [1, 2, 3, 4, 5, ...(inscription ? [6] : [])].find((n) => Object.keys(erreursEtape(n)).length > 0);

  async function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    const invalide = premiereEtapeInvalide();
    if (invalide) {
      allerA(invalide);
      setTimeout(() => valider(invalide), 50);
      return;
    }
    if (inscription && !valider(7)) return;
    setEnvoi(true);
    setEchec(null);
    setDejaInscrit(false);
    try {
      if (!inscription) {
        const r = await modifierProfil(b);
        if (r.ok) {
          setMessage(r.message ?? 'Profil enregistré.');
          router.refresh();
        } else setEchec(r.erreur);
        return;
      }
      const r = await inscrire({ brouillon: b, motDePasse, resterConnecte, siteWeb });
      if (!r.ok) {
        setDejaInscrit(!!r.dejaInscrit);
        // Tout est validé dans le navigateur avant l'envoi : l'erreur restante (numéro déjà inscrit,
        // envoi refusé…) s'affiche sous le formulaire.
        setEchec(r.erreur);
        return;
      }
      // Documents : un fichier par envoi, après la création du compte (session ouverte).
      const envois: Envois = [];
      for (const [f, categorie] of [...(cv ? [[cv, 'cv'] as const] : []), ...justificatifs.map((j) => [j, 'justificatif'] as const)]) {
        const fd = new FormData();
        fd.set('fichier', f);
        fd.set('categorie', categorie);
        try {
          const rf = await televerser(fd);
          envois.push({ nom: f.name, ok: rf.ok, message: rf.ok ? 'enregistré' : rf.erreur });
        } catch {
          envois.push({ nom: f.name, ok: false, message: 'envoi impossible' });
        }
      }
      try {
        localStorage.removeItem(CLE_BROUILLON);
      } catch {
        /* ignoré */
      }
      trackEvent('candidate_signup', { metiers: b.metiers.length, documents: envois.filter((x) => x.ok).length });
      setTermine(envois);
      requestAnimationFrame(() => haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      setEchec('Connexion impossible. Vos informations sont conservées : réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  // ─── Confirmation (RG-05) ───────────────────────────────────
  if (termine) {
    const texteWa = `Bonjour NEXCLEAN, je viens de m’inscrire comme candidat(e) : ${b.prenom} ${b.nom}, ${b.telephone}. Métier(s) recherché(s) : ${b.metiers.join(', ')}.`;
    return (
      <div className={cardClasses({ className: 'text-center' })} role="status">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="font-display text-h3 text-ink-900">Inscription réussie</h2>
        <p className="text-ink-600 mt-2">Bienvenue {b.prenom}. Un conseiller NEXCLEAN étudie votre profil et vous contacte quand une offre vous correspond.</p>
        {termine.length > 0 && (
          <ul className="text-sm text-left mt-4 space-y-1">
            {termine.map((t) => (
              <li key={t.nom} className={t.ok ? 'text-ink-700' : 'text-danger'}>
                {t.ok ? '✓' : '✗'} {t.nom} : {t.message}
              </li>
            ))}
          </ul>
        )}
        {termine.some((t) => !t.ok) && <p className="text-sm text-ink-600 mt-2">Vous pourrez ajouter ces documents depuis votre espace.</p>}
        <div className="mt-6 space-y-3">
          <Button href={getWhatsAppLink(texteWa)} variant="whatsapp" whatsappIcon fullWidth>
            Recevoir la confirmation sur WhatsApp
          </Button>
          <Button href="/candidat/espace" variant="outline" fullWidth>
            Accéder à mon espace
          </Button>
        </div>
      </div>
    );
  }

  // Session déjà ouverte (visite ultérieure, ou rafraîchissement du serveur pendant l'envoi) :
  // le formulaire reste monté pour ne pas perdre l'écran de confirmation ci-dessus.
  if (props.mode === 'inscription' && props.dejaConnecte && !envoi)
    return (
      <div className={cardClasses({ className: 'text-center' })} role="status">
        <p className="text-ink-700">Vous êtes déjà connecté(e) à votre espace candidat.</p>
        <Button href="/candidat/espace" className="mt-4 self-center">
          Accéder à mon espace
        </Button>
      </div>
    );

  return (
    <form onSubmit={envoyer} noValidate className="scroll-mt-28" ref={haut}>
      <ol className={`grid gap-1.5 mb-5 ${inscription ? 'grid-cols-7' : 'grid-cols-5'}`} aria-label="Étapes">
        {etapes.map((nom, i) => (
          <li key={nom} aria-current={etape === i + 1 ? 'step' : undefined}>
            <button type="button" disabled={inscription && i + 1 > etape} onClick={() => allerA(i + 1)} className="block w-full text-left disabled:cursor-default">
              <span className={`block h-1.5 rounded-full ${i + 1 <= etape ? 'bg-primary' : 'bg-ink-200'}`} />
              <span className={`block text-xs leading-tight mt-1 ${i + 1 === etape ? 'font-semibold text-ink-900' : 'text-muted'}`}>{i + 1 === etape ? nom : i + 1}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} name="siteWeb" />
        </label>
      </div>

      <Card padding="sm" className="space-y-4">
        {etape === 1 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Identité</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Champ cle="prenom" libelle="Prénom" requis erreurs={erreurs}>
                <input {...a11y('prenom', erreurs)} value={b.prenom} maxLength={80} autoComplete="given-name" onChange={(e) => maj({ prenom: e.target.value })} className={inputClass} />
              </Champ>
              <Champ cle="nom" libelle="Nom" requis erreurs={erreurs}>
                <input {...a11y('nom', erreurs)} value={b.nom} maxLength={80} autoComplete="family-name" onChange={(e) => maj({ nom: e.target.value })} className={inputClass} />
              </Champ>
            </div>
            <Champ cle="telephone" libelle="Téléphone" requis erreurs={erreurs} aide={inscription ? 'Il vous servira à vous connecter.' : 'Pour changer de numéro, contactez NEXCLEAN : la procédure est faite avec un conseiller.'}>
              <input {...a11y('telephone', erreurs)} type="tel" inputMode="tel" autoComplete="tel" placeholder="6 90 00 00 00" value={b.telephone} disabled={!inscription} onChange={(e) => maj({ telephone: e.target.value })} className={`${inputClass} disabled:bg-ink-100 disabled:text-muted`} />
            </Champ>
            <label className="flex items-center gap-3 min-h-11 text-sm text-ink-700">
              <input type="checkbox" checked={b.whatsappIdentique} onChange={(e) => maj({ whatsappIdentique: e.target.checked, whatsapp: e.target.checked ? '' : b.whatsapp })} className="h-5 w-5 accent-primary" />
              Mon numéro WhatsApp est le même
            </label>
            {!b.whatsappIdentique && (
              <Champ cle="whatsapp" libelle="Numéro WhatsApp" requis erreurs={erreurs}>
                <input {...a11y('whatsapp', erreurs)} type="tel" inputMode="tel" placeholder="6 90 00 00 00" value={b.whatsapp} onChange={(e) => maj({ whatsapp: e.target.value })} className={inputClass} />
              </Champ>
            )}
            <Champ cle="email" libelle="E-mail" erreurs={erreurs} aide="Facultatif, mais utile pour récupérer votre mot de passe seul(e).">
              <input {...a11y('email', erreurs)} type="email" inputMode="email" autoComplete="email" value={b.email} onChange={(e) => maj({ email: e.target.value })} className={inputClass} />
            </Champ>
          </>
        )}

        {etape === 2 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Localisation</h2>
            <Champ cle="villeId" libelle="Ville" requis erreurs={erreurs}>
              <select
                {...a11y('villeId', erreurs)}
                value={b.villeId ?? (b.villeAutre !== '' ? 'autre' : '')}
                onChange={(e) => {
                  const v = e.target.value;
                  const raz = { arrondissementId: null, quartierId: null, quartierAutre: '', zonesArrondissementIds: [], zonesQuartierIds: [] };
                  if (v === 'autre') maj({ villeId: null, villeAutre: ' ', ...raz, zonesTouteVille: true });
                  else maj({ villeId: v ? Number(v) : null, villeAutre: '', ...raz });
                }}
                className={inputClass}
              >
                <option value="">Choisir…</option>
                {listes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nom}
                  </option>
                ))}
                <option value="autre">Autre ville</option>
              </select>
            </Champ>
            {!b.villeId && b.villeAutre !== '' && (
              <Champ cle="villeAutre" libelle="Nom de la ville" requis erreurs={erreurs}>
                <input {...a11y('villeAutre', erreurs)} value={b.villeAutre.trimStart()} maxLength={80} onChange={(e) => maj({ villeAutre: e.target.value || ' ' })} className={inputClass} />
              </Champ>
            )}
            {ville && ville.arrondissements.length > 0 && (
              <Champ cle="arrondissementId" libelle="Arrondissement" erreurs={erreurs}>
                <select {...a11y('arrondissementId', erreurs)} value={b.arrondissementId ?? ''} onChange={(e) => maj({ arrondissementId: e.target.value ? Number(e.target.value) : null, quartierId: null })} className={inputClass}>
                  <option value="">Je ne sais pas</option>
                  {ville.arrondissements.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
            <Champ cle="quartierId" libelle="Quartier" requis erreurs={erreurs}>
              {ville && b.quartierAutre === '' ? (
                <select {...a11y('quartierId', erreurs)} value={b.quartierId ?? ''} onChange={(e) => (e.target.value === 'autre' ? maj({ quartierId: null, quartierAutre: ' ' }) : maj({ quartierId: e.target.value ? Number(e.target.value) : null }))} className={inputClass}>
                  <option value="">Choisir…</option>
                  {quartiers.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nom}
                    </option>
                  ))}
                  <option value="autre">Autre quartier</option>
                </select>
              ) : (
                <input {...a11y('quartierId', erreurs)} value={b.quartierAutre.trimStart()} maxLength={80} placeholder="Nom du quartier" onChange={(e) => maj({ quartierId: null, quartierAutre: e.target.value || (ville ? ' ' : '') })} className={inputClass} />
              )}
            </Champ>
            <Champ cle="repere" libelle="Point de repère" erreurs={erreurs} aide="Ex. : face à la pharmacie du carrefour.">
              <input {...a11y('repere', erreurs)} value={b.repere} maxLength={160} onChange={(e) => maj({ repere: e.target.value })} className={inputClass} />
            </Champ>
            <fieldset>
              <legend className={labelClass}>
                Où acceptez-vous de travailler ? <span className="text-accent">*</span>
              </legend>
              <label className={`flex items-center gap-2 min-h-11 px-3 mb-2 rounded-2xl border text-sm ${b.zonesTouteVille ? 'border-primary bg-primary/5' : 'border-ink-200'}`}>
                <input id={idChamp('zones')} type="checkbox" checked={b.zonesTouteVille} onChange={(e) => maj({ zonesTouteVille: e.target.checked })} className="h-5 w-5 accent-primary" />
                Toute la ville
              </label>
              {!b.zonesTouteVille && ville && ville.arrondissements.length > 0 && (
                <Cases
                  nom="zones"
                  options={ville.arrondissements.map((a) => ({ valeur: a.id, libelle: a.nom }))}
                  valeurs={b.zonesArrondissementIds}
                  onChange={(v) => maj({ zonesArrondissementIds: v })}
                />
              )}
              {erreurs.zones && <p className={erreurChamp}>{erreurs.zones}</p>}
            </fieldset>
          </>
        )}

        {etape === 3 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Recherche</h2>
            <Champ cle="metiers" libelle={`Métiers recherchés (1 à ${MAX_METIERS})`} requis erreurs={erreurs} aide="Choisissez dans la liste ou écrivez le vôtre, puis « Ajouter ».">
              <Etiquettes cle="metiers" valeurs={b.metiers} max={MAX_METIERS} suggestions={metiers} placeholder="Ex. : agent d’entretien" onChange={(v) => maj({ metiers: v })} erreurs={erreurs} />
            </Champ>
            <fieldset>
              <legend className={labelClass}>
                Types de contrat <span className="text-accent">*</span>
              </legend>
              <Cases nom="typesContrat" options={CONTRATS.map((c) => ({ valeur: c as string, libelle: c }))} valeurs={b.typesContrat} onChange={(v) => maj({ typesContrat: v })} />
              {erreurs.typesContrat && <p id={idChamp('typesContrat')} className={erreurChamp}>{erreurs.typesContrat}</p>}
            </fieldset>
            <fieldset>
              <legend className={labelClass}>Secteurs souhaités</legend>
              <Cases nom="secteurs" options={SECTEURS.map((s) => ({ valeur: s as string, libelle: s }))} valeurs={b.secteurs} onChange={(v) => maj({ secteurs: v })} />
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
              <Champ cle="salaireMin" libelle="Salaire souhaité, minimum (FCFA)" erreurs={erreurs}>
                <input {...a11y('salaireMin', erreurs)} inputMode="numeric" placeholder="60 000" value={b.salaireMin} onChange={(e) => maj({ salaireMin: e.target.value })} className={inputClass} />
              </Champ>
              <Champ cle="salaireMax" libelle="Maximum (FCFA)" erreurs={erreurs}>
                <input {...a11y('salaireMax', erreurs)} inputMode="numeric" placeholder="90 000" value={b.salaireMax} onChange={(e) => maj({ salaireMax: e.target.value })} className={inputClass} />
              </Champ>
            </div>
          </>
        )}

        {etape === 4 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Parcours</h2>
            <Champ cle="niveauEtudes" libelle="Niveau d’études" requis erreurs={erreurs}>
              <select {...a11y('niveauEtudes', erreurs)} value={b.niveauEtudes} onChange={(e) => maj({ niveauEtudes: e.target.value })} className={inputClass}>
                <option value="">Choisir…</option>
                {NIVEAUX_ETUDES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ cle="qualifications" libelle="Diplômes, formations, qualifications" erreurs={erreurs}>
              <textarea {...a11y('qualifications', erreurs)} rows={3} maxLength={1000} value={b.qualifications} onChange={(e) => maj({ qualifications: e.target.value })} className={inputClass} />
            </Champ>
            <div className="space-y-3">
              <p className={labelClass}>Expériences ({b.experiences.length}/{MAX_EXPERIENCES})</p>
              {b.experiences.map((x, i) => (
                <fieldset key={i} className="border border-ink-200 rounded-2xl p-4 space-y-3">
                  <legend className="px-1 text-sm font-semibold text-ink-900">Expérience {i + 1}</legend>
                  <Champ cle={`experiences.${i}.poste`} libelle="Poste occupé" requis erreurs={erreurs}>
                    <input {...a11y(`experiences.${i}.poste`, erreurs)} value={x.poste} maxLength={120} onChange={(e) => majExperience(i, { poste: e.target.value })} className={inputClass} />
                  </Champ>
                  <div className="grid grid-cols-2 gap-3">
                    <Champ cle={`experiences.${i}.employeur`} libelle="Employeur" erreurs={erreurs}>
                      <input {...a11y(`experiences.${i}.employeur`, erreurs)} value={x.employeur} maxLength={120} onChange={(e) => majExperience(i, { employeur: e.target.value })} className={inputClass} />
                    </Champ>
                    <Champ cle={`experiences.${i}.ville`} libelle="Ville" erreurs={erreurs}>
                      <input {...a11y(`experiences.${i}.ville`, erreurs)} value={x.ville} maxLength={80} onChange={(e) => majExperience(i, { ville: e.target.value })} className={inputClass} />
                    </Champ>
                  </div>
                  <Champ cle={`experiences.${i}.duree`} libelle="Durée" erreurs={erreurs} aide="Ex. : 2 ans, ou de 2021 à 2023.">
                    <input {...a11y(`experiences.${i}.duree`, erreurs)} value={x.duree} maxLength={60} onChange={(e) => majExperience(i, { duree: e.target.value })} className={inputClass} />
                  </Champ>
                  <Champ cle={`experiences.${i}.missions`} libelle="Missions" erreurs={erreurs}>
                    <textarea {...a11y(`experiences.${i}.missions`, erreurs)} rows={2} maxLength={1000} value={x.missions} onChange={(e) => majExperience(i, { missions: e.target.value })} className={inputClass} />
                  </Champ>
                  <button type="button" onClick={() => maj({ experiences: b.experiences.filter((_, j) => j !== i) })} className="inline-flex items-center gap-1 min-h-tap text-sm font-medium text-danger">
                    <Trash2 className="w-4 h-4" /> Retirer cette expérience
                  </button>
                </fieldset>
              ))}
              {b.experiences.length < MAX_EXPERIENCES && (
                <Button variant="outline" icon={Plus} onClick={() => maj({ experiences: [...b.experiences, experienceVide()] })}>
                  Ajouter une expérience
                </Button>
              )}
            </div>
            <Champ cle="competences" libelle="Compétences" erreurs={erreurs} aide="Ex. : repassage, caisse, permis B, anglais.">
              <Etiquettes cle="competences" valeurs={b.competences} max={MAX_COMPETENCES} placeholder="Une compétence" onChange={(v) => maj({ competences: v })} erreurs={erreurs} />
            </Champ>
          </>
        )}

        {etape === 5 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Disponibilité</h2>
            <fieldset>
              <legend className={labelClass}>
                Quand pouvez-vous commencer ? <span className="text-accent">*</span>
              </legend>
              <div className="space-y-2">
                {(Object.keys(DISPONIBILITES) as Disponibilite[]).map((d, i) => (
                  <label key={d} className={`flex items-center gap-2 min-h-11 px-3 rounded-2xl border text-sm ${b.disponibilite === d ? 'border-primary bg-primary/5' : 'border-ink-200'}`}>
                    <input id={i === 0 ? idChamp('disponibilite') : undefined} type="radio" name="disponibilite" checked={b.disponibilite === d} onChange={() => maj({ disponibilite: d })} className="h-5 w-5 accent-primary" />
                    {DISPONIBILITES[d]}
                  </label>
                ))}
              </div>
              {erreurs.disponibilite && <p className={erreurChamp}>{erreurs.disponibilite}</p>}
            </fieldset>
            {b.disponibilite === 'a_partir_du' && (
              <Champ cle="disponibleLe" libelle="À partir du" requis erreurs={erreurs}>
                <input {...a11y('disponibleLe', erreurs)} type="date" value={b.disponibleLe} onChange={(e) => maj({ disponibleLe: e.target.value })} className={inputClass} />
              </Champ>
            )}
            {b.disponibilite === 'preavis' && (
              <Champ cle="preavis" libelle="Durée du préavis" requis erreurs={erreurs} aide="Ex. : 1 mois.">
                <input {...a11y('preavis', erreurs)} value={b.preavis} maxLength={80} onChange={(e) => maj({ preavis: e.target.value })} className={inputClass} />
              </Champ>
            )}
            <fieldset>
              <legend className={labelClass}>Horaires possibles</legend>
              <Cases nom="horaires" options={(Object.keys(HORAIRES) as Horaire[]).map((h) => ({ valeur: h, libelle: HORAIRES[h] }))} valeurs={b.horaires} onChange={(v) => maj({ horaires: v })} />
            </fieldset>
          </>
        )}

        {etape === 6 && inscription && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Documents</h2>
            <p className="text-sm text-ink-600">Facultatif : vous pourrez aussi les ajouter plus tard depuis votre espace. PDF, Word (DOCX), photo JPEG ou PNG, 5 Mo maximum par fichier.</p>
            <Champ cle="cv" libelle="CV" erreurs={erreurs} aide="Une photo nette de votre CV papier convient.">
              <input id={idChamp('cv')} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,image/*" onChange={(e) => setCv(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-2xl file:border-0 file:bg-primary/10 file:text-ink-900" />
            </Champ>
            {cv && (
              <p className="flex items-center gap-2 text-sm text-ink-700">
                <FileText className="w-4 h-4" /> {cv.name} ({Math.ceil(cv.size / 1024)} Ko)
              </p>
            )}
            <Champ cle="justificatifs" libelle={`Justificatifs : diplômes, attestations… (${justificatifs.length}/${MAX_JUSTIFICATIFS})`} erreurs={erreurs}>
              {justificatifs.length < MAX_JUSTIFICATIFS ? (
                <input
                  id={idChamp('justificatifs')}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.jpg,.jpeg,.png,image/*"
                  onChange={(e) => {
                    const ajout = Array.from(e.target.files ?? []);
                    setJustificatifs((j) => [...j, ...ajout].slice(0, MAX_JUSTIFICATIFS));
                    e.target.value = '';
                  }}
                  className="block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-2xl file:border-0 file:bg-primary/10 file:text-ink-900"
                />
              ) : null}
            </Champ>
            {justificatifs.length > 0 && (
              <ul className="space-y-1">
                {justificatifs.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-sm text-ink-700">
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 shrink-0" /> <span className="truncate">{f.name}</span>
                    </span>
                    <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setJustificatifs((j) => j.filter((_, k) => k !== i))} className="w-11 h-11 inline-flex items-center justify-center text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {etape === 7 && inscription && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Compte</h2>
            <Champ cle="motDePasse" libelle="Mot de passe" requis erreurs={erreurs} aide="Au moins 8 caractères, ou un code de 6 chiffres.">
              <div className="relative">
                <input {...a11y('motDePasse', erreurs)} type={voirMdp ? 'text' : 'password'} autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${inputClass} pr-12`} />
                <button type="button" aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setVoirMdp((v) => !v)} className="absolute right-0 top-0 h-full w-12 inline-flex items-center justify-center text-muted">
                  {voirMdp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </Champ>
            <Champ cle="confirmation" libelle="Confirmez le mot de passe" requis erreurs={erreurs}>
              <input {...a11y('confirmation', erreurs)} type={voirMdp ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} />
            </Champ>
            <label className="flex items-center gap-3 min-h-11 text-sm text-ink-700">
              <input type="checkbox" checked={resterConnecte} onChange={(e) => setResterConnecte(e.target.checked)} className="h-5 w-5 accent-primary" />
              Rester connecté(e) sur ce téléphone
            </label>
            <div className="space-y-3 pt-2">
              {(
                [
                  ['consentementTraitement', CONSENTEMENTS.traitement.texte],
                  ['consentementContact', CONSENTEMENTS.contact.texte],
                  ['consentementMajorite', CONSENTEMENTS.majorite.texte],
                ] as const
              ).map(([cle, texte]) => (
                <div key={cle}>
                  <label className="flex items-start gap-3 text-sm text-ink-700">
                    <input {...a11y(cle, erreurs)} type="checkbox" checked={b[cle]} onChange={(e) => maj({ [cle]: e.target.checked })} className="h-5 w-5 mt-0.5 accent-primary shrink-0" />
                    <span>{texte}</span>
                  </label>
                  {erreurs[cle] && <p className={`${erreurChamp} ml-8`}>{erreurs[cle]}</p>}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              {MENTION_GRATUITE} Vous pouvez modifier votre profil ou supprimer votre compte à tout moment depuis votre espace. Voir la{' '}
              <Link href="/confidentialite" className="underline">
                politique de confidentialité
              </Link>
              .
            </p>
          </>
        )}

        {echec && (
          <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
            {echec}
            {dejaInscrit && (
              <>
                {' '}
                <Link href="/candidat/connexion" className="underline font-semibold">
                  Se connecter
                </Link>{' '}
                ·{' '}
                <Link href="/candidat/mot-de-passe-oublie" className="underline font-semibold">
                  Mot de passe oublié
                </Link>
              </>
            )}
          </div>
        )}
        {message && (
          <div role="status" className="rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm text-success">
            {message}
          </div>
        )}
      </Card>

      <div className="flex gap-3 mt-5">
        {etape > 1 && (
          <Button variant="outline" onClick={() => allerA(etape - 1)}>
            Retour
          </Button>
        )}
        {etape < derniere && (
          <Button className="flex-1" onClick={suivant}>
            Continuer
          </Button>
        )}
        {(etape === derniere || !inscription) && (
          <Button type="submit" variant={etape === derniere ? 'primary' : 'outline'} className={etape === derniere ? 'flex-1' : undefined} loading={envoi} loadingLabel="Envoi en cours…">
            {inscription ? 'Créer mon compte' : 'Enregistrer'}
          </Button>
        )}
      </div>
      {inscription && <p className="text-xs text-muted mt-3 text-center">{MENTION_GRATUITE}</p>}
    </form>
  );
}
