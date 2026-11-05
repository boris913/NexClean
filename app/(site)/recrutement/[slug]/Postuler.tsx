'use client';
// MVP2-02 RG-07, RG-12 : postuler à une offre. Candidat connecté : bouton « Postuler » et motivation
// facultative. Visiteur : formulaire court qui crée un compte candidat léger, puis invite à compléter
// le profil. Repli WhatsApp uniquement si le serveur est en erreur (ADR 0022).
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cardClasses } from '@/components/ui/Card';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import type { ListesLieux } from '@/lib/geo/service';
import { CONSENTEMENTS, DISPONIBILITES, MENTION_GRATUITE, schemaMotDePasse, type Disponibilite } from '@/lib/candidats/domaine';
import {
  MAX_MOTIVATION,
  NIVEAUX_EXPERIENCE,
  brouillonCandidatureVide,
  validerCandidatureCourte,
  type BrouillonCandidature,
  type NiveauExperience,
  type ReponseCandidature,
} from '@/lib/candidats/formulaire-candidature';

const TAILLE_MAX = 5 * 1024 * 1024;
const EXTENSIONS = /\.(pdf|docx|jpe?g|png)$/i;
const MESSAGE_RESEAU = 'Envoi en ligne momentanément indisponible.';

type Etat =
  | { type: 'saisie' }
  | { type: 'envoi' }
  | { type: 'succes'; mode: 'connecte' | 'compte_leger'; erreurCv?: string }
  | { type: 'deja_postule' }
  | { type: 'repli'; message: string };

interface Props {
  offre: { slug: string; titre: string };
  /** Métier proposé par défaut dans le formulaire court (catégorie de l'offre). */
  metier: string;
  connecte: { prenom: string } | null;
  dejaPostule: boolean;
  listes: ListesLieux;
}

const idChamp = (cle: string) => `post-${cle}`;
/** `text-red-700` reste : sélecteur des tests e2e (`p.text-red-700`, e2e/candidature.spec.ts). */
const erreurChamp = 'text-xs text-red-700 mt-1';

