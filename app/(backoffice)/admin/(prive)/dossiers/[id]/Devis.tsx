'use client';
// MVP2-04 : actions de l'onglet « Devis » d'un dossier de recrutement (référent du dossier ou Direction).
// Chaque formulaire appelle une action serveur qui revérifie les droits ; pas de navigation côté client
// (la page est revalidée par l'action).
import { useState, type ReactNode } from 'react';
import { Alerte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { formaterMontant, totauxFiges, type BornesAcompte, type LigneDevis } from '@/lib/devis/domaine';
import * as actions from './devis/actions';
import { changerStatut } from '../actions';

function useAction() {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    const res = await fn();
    setEnvoi(false);
    setR(res);
    return res;
  };
  const retour: ReactNode = r ? r.ok ? r.message && <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte> : null;
  return { lancer, envoi, retour };
}

const classeFichier = 'block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-primary-light file:text-primary-dark';
const classeWhatsApp = `${classeBouton('principal', true)} !bg-[#25D366] text-center`;

/** Bloc repliable : garde la carte compacte sur mobile. */
function Volet({ titre, children, danger = false, ouvert = false }: { titre: string; children: ReactNode; danger?: boolean; ouvert?: boolean }) {
  return (
    <details className="group border border-ink-100 rounded-lg" open={ouvert}>
      <summary className={`cursor-pointer list-none min-h-11 flex items-center px-3 text-sm font-medium ${danger ? 'text-red-700' : 'text-primary'}`}>{titre}</summary>
      <div className="px-3 pb-3 space-y-3">{children}</div>
    </details>
  );
}

// ─── Création, « À compléter » ───────────────────────────────

export function CreerDevis({ dossierId }: { dossierId: number }) {
  const { lancer, envoi, retour } = useAction();
  return (
    <div className="space-y-2 w-full max-w-sm">
      {retour}
      <button type="button" disabled={envoi} className={classeBouton('principal', true)} onClick={() => lancer(() => actions.creerDevis(dossierId))}>
        {envoi ? 'Création…' : 'Créer le devis'}
      </button>
    </div>
  );
}

/** RG-05 : propose de passer le Dossier « À compléter » avec la liste des données manquantes. */
export function PasserACompleter({ dossierId, manques }: { dossierId: number; manques: string[] }) {
  const { lancer, envoi, retour } = useAction();
  return (
    <div className="space-y-2 mt-3">
      {retour}
      <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => lancer(() => changerStatut(dossierId, 'a_completer', `Données manquantes pour le devis : ${manques.join(', ')}`))}>
        Passer le dossier « À compléter »
      </button>
    </div>
  );
}

// ─── Édition d'un brouillon (RG-06) ──────────────────────────

