'use client';
// MVP1-03 §3 : formulaire en 4 étapes, brouillon conservé dans le navigateur,
// estimation avant envoi, confirmation avec récapitulatif WhatsApp, repli WhatsApp si échec.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Copy, Plus, Trash2, CopyPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card, { cardClasses } from '@/components/ui/Card';
import { inputClass, labelClass } from '@/components/forms/WhatsAppForm';
import { getWhatsAppLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';
import type { ListesLieux } from '@/lib/geo/service';
import {
  CONTRATS,
  CONTRATS_AVEC_DUREE,
  EXPERIENCES,
  JOURS,
  MAX_LIGNES,
  MAX_PERSONNES_PAR_LIGNE,
  MENTION_ESTIMATION,
  SECTEURS,
  aujourdhuiDouala,
  brouillonVide,
  estimer,
  formaterFCFA,
  ligneVide,
  recapitulatifWhatsApp,
  texteEstimation,
  totalPersonnes,
  validerEtape,
  type Brouillon,
  type Estimation,
  type LigneBrouillon,
} from '@/lib/dossiers/formulaire-personnel';
import { envoyerDemandePersonnel } from './actions';

const CLE_BROUILLON = 'nexclean:demande-personnel:v1';
const ETAPES = ['Vous', 'Lieu', 'Postes', 'Envoi'] as const;
const idChamp = (cle: string) => `dp-${cle.replace(/\./g, '-')}`;
/** `text-red-700` reste : sélecteur des tests e2e (`p.text-red-700`, e2e/parcours.spec.ts). */
const erreurChamp = 'text-xs text-red-700 mt-1';

type Confirmation = { numero: string; lienSuivi: string; estimation: Estimation };

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

/** Attributs d'accessibilité communs (lien libellé ↔ erreur). */
const a11y = (cle: string, erreurs: Record<string, string>) => ({
  id: idChamp(cle),
  'aria-invalid': erreurs[cle] ? true : undefined,
  'aria-describedby': erreurs[cle] ? `${idChamp(cle)}-err` : undefined,
});

export default function FormulairePersonnel({ listes, commission, metiers }: { listes: ListesLieux; commission: number; metiers: string[] }) {
  const [b, setB] = useState<Brouillon>(brouillonVide);
  const [etape, setEtape] = useState(1);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [charge, setCharge] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copie, setCopie] = useState(false);
  const [siteWeb, setSiteWeb] = useState('');
  const haut = useRef<HTMLDivElement>(null);

  // Brouillon : restauré au chargement, enregistré à chaque modification.
  useEffect(() => {
    try {
      const s = localStorage.getItem(CLE_BROUILLON);
      if (s) {
        const lu = JSON.parse(s) as { etape?: number; b?: Partial<Brouillon> };
        if (lu.b) setB({ ...brouillonVide(), ...lu.b, lignes: lu.b.lignes?.length ? lu.b.lignes.map((l) => ({ ...ligneVide(), ...l })) : [ligneVide()], consentement: false });
        if (lu.etape && lu.etape >= 1 && lu.etape <= 4) setEtape(lu.etape);
      }
    } catch {
      /* brouillon illisible : on repart de zéro */
    }
    setCharge(true);
  }, []);
  useEffect(() => {
    if (!charge || confirmation) return;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify({ etape, b: { ...b, consentement: false } }));
    } catch {
      /* stockage plein ou désactivé */
    }
  }, [b, etape, charge, confirmation]);

  const ville = listes.find((v) => v.id === b.villeId);
  const quartiers = useMemo(() => (ville ? ville.quartiers.filter((q) => !b.arrondissementId || q.arrondissementId === b.arrondissementId) : []), [ville, b.arrondissementId]);
  const nomVille = ville?.nom ?? b.villeAutre;
  const nomQuartier = ville?.quartiers.find((q) => q.id === b.quartierId)?.nom ?? b.quartierAutre;
  const personnes = totalPersonnes(b.lignes);
  const estimation = estimer(commission, personnes);
  const besoinImportant = b.lignes.length >= MAX_LIGNES || b.lignes.some((l) => Number(l.nombre) > MAX_PERSONNES_PAR_LIGNE);

  const maj = (champs: Partial<Brouillon>) => {
    setB((x) => ({ ...x, ...champs }));
    setErreurs((e) => {
      const r = { ...e };
      for (const k of Object.keys(champs)) delete r[k];
      return r;
    });
  };
  const majLigne = (i: number, champs: Partial<LigneBrouillon>) => {
    setB((x) => ({ ...x, lignes: x.lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)) }));
    setErreurs((e) => {
      const r = { ...e };
      for (const k of Object.keys(champs)) delete r[`lignes.${i}.${k}`];
      return r;
    });
  };

  const allerA = (n: number) => {
    setEtape(n);
    setErreurs({});
    setEchec(null);
    requestAnimationFrame(() => haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const valider = (n: number) => {
    const e = validerEtape(n, b);
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

  const recapitulatif = (detaille: boolean, c?: Confirmation) =>
    recapitulatifWhatsApp({
      numero: c?.numero,
      contact: b.contact,
      entreprise: b.clientType === 'entreprise' ? b.entreprise : null,
      ville: nomVille,
      quartier: nomQuartier,
      lignes: b.lignes,
      lienSuivi: c?.lienSuivi,
      estimation: c?.estimation ?? estimation,
      detaille,
    }) + (detaille && !c ? `\nWhatsApp : ${b.whatsapp}${b.email ? `\nE-mail : ${b.email}` : ''}${b.lieu ? `\nRepère : ${b.lieu}` : ''}${b.secteur ? `\nSecteur : ${b.secteur}` : ''}` : '');

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    for (const n of [1, 2, 3]) {
      if (Object.keys(validerEtape(n, b)).length) {
        allerA(n);
        setTimeout(() => valider(n), 50);
        return;
      }
    }
    if (!valider(4)) return;
    setEnvoi(true);
    setEchec(null);
    let r: Awaited<ReturnType<typeof envoyerDemandePersonnel>>;
    try {
      r = await envoyerDemandePersonnel({ ...b, siteWeb, commissionAffichee: commission });
    } catch {
      r = { ok: false, erreur: 'Connexion impossible. Vos informations sont conservées : réessayez ou envoyez votre demande sur WhatsApp.' };
    }
    setEnvoi(false);
    if (r.ok) {
      setConfirmation({ numero: r.numero, lienSuivi: r.lienSuivi, estimation: r.estimation });
      try {
        localStorage.removeItem(CLE_BROUILLON);
      } catch {
        /* ignoré */
      }
      trackEvent('staff_request_submit', { personnes: r.estimation.personnes });
      requestAnimationFrame(() => haut.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return;
    }
    if (r.erreurs && Object.keys(r.erreurs).length) {
      const champs = Object.keys(r.erreurs);
      const n = champs.some((k) => ['clientType', 'entreprise', 'contact', 'whatsapp', 'autreTelephone', 'email'].includes(k))
        ? 1
        : champs.some((k) => ['villeId', 'villeAutre', 'quartierId', 'quartierAutre', 'lieu', 'secteur', 'arrondissementId'].includes(k))
          ? 2
          : champs.some((k) => k.startsWith('lignes') || k === 'precisions')
            ? 3
            : 4;
      setEtape(n);
      setErreurs(r.erreurs);
      return;
    }
    setEchec(r.erreur);
  }

  // ─── Confirmation (RG-08) ───────────────────────────────────
  if (confirmation) {
    const c = confirmation;
    return (
      <div ref={haut} className={cardClasses({ className: 'text-center scroll-mt-28' })} role="status">
        <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-ink-600">Demande envoyée. Votre numéro de dossier :</p>
        <p className="font-mono font-bold text-3xl text-ink-900 my-2 break-all">{c.numero}</p>
        <p className="font-semibold text-ink-900 mt-4">{texteEstimation(c.estimation)}</p>
        <p className="text-sm text-muted">{MENTION_ESTIMATION}</p>
        <p className="mt-4 text-ink-700">Un conseiller vous contacte sous 24 h ouvrées.</p>
        <div className="mt-6 space-y-3">
          <Button href={getWhatsAppLink(recapitulatif(false, c))} variant="whatsapp" whatsappIcon fullWidth>
            Recevoir le récapitulatif sur WhatsApp
          </Button>
          <Button
            variant="outline"
            icon={Copy}
            fullWidth
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(c.lienSuivi);
                setCopie(true);
              } catch {
                window.prompt('Copiez le lien de suivi :', c.lienSuivi);
              }
            }}
          >
            {copie ? 'Lien copié ✓' : 'Copier le lien de suivi'}
          </Button>
          <a href={c.lienSuivi} className="block text-sm text-primary underline break-all">
            {c.lienSuivi}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} noValidate className="scroll-mt-28" ref={haut as unknown as React.Ref<HTMLFormElement>}>
      {/* Progression */}
      <ol className="grid grid-cols-4 gap-2 mb-5" aria-label="Étapes">
        {ETAPES.map((nom, i) => (
          <li key={nom} aria-current={etape === i + 1 ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i + 1 <= etape ? 'bg-primary' : 'bg-ink-200'}`} />
            <span className={`block text-xs mt-1 ${i + 1 === etape ? 'font-semibold text-ink-900' : 'text-muted'}`}>
              {i + 1}. {nom}
            </span>
          </li>
        ))}
      </ol>

      {/* Champ piège anti-robot */}
      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} name="siteWeb" />
        </label>
      </div>

      <Card padding="sm" className="space-y-4">
        {etape === 1 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Vous</h2>
            <fieldset>
              <legend className={labelClass}>
                Vous êtes <span className="text-accent">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['entreprise', 'particulier'] as const).map((t) => (
                  <label key={t} className={`flex items-center gap-2 min-h-12 px-3 rounded-2xl border ${b.clientType === t ? 'border-primary bg-primary/5' : 'border-ink-200'}`}>
                    <input type="radio" name="clientType" checked={b.clientType === t} onChange={() => maj({ clientType: t })} className="h-5 w-5 accent-primary" />
                    <span className="text-sm">{t === 'entreprise' ? 'Entreprise / organisation' : 'Particulier'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {b.clientType === 'entreprise' && (
              <Champ cle="entreprise" libelle="Entreprise / organisation" requis erreurs={erreurs}>
                <input {...a11y('entreprise', erreurs)} value={b.entreprise} maxLength={120} autoComplete="organization" onChange={(e) => maj({ entreprise: e.target.value })} className={inputClass} />
              </Champ>
            )}
            <Champ cle="contact" libelle="Nom du contact" requis erreurs={erreurs}>
              <input {...a11y('contact', erreurs)} value={b.contact} maxLength={80} autoComplete="name" onChange={(e) => maj({ contact: e.target.value })} className={inputClass} />
            </Champ>
            <Champ cle="whatsapp" libelle="Numéro WhatsApp" requis erreurs={erreurs} aide="Nous vous répondons sur WhatsApp.">
              <input {...a11y('whatsapp', erreurs)} type="tel" inputMode="tel" autoComplete="tel" placeholder="6 90 00 00 00" value={b.whatsapp} onChange={(e) => maj({ whatsapp: e.target.value })} className={inputClass} />
            </Champ>
            <div className="grid sm:grid-cols-2 gap-4">
              <Champ cle="autreTelephone" libelle="Autre téléphone" erreurs={erreurs}>
                <input {...a11y('autreTelephone', erreurs)} type="tel" inputMode="tel" value={b.autreTelephone} onChange={(e) => maj({ autreTelephone: e.target.value })} className={inputClass} />
              </Champ>
              <Champ cle="email" libelle="E-mail" erreurs={erreurs} aide="Pour recevoir l’accusé de réception.">
                <input {...a11y('email', erreurs)} type="email" inputMode="email" autoComplete="email" value={b.email} onChange={(e) => maj({ email: e.target.value })} className={inputClass} />
              </Champ>
            </div>
          </>
        )}

        {etape === 2 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Lieu</h2>
            <Champ cle="villeId" libelle="Ville" requis erreurs={erreurs}>
              <select
                {...a11y('villeId', erreurs)}
                value={b.villeId ?? (b.villeAutre !== '' ? 'autre' : '')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'autre') maj({ villeId: null, villeAutre: ' ', arrondissementId: null, quartierId: null, quartierAutre: '' });
                  else maj({ villeId: v ? Number(v) : null, villeAutre: '', arrondissementId: null, quartierId: null, quartierAutre: '' });
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
              {b.villeId === null && b.villeAutre !== '' && (
                <input aria-label="Nom de la ville" placeholder="Nom de la ville" maxLength={80} value={b.villeAutre.trimStart()} onChange={(e) => maj({ villeAutre: e.target.value || ' ' })} className={`${inputClass} mt-2`} />
              )}
            </Champ>
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
                <select
                  {...a11y('quartierId', erreurs)}
                  value={b.quartierId ?? ''}
                  onChange={(e) => (e.target.value === 'autre' ? maj({ quartierId: null, quartierAutre: ' ' }) : maj({ quartierId: e.target.value ? Number(e.target.value) : null }))}
                  className={inputClass}
                >
                  <option value="">Choisir…</option>
                  {quartiers.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nom}
                    </option>
                  ))}
                  <option value="autre">Autre quartier</option>
                </select>
              ) : (
                <>
                  <input {...a11y('quartierId', erreurs)} placeholder="Nom du quartier" maxLength={80} value={b.quartierAutre.trimStart()} onChange={(e) => maj({ quartierId: null, quartierAutre: e.target.value || (ville ? ' ' : '') })} className={inputClass} />
                  {ville && (
                    <button type="button" className="text-sm text-primary mt-1 py-1" onClick={() => maj({ quartierAutre: '' })}>
                      Choisir dans la liste
                    </button>
                  )}
                </>
              )}
            </Champ>
            <Champ cle="lieu" libelle="Lieu d’affectation / point de repère" erreurs={erreurs}>
              <input {...a11y('lieu', erreurs)} value={b.lieu} maxLength={200} placeholder="Ex. face pharmacie du rond-point" onChange={(e) => maj({ lieu: e.target.value })} className={inputClass} />
            </Champ>
            <Champ cle="secteur" libelle="Secteur d’activité" requis erreurs={erreurs}>
              <select {...a11y('secteur', erreurs)} value={b.secteur} onChange={(e) => maj({ secteur: e.target.value })} className={inputClass}>
                <option value="">Choisir…</option>
                {SECTEURS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Champ>
          </>
        )}

        {etape === 3 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Postes à pourvoir</h2>
            <datalist id="dp-metiers">
              {metiers.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {b.lignes.map((l, i) => (
              <fieldset key={i} className="border border-ink-200 rounded-2xl p-4 space-y-4">
                <legend className="px-1 text-sm font-semibold text-ink-900">Poste {i + 1}</legend>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <Champ cle={`lignes.${i}.intitule`} libelle="Intitulé du poste" requis erreurs={erreurs}>
                    <input {...a11y(`lignes.${i}.intitule`, erreurs)} list="dp-metiers" maxLength={120} value={l.intitule} onChange={(e) => majLigne(i, { intitule: e.target.value })} className={inputClass} />
                  </Champ>
                  <Champ cle={`lignes.${i}.nombre`} libelle="Personnes" requis erreurs={erreurs}>
                    <input {...a11y(`lignes.${i}.nombre`, erreurs)} type="number" inputMode="numeric" pattern="[0-9]*" min={1} max={MAX_PERSONNES_PAR_LIGNE} value={l.nombre} onChange={(e) => majLigne(i, { nombre: e.target.value })} className={inputClass} />
                  </Champ>
                </div>
                <Champ cle={`lignes.${i}.missions`} libelle="Missions principales" requis erreurs={erreurs}>
                  <textarea {...a11y(`lignes.${i}.missions`, erreurs)} rows={3} maxLength={1000} value={l.missions} onChange={(e) => majLigne(i, { missions: e.target.value })} className={inputClass} />
                </Champ>
                <Champ cle={`lignes.${i}.competences`} libelle="Compétences souhaitées" erreurs={erreurs}>
                  <textarea {...a11y(`lignes.${i}.competences`, erreurs)} rows={2} maxLength={500} value={l.competences} onChange={(e) => majLigne(i, { competences: e.target.value })} className={inputClass} />
                </Champ>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Champ cle={`lignes.${i}.experience`} libelle="Expérience souhaitée" requis erreurs={erreurs}>
                    <select {...a11y(`lignes.${i}.experience`, erreurs)} value={l.experience} onChange={(e) => majLigne(i, { experience: e.target.value })} className={inputClass}>
                      <option value="">Choisir…</option>
                      {EXPERIENCES.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Champ>
                  <Champ cle={`lignes.${i}.typeContrat`} libelle="Type de contrat" requis erreurs={erreurs}>
                    <select {...a11y(`lignes.${i}.typeContrat`, erreurs)} value={l.typeContrat} onChange={(e) => majLigne(i, { typeContrat: e.target.value })} className={inputClass}>
                      <option value="">Choisir…</option>
                      {CONTRATS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Champ>
                </div>
                {CONTRATS_AVEC_DUREE.includes(l.typeContrat) && (
                  <Champ cle={`lignes.${i}.duree`} libelle="Durée du contrat" requis erreurs={erreurs}>
                    <input {...a11y(`lignes.${i}.duree`, erreurs)} maxLength={80} placeholder="Ex. 6 mois" value={l.duree} onChange={(e) => majLigne(i, { duree: e.target.value })} className={inputClass} />
                  </Champ>
                )}
                <Champ cle={`lignes.${i}.salaire`} libelle="Salaire / budget mensuel (FCFA)" erreurs={erreurs} aide="Confidentiel, non publié sans votre accord.">
                  <input {...a11y(`lignes.${i}.salaire`, erreurs)} inputMode="numeric" maxLength={60} placeholder="Ex. 80 000 ou 80 000 - 100 000" value={l.salaire} onChange={(e) => majLigne(i, { salaire: e.target.value })} className={inputClass} />
                </Champ>
                <Champ cle={`lignes.${i}.horaires`} libelle="Horaires" erreurs={erreurs}>
                  <input {...a11y(`lignes.${i}.horaires`, erreurs)} maxLength={120} placeholder="Ex. 7 h – 16 h" value={l.horaires} onChange={(e) => majLigne(i, { horaires: e.target.value })} className={inputClass} />
                </Champ>
                <fieldset>
                  <legend className={labelClass}>Jours de repos</legend>
                  <div className="flex flex-wrap gap-2">
                    {JOURS.map((j) => {
                      const actif = l.joursRepos.includes(j);
                      return (
                        <label key={j} className={`inline-flex items-center min-h-11 px-3 rounded-full border text-sm cursor-pointer ${actif ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-ink-200 text-ink-600'}`}>
                          <input type="checkbox" className="sr-only" checked={actif} onChange={() => majLigne(i, { joursRepos: actif ? l.joursRepos.filter((x) => x !== j) : [...l.joursRepos, j] })} />
                          {j.slice(0, 3)}.<span className="sr-only">{j.slice(3)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <Champ cle={`lignes.${i}.avantages`} libelle="Avantages" erreurs={erreurs}>
                  <input {...a11y(`lignes.${i}.avantages`, erreurs)} maxLength={300} placeholder="Logement, repas, transport…" value={l.avantages} onChange={(e) => majLigne(i, { avantages: e.target.value })} className={inputClass} />
                </Champ>
                <Champ cle={`lignes.${i}.datePriseFonction`} libelle="Prise de fonction souhaitée" requis erreurs={erreurs}>
                  <input
                    {...a11y(`lignes.${i}.datePriseFonction`, erreurs)}
                    type="date"
                    min={aujourdhuiDouala()}
                    disabled={l.desQuePossible}
                    value={l.desQuePossible ? '' : l.datePriseFonction}
                    onChange={(e) => majLigne(i, { datePriseFonction: e.target.value })}
                    className={`${inputClass} disabled:opacity-50`}
                  />
                  <label className="flex items-center gap-2 min-h-11 mt-1 text-sm">
                    <input type="checkbox" className="h-5 w-5 accent-primary" checked={l.desQuePossible} onChange={(e) => majLigne(i, { desQuePossible: e.target.checked, datePriseFonction: '' })} />
                    Dès que possible
                  </label>
                </Champ>
                <div className="flex flex-wrap gap-2 pt-1">
                  {b.lignes.length < MAX_LIGNES && (
                    <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary min-h-tap px-2" onClick={() => setB((x) => ({ ...x, lignes: [...x.lignes.slice(0, i + 1), { ...l, joursRepos: [...l.joursRepos] }, ...x.lignes.slice(i + 1)] }))}>
                      <CopyPlus className="w-4 h-4" /> Dupliquer ce poste
                    </button>
                  )}
                  {b.lignes.length > 1 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-danger min-h-tap px-2"
                      onClick={() => {
                        setB((x) => ({ ...x, lignes: x.lignes.filter((_, j) => j !== i) }));
                        setErreurs({});
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Retirer
                    </button>
                  )}
                </div>
              </fieldset>
            ))}
            {erreurs.lignes && <p className="text-sm text-danger">{erreurs.lignes}</p>}
            {b.lignes.length < MAX_LIGNES && (
              <Button variant="outline" icon={Plus} fullWidth onClick={() => setB((x) => ({ ...x, lignes: [...x.lignes, ligneVide()] }))}>
                Ajouter un autre poste
              </Button>
            )}
            {besoinImportant && (
              <div className="rounded-2xl bg-warning-soft border border-warning-border p-4 text-sm text-ink-800">
                <p className="font-medium mb-2">Pour un besoin de cette taille, contactez-nous directement.</p>
                <p className="mb-3">Vous pouvez aussi envoyer la demande avec {MAX_PERSONNES_PAR_LIGNE} personnes maximum par poste et préciser le besoin réel ci-dessous.</p>
                <Button href={getWhatsAppLink('Bonjour NEXCLEAN, j’ai un besoin important en personnel et je souhaite en discuter.')} variant="whatsapp" size="sm" whatsappIcon>
                  Nous écrire sur WhatsApp
                </Button>
              </div>
            )}
            <Champ cle="precisions" libelle="Précisions (facultatif)" erreurs={erreurs}>
              <textarea {...a11y('precisions', erreurs)} rows={3} maxLength={2000} value={b.precisions} placeholder="Contraintes, besoin réel, informations utiles…" onChange={(e) => maj({ precisions: e.target.value })} className={inputClass} />
            </Champ>
          </>
        )}

        {etape === 4 && (
          <>
            <h2 className="font-display text-h3 text-ink-900">Récapitulatif</h2>
            <Recap titre="Vous" onModifier={() => allerA(1)}>
              <p>{b.clientType === 'entreprise' ? b.entreprise : 'Particulier'}</p>
              <p>
                {b.contact} · {b.whatsapp}
              </p>
              {b.autreTelephone && <p>Autre tél. : {b.autreTelephone}</p>}
              {b.email && <p>{b.email}</p>}
            </Recap>
            <Recap titre="Lieu" onModifier={() => allerA(2)}>
              <p>{[nomQuartier?.trim(), nomVille?.trim()].filter(Boolean).join(', ')}</p>
              {b.lieu && <p>{b.lieu}</p>}
              <p>Secteur : {b.secteur}</p>
            </Recap>
            <Recap titre={`Postes (${personnes} personne${personnes > 1 ? 's' : ''})`} onModifier={() => allerA(3)}>
              <ul className="space-y-2">
                {b.lignes.map((l, i) => (
                  <li key={i}>
                    <p className="font-medium text-ink-900">
                      {l.nombre} × {l.intitule}
                    </p>
                    <p>
                      {l.typeContrat}
                      {l.duree && CONTRATS_AVEC_DUREE.includes(l.typeContrat) && ` (${l.duree})`} · {l.experience}
                      {l.salaire && ` · ${l.salaire}`}
                    </p>
                    <p>Prise de fonction : {l.desQuePossible ? 'dès que possible' : l.datePriseFonction.split('-').reverse().join('/')}</p>
                  </li>
                ))}
              </ul>
            </Recap>
            <div className="rounded-2xl bg-pillar-recrutement-soft border border-pillar-recrutement-border p-4" aria-live="polite">
              <p className="font-semibold text-ink-900">{texteEstimation(estimation)}</p>
              <p className="text-sm text-ink-600 mt-1">{MENTION_ESTIMATION}</p>
            </div>
            <div>
              <label className="flex items-start gap-3 min-h-11 text-sm text-ink-700">
                <input {...a11y('consentement', erreurs)} type="checkbox" className="h-5 w-5 mt-0.5 accent-primary shrink-0" checked={b.consentement} onChange={(e) => maj({ consentement: e.target.checked })} />
                <span>
                  J’accepte que NEXCLEAN traite ces informations pour répondre à ma demande et me contacte sur WhatsApp (
                  <Link href="/confidentialite" target="_blank" className="text-primary underline">
                    politique de confidentialité
                  </Link>
                  ). <span className="text-accent">*</span>
                </span>
              </label>
              {erreurs.consentement && (
                <p id={`${idChamp('consentement')}-err`} className={erreurChamp}>
                  {erreurs.consentement}
                </p>
              )}
            </div>
            {echec && (
              <div role="alert" className="rounded-2xl bg-danger-soft border border-danger-border p-4 text-sm text-danger">
                <p className="flex items-start gap-2 font-medium mb-3">
                  <AlertCircle className="w-5 h-5 shrink-0" /> {echec}
                </p>
                <Button href={getWhatsAppLink(recapitulatif(true))} variant="whatsapp" size="sm" whatsappIcon>
                  Envoyer ma demande sur WhatsApp
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {Object.keys(erreurs).length > 0 && (
        <p role="alert" className="text-sm text-danger mt-3">
          Merci de corriger les champs signalés.
        </p>
      )}

      <div className="flex gap-3 mt-5">
        {etape > 1 && (
          <Button variant="outline" onClick={() => allerA(etape - 1)}>
            Retour
          </Button>
        )}
        {etape < 4 ? (
          <Button className="flex-1" onClick={suivant}>
            Continuer
          </Button>
        ) : (
          <Button type="submit" className="flex-1" loading={envoi} loadingLabel="Envoi en cours…">
            Envoyer ma demande
          </Button>
        )}
      </div>
      {etape < 4 && personnes > 0 && (
        <p className="text-xs text-muted mt-3 text-center">
          {personnes} personne{personnes > 1 ? 's' : ''} · estimation {formaterFCFA(estimation.montant)}
        </p>
      )}
    </form>
  );
}

function Recap({ titre, onModifier, children }: { titre: string; onModifier: () => void; children: React.ReactNode }) {
  return (
    <section className="border border-ink-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm text-ink-900">{titre}</h3>
        <button type="button" onClick={onModifier} className="text-sm text-primary min-h-11 px-2 -my-2">
          Modifier
        </button>
      </div>
      <div className="text-sm text-ink-600 space-y-0.5 break-words">{children}</div>
    </section>
  );
}