function Champ({ cle, libelle, requis, erreurs, aide, children }: { cle: string; libelle: string; requis?: boolean; erreurs: Record<string, string>; aide?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={idChamp(cle)} className={labelClass}>
        {libelle} {requis && <span className="text-accent" aria-hidden>*</span>}
      </label>
      {children}
      {aide && !erreurs[cle] && <p className="text-xs text-muted mt-1">{aide}</p>}
      {erreurs[cle] && (
        <p id={`${idChamp(cle)}-err`} className={erreurChamp}>
          {erreurs[cle]}
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

export default function Postuler({ offre, metier, connecte, dejaPostule, listes }: Props) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>(dejaPostule ? { type: 'deja_postule' } : { type: 'saisie' });
  const [b, setB] = useState<BrouillonCandidature>(() => brouillonCandidatureVide(metier));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [echec, setEchec] = useState<{ message: string; dejaInscrit?: boolean } | null>(null);
  const [motDePasse, setMotDePasse] = useState('');
  const [voirMdp, setVoirMdp] = useState(false);
  const [resterConnecte, setResterConnecte] = useState(true);
  const [cv, setCv] = useState<File | null>(null);
  const [siteWeb, setSiteWeb] = useState('');
  const retour = `/candidat/connexion?retour=${encodeURIComponent(`/recrutement/${offre.slug}#candidature`)}`;

  const ville = listes.find((v) => v.id === b.villeId);
  const quartiers = useMemo(() => ville?.quartiers ?? [], [ville]);

  const maj = (champs: Partial<BrouillonCandidature>) => {
    setB((x) => ({ ...x, ...champs }));
    setErreurs((e) => {
      const r = { ...e };
      for (const k of Object.keys(champs)) delete r[k];
      return r;
    });
  };

  const messageRepli = () =>
    connecte
      ? `Bonjour NEXCLEAN, je souhaite postuler à l’offre « ${offre.titre} ». Je suis ${connecte.prenom}, inscrit(e) sur le site.`
      : `Bonjour NEXCLEAN, je souhaite postuler à l’offre « ${offre.titre} ».\n\nNom : ${b.prenom} ${b.nom}\nTéléphone : ${b.telephone}\nVille / quartier : ${ville?.nom ?? b.villeAutre} / ${quartiers.find((q) => q.id === b.quartierId)?.nom ?? b.quartierAutre}\nMétier : ${b.metier}\nExpérience : ${b.experience}\n\nJe peux vous envoyer mon CV dans cette conversation.`;

  async function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    setEchec(null);
    const fd = new FormData();
    fd.set('offre', offre.slug);
    fd.set('siteWeb', siteWeb);
    if (connecte) fd.set('motivation', b.motivation);
    else {
      const v = validerCandidatureCourte(b);
      const e: Record<string, string> = v.ok ? {} : { ...v.erreurs };
      const m = schemaMotDePasse.safeParse(motDePasse);
      if (!m.success) e.motDePasse = m.error.issues[0]!.message;
      if (cv && (cv.size > TAILLE_MAX || !EXTENSIONS.test(cv.name))) e.cv = 'PDF, DOCX, JPEG ou PNG, 5 Mo maximum';
      setErreurs(e);
      const premiere = Object.keys(e)[0];
      if (premiere) {
        requestAnimationFrame(() => document.getElementById(idChamp(premiere))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      fd.set('donnees', JSON.stringify(b));
      fd.set('motDePasse', motDePasse);
      fd.set('resterConnecte', resterConnecte ? '1' : '0');
      if (cv) fd.set('cv', cv);
    }
    setEtat({ type: 'envoi' });
    try {
      const res = await fetch('/api/candidature', { method: 'POST', body: fd });
      const r = (await res.json().catch(() => null)) as ReponseCandidature | null;
      if (res.status >= 500 || !r) return setEtat({ type: 'repli', message: messageRepli() });
      if (r.ok) {
        trackEvent('job_application_submit', { position: offre.slug, source: r.mode });
        setEtat({ type: 'succes', mode: r.mode, erreurCv: cv && !r.cvEnregistre ? (r.erreurCv ?? 'CV non enregistré') : undefined });
        router.refresh();
        return;
      }
      if (r.code === 'deja_postule') return setEtat({ type: 'deja_postule' });
      setEtat({ type: 'saisie' });
      setEchec({ message: r.erreur, dejaInscrit: r.code === 'deja_inscrit' });
    } catch {
      setEtat({ type: 'repli', message: messageRepli() });
    }
  }

  const carte = cardClasses({ padding: 'sm' });

  if (etat.type === 'deja_postule')
    return (
      <div className={`${carte} text-center`} role="status">
        <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-ink-900">Vous avez déjà postulé à cette offre.</p>
        <p className="text-sm text-ink-600 mt-1">Suivez votre candidature depuis votre espace candidat.</p>
        <Button href="/candidat/espace" className="mt-4 self-center">
          Mon espace candidat
        </Button>
      </div>
    );

  if (etat.type === 'succes')
    return (
      <div className={`${carte} text-center`} role="status">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" strokeWidth={1.5} />
        <h3 className="font-display text-h3 text-ink-900">Candidature envoyée</h3>
        {etat.mode === 'compte_leger' ? (
          <>
            <p className="text-ink-600 mt-2">
              Merci {b.prenom}. Votre compte candidat est créé : un conseiller NEXCLEAN étudie votre candidature et vous contacte si votre profil correspond.
            </p>
            <p className="text-ink-600 mt-2">
              <strong className="text-ink-900">Complétez votre profil</strong> (zones de travail, contrats, parcours) pour être proposé(e) à d’autres offres.
            </p>
          </>
        ) : (
          <p className="text-ink-600 mt-2">Un conseiller NEXCLEAN étudie votre candidature et vous contacte si votre profil correspond.</p>
        )}
        {etat.erreurCv && <p className="text-sm text-danger mt-3">Votre CV n’a pas pu être enregistré ({etat.erreurCv}). Vous pourrez l’ajouter depuis votre espace.</p>}
        <div className="mt-6 space-y-3">
          {etat.mode === 'compte_leger' && (
            <Button href="/candidat/espace/profil" fullWidth>
              Compléter mon profil
            </Button>
          )}
          <Button href="/candidat/espace" variant="outline" fullWidth>
            Mon espace candidat
          </Button>
        </div>
      </div>
    );

  if (etat.type === 'repli')
    return (
      <div className={`${carte} text-center`} role="status">
        <AlertCircle className="w-10 h-10 text-warning mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-semibold text-ink-900 mb-2">{MESSAGE_RESEAU}</p>
        <p className="text-sm text-muted max-w-md mx-auto mb-6">Votre candidature n’a pas pu être enregistrée. Envoyez-la sur WhatsApp, ou réessayez dans quelques minutes.</p>
        <div className="flex flex-col gap-3 items-center">
          <Button href={getWhatsAppLink(etat.message)} size="lg" whatsappIcon>
            Continuer sur WhatsApp
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEtat({ type: 'saisie' })}>
            Réessayer
          </Button>
        </div>
      </div>
    );

  const envoi = etat.type === 'envoi';
  const erreurEchec = echec && (
    <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
      {echec.message}
      {echec.dejaInscrit && (
        <>
          {' '}
          <Link href={retour} className="underline font-semibold">
            Se connecter pour postuler
          </Link>{' '}
          ·{' '}
          <Link href="/candidat/mot-de-passe-oublie" className="underline font-semibold">
            Mot de passe oublié
          </Link>
        </>
      )}
    </div>
  );
  const piege = (
    <div className="hidden" aria-hidden="true">
      <label>
        Site web
        <input tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} name="siteWeb" />
      </label>
    </div>
  );
  const motivation = (
    <Champ cle="motivation" libelle="Message de motivation" erreurs={erreurs} aide="Facultatif.">
      <textarea {...a11y('motivation', erreurs)} rows={4} maxLength={MAX_MOTIVATION} value={b.motivation} onChange={(e) => maj({ motivation: e.target.value })} className={`${inputClass} resize-none`} />
    </Champ>
  );
  const bouton = (libelle: string) => (
    <Button type="submit" fullWidth loading={envoi} loadingLabel="Envoi en cours…">
      {libelle}
    </Button>
  );

  // ─── Candidat connecté ──────────────────────────────────────
  if (connecte)
    return (
      <form onSubmit={envoyer} noValidate className={`${carte} space-y-4`}>
        {piege}
        <p className="text-ink-700">
          Vous êtes connecté(e) en tant que <strong>{connecte.prenom}</strong> : votre profil candidat accompagne votre candidature.
        </p>
        {motivation}
        {erreurEchec}
        {bouton('Postuler')}
      </form>
    );

  // ─── Visiteur : formulaire court (compte léger) ─────────────
  return (
    <form onSubmit={envoyer} noValidate className={`${carte} space-y-4`}>
      {piege}
      <p className="text-sm text-ink-600">
        Déjà inscrit(e) ?{' '}
        <Link href={retour} className="text-primary underline font-semibold">
          Se connecter pour postuler en un clic
        </Link>
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Champ cle="prenom" libelle="Prénom" requis erreurs={erreurs}>
          <input {...a11y('prenom', erreurs)} value={b.prenom} maxLength={80} autoComplete="given-name" onChange={(e) => maj({ prenom: e.target.value })} className={inputClass} />
        </Champ>
        <Champ cle="nom" libelle="Nom" requis erreurs={erreurs}>
          <input {...a11y('nom', erreurs)} value={b.nom} maxLength={80} autoComplete="family-name" onChange={(e) => maj({ nom: e.target.value })} className={inputClass} />
        </Champ>
      </div>
      <Champ cle="telephone" libelle="Téléphone" requis erreurs={erreurs} aide="Il vous servira à vous connecter à votre espace candidat.">
        <input {...a11y('telephone', erreurs)} type="tel" inputMode="tel" autoComplete="tel" placeholder="6 90 00 00 00" value={b.telephone} onChange={(e) => maj({ telephone: e.target.value })} className={inputClass} />
      </Champ>
      <div className="grid sm:grid-cols-2 gap-4">
        <Champ cle="villeId" libelle="Ville" requis erreurs={erreurs}>
          <select
            {...a11y('villeId', erreurs)}
            value={b.villeId ?? (b.villeAutre !== '' ? 'autre' : '')}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'autre') maj({ villeId: null, villeAutre: ' ', quartierId: null, quartierAutre: ' ' });
              else maj({ villeId: v ? Number(v) : null, villeAutre: '', quartierId: null, quartierAutre: '' });
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
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Champ cle="metier" libelle="Métier recherché" requis erreurs={erreurs}>
          <input {...a11y('metier', erreurs)} value={b.metier} maxLength={80} onChange={(e) => maj({ metier: e.target.value })} className={inputClass} />
        </Champ>
        <Champ cle="experience" libelle="Expérience" requis erreurs={erreurs}>
          <select {...a11y('experience', erreurs)} value={b.experience} onChange={(e) => maj({ experience: e.target.value as NiveauExperience })} className={inputClass}>
            <option value="">Choisir…</option>
            {NIVEAUX_EXPERIENCE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      <Champ cle="disponibilite" libelle="Disponibilité" requis erreurs={erreurs}>
        <select {...a11y('disponibilite', erreurs)} value={b.disponibilite} onChange={(e) => maj({ disponibilite: e.target.value as Disponibilite, disponibleLe: '', preavis: '' })} className={inputClass}>
          <option value="">Choisir…</option>
          {(Object.keys(DISPONIBILITES) as Disponibilite[]).map((d) => (
            <option key={d} value={d}>
              {DISPONIBILITES[d]}
            </option>
          ))}
        </select>
      </Champ>
      {b.disponibilite === 'a_partir_du' && (
        <Champ cle="disponibleLe" libelle="Disponible à partir du" requis erreurs={erreurs}>
          <input {...a11y('disponibleLe', erreurs)} type="date" value={b.disponibleLe} onChange={(e) => maj({ disponibleLe: e.target.value })} className={inputClass} />
        </Champ>
      )}
      {b.disponibilite === 'preavis' && (
        <Champ cle="preavis" libelle="Durée du préavis" requis erreurs={erreurs}>
          <input {...a11y('preavis', erreurs)} value={b.preavis} maxLength={80} placeholder="Ex. : 1 mois" onChange={(e) => maj({ preavis: e.target.value })} className={inputClass} />
        </Champ>
      )}
      <Champ cle="cv" libelle="CV (facultatif)" erreurs={erreurs} aide="PDF, DOCX, JPEG ou PNG, 5 Mo maximum. Une photo nette de votre CV papier convient.">
        <label className="flex items-center gap-3 cursor-pointer rounded-2xl border-2 border-dashed border-ink-200 hover:border-primary bg-ink-50 px-4 min-h-12 focus-within:ring-2 focus-within:ring-primary">
          <Upload className="w-5 h-5 text-primary shrink-0" />
          <span className="text-sm text-ink-600 truncate">{cv?.name || 'Choisir un fichier…'}</span>
          <input
            {...a11y('cv', erreurs)}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,image/*"
            className="sr-only"
            onChange={(e) => {
              setCv(e.target.files?.[0] ?? null);
              setErreurs((x) => {
                const r = { ...x };
                delete r.cv;
                return r;
              });
            }}
          />
        </label>
      </Champ>
      {motivation}
      <Champ cle="motDePasse" libelle="Mot de passe de votre espace candidat" requis erreurs={erreurs} aide="Au moins 8 caractères, ou un code de 6 chiffres.">
        <div className="relative">
          <input {...a11y('motDePasse', erreurs)} type={voirMdp ? 'text' : 'password'} autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className={`${inputClass} pr-12`} />
          <button type="button" aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setVoirMdp((v) => !v)} className="absolute right-0 top-0 h-full w-12 inline-flex items-center justify-center text-muted">
            {voirMdp ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </Champ>
      <label className="flex items-center gap-3 min-h-11 text-sm text-ink-700">
        <input type="checkbox" checked={resterConnecte} onChange={(e) => setResterConnecte(e.target.checked)} className="h-5 w-5 accent-primary" />
        Rester connecté(e) sur ce téléphone
      </label>
      <div className="space-y-3">
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
        {MENTION_GRATUITE} Votre candidature crée votre espace candidat : vous pourrez compléter votre profil, ou supprimer votre compte, à tout moment. Voir la{' '}
        <Link href="/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>
      {erreurEchec}
      {bouton('Envoyer ma candidature')}
    </form>
  );
}