export function EditerDevis({
  dossierId,
  devisId,
  avenant,
  lignes,
  tauxTva,
  tauxAcompte,
  justificationTaux,
  delaiRechercheJours,
  prolongationJours,
  conditionsParticulieres,
  tauxAcompteDefaut,
  bornes,
  contrat,
}: {
  dossierId: number;
  devisId: number;
  avenant: boolean;
  lignes: LigneDevis[];
  tauxTva: number;
  tauxAcompte: number;
  justificationTaux: string | null;
  delaiRechercheJours: number;
  prolongationJours: number | null;
  conditionsParticulieres: string | null;
  tauxAcompteDefaut: number;
  bornes: BornesAcompte;
  /** Avenant : nombre au contrat par ligne de poste (borne de l'écart). */
  contrat: Record<number, number>;
}) {
  const { lancer, envoi, retour } = useAction();
  const [nombres, setNombres] = useState(lignes.map((l) => l.nombre));
  const [taux, setTaux] = useState(tauxAcompte);
  const total = totauxFiges(lignes.map((l, i) => ({ ...l, nombre: nombres[i] ?? 0 })), tauxTva, avenant ? 0 : taux);
  const horsBornes = !avenant && (taux < bornes.min || taux > bornes.max);
  return (
    <Volet titre={avenant ? 'Modifier l’avenant' : 'Modifier le devis'}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const nb = (k: string) => (String(f.get(k) ?? '').trim() === '' ? undefined : Number(f.get(k)));
          await lancer(() =>
            actions.modifierDevis(dossierId, devisId, {
              nombres,
              ...(avenant
                ? { prolongationJours: nb('prolongationJours') ?? null }
                : { tauxAcompte: taux, justificationTaux: String(f.get('justificationTaux') ?? '') || null, delaiRechercheJours: nb('delaiRechercheJours') }),
              conditionsParticulieres: String(f.get('conditionsParticulieres') ?? '') || null,
            }),
          );
        }}
      >
        {retour}
        <fieldset className="space-y-2">
          <legend className={classeLibelle}>{avenant ? 'Écart de personnes par poste (+ ajout, − retrait)' : 'Nombre de personnes par poste'}</legend>
          {lignes.map((l, i) => (
            <div key={`${l.lignePosteId ?? l.intitule}-${i}`} className="flex items-center gap-3">
              <label htmlFor={`nb-${devisId}-${i}`} className="min-w-0 flex-1 text-sm text-ink-800">
                {l.intitule} <span className="text-ink-500">· {formaterMontant(l.commission)} / pers.</span>
              </label>
              <input
                id={`nb-${devisId}-${i}`}
                type="number"
                inputMode="numeric"
                min={avenant ? -(l.lignePosteId ? (contrat[l.lignePosteId] ?? 0) : 0) : 0}
                max={100}
                step={1}
                required
                value={nombres[i] ?? 0}
                onChange={(e) => setNombres((n) => n.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                className={`${classeChamp} !w-24 text-right tabular-nums`}
              />
            </div>
          ))}
        </fieldset>
        {avenant ? (
          <div>
            <label htmlFor={`prolongation-${devisId}`} className={classeLibelle}>Prolongation du délai de recherche (jours)</label>
            <input id={`prolongation-${devisId}`} name="prolongationJours" type="number" inputMode="numeric" min={0} max={365} defaultValue={prolongationJours ?? 0} className={classeChamp} />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor={`taux-${devisId}`} className={classeLibelle}>Taux d’acompte (%)</label>
              <input id={`taux-${devisId}`} type="number" inputMode="numeric" min={0} max={100} step={1} required value={taux} onChange={(e) => setTaux(Number(e.target.value))} className={classeChamp} />
              <p className={classeAide}>Défaut : {tauxAcompteDefaut} % · bornes : {bornes.min} %–{bornes.max} %.</p>
              {horsBornes && <p className="text-xs text-amber-800 mt-1.5">Hors bornes : la validation passera par la Direction.</p>}
            </div>
            {taux !== tauxAcompteDefaut && (
              <div>
                <label htmlFor={`justif-${devisId}`} className={classeLibelle}>Justification du taux (obligatoire)</label>
                <input id={`justif-${devisId}`} name="justificationTaux" required maxLength={500} defaultValue={justificationTaux ?? ''} className={classeChamp} />
              </div>
            )}
            <div>
              <label htmlFor={`delai-${devisId}`} className={classeLibelle}>Délai de recherche (jours)</label>
              <input id={`delai-${devisId}`} name="delaiRechercheJours" type="number" inputMode="numeric" min={1} max={365} required defaultValue={delaiRechercheJours} className={classeChamp} />
            </div>
          </>
        )}
        <div>
          <label htmlFor={`cp-${devisId}`} className={classeLibelle}>Conditions particulières (facultatif)</label>
          <textarea id={`cp-${devisId}`} name="conditionsParticulieres" rows={3} maxLength={2000} defaultValue={conditionsParticulieres ?? ''} className={classeChamp} />
        </div>
        <p className="text-sm text-ink-700 tabular-nums">
          Total : <strong>{formaterMontant(total.totalTtc)}</strong>
          {!avenant && <> · acompte {formaterMontant(total.acompte)}</>}
        </p>
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Enregistrer</button>
        {!avenant && (
          <button
            type="button"
            disabled={envoi}
            className="text-sm text-primary py-2"
            onClick={() => window.confirm('Remplacer les lignes du devis par les postes actuels du dossier ?') && lancer(() => actions.reprendrePostes(dossierId, devisId))}
          >
            Reprendre les postes du dossier (poste ajouté ou retiré)
          </button>
        )}
      </form>
    </Volet>
  );
}

// ─── Cycle : valider, envoyer, nouvelle version ──────────────

export function BoutonsDevis({
  dossierId,
  devisId,
  valider,
  validerDirection,
  envoyer,
  versionner,
}: {
  dossierId: number;
  devisId: number;
  valider: boolean;
  validerDirection: boolean;
  envoyer: boolean;
  versionner: boolean;
}) {
  const { lancer, envoi, retour } = useAction();
  if (!valider && !validerDirection && !envoyer && !versionner) return null;
  return (
    <div className="space-y-2">
      {retour}
      <div className="flex flex-wrap gap-2">
        {valider && (
          <button type="button" disabled={envoi} className={classeBouton('principal')} onClick={() => lancer(() => actions.validerDevis(dossierId, devisId))}>
            Valider
          </button>
        )}
        {validerDirection && (
          <button type="button" disabled={envoi} className={classeBouton('principal')} onClick={() => lancer(() => actions.validerParDirection(dossierId, devisId))}>
            Valider (Direction)
          </button>
        )}
        {envoyer && (
          <button
            type="button"
            disabled={envoi}
            className={classeBouton('principal')}
            onClick={() => window.confirm('Générer le PDF définitif et envoyer le devis au client ? Il ne sera plus modifiable.') && lancer(() => actions.validerEtEnvoyer(dossierId, devisId))}
          >
            {envoi ? 'Envoi…' : 'Valider et envoyer'}
          </button>
        )}
        {versionner && (
          <button
            type="button"
            disabled={envoi}
            className={classeBouton('secondaire')}
            onClick={() => window.confirm('Créer une nouvelle version ? Une version validée ou envoyée sera remplacée.') && lancer(() => actions.nouvelleVersion(dossierId, devisId))}
          >
            Nouvelle version
          </button>
        )}
      </div>
    </div>
  );
}

/** RG-10 : ouvre WhatsApp avec le modèle « Envoi du devis » ; le message est noté dans l'historique. */
export function OuvrirWhatsApp({ dossierId, devisId, numero, texte: initial }: { dossierId: number; devisId: number; numero: string; texte: string }) {
  const { lancer, retour } = useAction();
  const [texte, setTexte] = useState(initial);
  return (
    <Volet titre="Envoyer sur WhatsApp (modèle « Envoi du devis »)" ouvert>
      {retour}
      <textarea aria-label="Message WhatsApp" rows={8} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} />
      <a
        href={`https://wa.me/${numero.replace(/^\+/, '')}?text=${encodeURIComponent(texte)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void lancer(() => actions.noterEnvoiWhatsApp(dossierId, devisId, texte));
        }}
        className={classeWhatsApp}
      >
        Ouvrir WhatsApp
      </a>
    </Volet>
  );
}

// ─── Réponse du client hors page de suivi (RG-14, RG-15) ─────

export function ReponseClient({ dossierId, devisId }: { dossierId: number; devisId: number }) {
  const { lancer, envoi, retour } = useAction();
  const [cle, setCle] = useState(0);
  return (
    <div className="space-y-2">
      {retour}
      <Volet titre="Enregistrer l’acceptation reçue sur WhatsApp">
        <form
          key={cle}
          className="space-y-3"
          action={async (f) => {
            const r = await lancer(() => actions.enregistrerAcceptation(dossierId, devisId, f));
            if (r.ok) setCle((k) => k + 1);
          }}
        >
          <div>
            <label className={classeLibelle} htmlFor={`capture-devis-${devisId}`}>Capture de l’acceptation (obligatoire)</label>
            <input id={`capture-devis-${devisId}`} type="file" name="fichier" required accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" className={classeFichier} />
            <p className={classeAide}>Image ou PDF, 5 Mo maximum.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={classeLibelle} htmlFor={`signataire-${devisId}`}>Nom du signataire</label>
              <input id={`signataire-${devisId}`} name="signataireNom" required maxLength={120} className={classeChamp} />
            </div>
            <div>
              <label className={classeLibelle} htmlFor={`fonction-${devisId}`}>Fonction</label>
              <input id={`fonction-${devisId}`} name="signataireFonction" required maxLength={120} className={classeChamp} />
            </div>
          </div>
          <p className="text-xs text-ink-500">L’acceptation est marquée « WhatsApp » ; pour un devis, la facture d’acompte est émise aussitôt.</p>
          <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Enregistrer l’acceptation</button>
        </form>
      </Volet>
      <Volet titre="Enregistrer un refus du client" danger>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const motif = String(new FormData(e.currentTarget).get('motif') ?? '').trim();
            if (window.confirm('Enregistrer le refus du client ?')) await lancer(() => actions.enregistrerRefus(dossierId, devisId, motif));
          }}
        >
          <div>
            <label className={classeLibelle} htmlFor={`motif-refus-${devisId}`}>Motif (facultatif)</label>
            <input id={`motif-refus-${devisId}`} name="motif" maxLength={1000} className={classeChamp} />
          </div>
          <button type="submit" disabled={envoi} className={classeBouton('danger', true)}>Enregistrer le refus</button>
        </form>
      </Volet>
    </div>
  );
}

// ─── Avenant (RG-09) ─────────────────────────────────────────

export function CreerAvenant({ dossierId, devisId, postes }: { dossierId: number; devisId: number; postes: { id: number; intitule: string; contrat: number; commission: number | null }[] }) {
  const { lancer, envoi, retour } = useAction();
  const [nombres, setNombres] = useState(postes.map((p) => p.contrat));
  return (
    <Volet titre="Créer un avenant">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const prolongation = Number(f.get('prolongationJours') ?? 0) || null;
          await lancer(() =>
            actions.creerAvenant(dossierId, devisId, {
              lignes: postes.map((p, i) => ({ lignePosteId: p.id, nombre: nombres[i] ?? p.contrat })),
              prolongationJours: prolongation,
              conditionsParticulieres: String(f.get('conditionsParticulieres') ?? '') || null,
            }),
          );
        }}
      >
        {retour}
        <fieldset className="space-y-2">
          <legend className={classeLibelle}>Nouveau nombre de personnes par poste</legend>
          {postes.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <label htmlFor={`av-${p.id}`} className="min-w-0 flex-1 text-sm text-ink-800">
                {p.intitule} <span className="text-ink-500">· au contrat : {p.contrat}{p.commission === null ? ' · nouveau poste (commission en vigueur)' : ''}</span>
              </label>
              <input
                id={`av-${p.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={nombres[i] ?? 0}
                onChange={(e) => setNombres((n) => n.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                className={`${classeChamp} !w-24 text-right tabular-nums`}
              />
            </div>
          ))}
          <p className={classeAide}>Pour un nouveau poste, ajoutez-le d’abord dans l’onglet Postes.</p>
        </fieldset>
        <div>
          <label htmlFor={`av-prolongation-${devisId}`} className={classeLibelle}>Prolongation du délai de recherche (jours)</label>
          <input id={`av-prolongation-${devisId}`} name="prolongationJours" type="number" inputMode="numeric" min={0} max={365} defaultValue={0} className={classeChamp} />
        </div>
        <div>
          <label htmlFor={`av-cp-${devisId}`} className={classeLibelle}>Conditions particulières (facultatif)</label>
          <textarea id={`av-cp-${devisId}`} name="conditionsParticulieres" rows={2} maxLength={2000} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Créer l’avenant</button>
      </form>
    </Volet>
  );
}
