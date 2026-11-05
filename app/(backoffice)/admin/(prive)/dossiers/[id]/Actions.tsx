'use client';
// Actions de la fiche dossier. Chaque formulaire appelle une action serveur qui revérifie les droits.
import { useState, type ReactNode } from 'react';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import type { ListesLieux } from '@/lib/geo/service';
import type { LignePosteSaisie } from '@/lib/dossiers/service';
import type { Statut } from '@/lib/dossiers/statuts';
import ChampsLieu, { type ValeurLieu } from '@/components/backoffice/ChampsLieu';
import EditeurPostes from '@/components/backoffice/EditeurPostes';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from '../actions';

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

/**
 * `encaissementsIntegres` (MVP2-05) : « Acompte reçu » / « Solde reçu » suivent les Encaissements de
 * l'onglet Finances ; le commentaire « (montant, moyen, référence) » ne concerne plus que le mode transitoire.
 */
export function ChangerStatut({ dossierId, options, encaissementsIntegres = false }: { dossierId: number; options: { code: Statut; libelle: string }[]; encaissementsIntegres?: boolean }) {
  const { lancer, envoi, retour } = useAction();
  const [vers, setVers] = useState<Statut | ''>('');
  if (options.length === 0) return null;
  return (
    <Carte titre="Faire avancer le dossier">
      <form
        className="space-y-3"
        action={async (f) => {
          const res = await lancer(() => actions.changerStatut(dossierId, vers as Statut, String(f.get('commentaire') ?? '')));
          if (res.ok) setVers('');
        }}
      >
        {retour}
        <div>
          <label htmlFor="vers" className={classeLibelle}>Nouveau statut</label>
          <select id="vers" required value={vers} onChange={(e) => setVers(e.target.value as Statut)} className={classeChamp}>
            <option value="">Choisir…</option>
            {options.map((o) => <option key={o.code} value={o.code}>{o.libelle}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="commentaire" className={classeLibelle}>
            Commentaire {vers === 'a_completer' ? '(informations manquantes)' : (vers === 'acompte_recu' || vers === 'solde_recu') && !encaissementsIntegres ? '(montant, moyen, référence)' : vers === 'placements_confirmes' ? '(nombre de placements)' : ''}
          </label>
          <textarea id="commentaire" name="commentaire" rows={2} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi || !vers} className={classeBouton('principal', true)}>
          {vers ? `Passer à « ${options.find((o) => o.code === vers)?.libelle ?? ''} »` : 'Changer le statut'}
        </button>
      </form>
    </Carte>
  );
}

export function AjouterNote({ dossierId }: { dossierId: number }) {
  const { lancer, envoi, retour } = useAction();
  const [texte, setTexte] = useState('');
  return (
    <Carte titre="Nouvelle note interne">
      <form
        className="space-y-3"
        action={async () => {
          const res = await lancer(() => actions.ajouterNote(dossierId, texte));
          if (res.ok) setTexte('');
        }}
      >
        {retour}
        <textarea aria-label="Note" required rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} placeholder="Jamais visible du client" />
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Ajouter la note</button>
      </form>
    </Carte>
  );
}

export function AjouterDocument({ dossierId, categories }: { dossierId: number; categories: { code: string; libelle: string }[] }) {
  const { lancer, envoi, retour } = useAction();
  const [cle, setCle] = useState(0);
  return (
    <Carte titre="Ajouter un document">
      <form
        key={cle}
        className="space-y-3"
        action={async (f) => {
          const res = await lancer(() => actions.televerserDocument(dossierId, f));
          if (res.ok) setCle((k) => k + 1);
        }}
      >
        {retour}
        <input type="file" name="fichier" required accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,image/*" capture="environment" aria-label="Fichier" className="block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-primary-light file:text-primary-dark" />
        <p className="text-xs text-ink-500">PDF, JPEG, PNG, WEBP ou DOCX — 5 Mo maximum.</p>
        <select name="categorie" aria-label="Catégorie" defaultValue="piece_client" className={classeChamp}>
          {categories.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
        </select>
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>{envoi ? 'Envoi…' : 'Téléverser'}</button>
      </form>
    </Carte>
  );
}

export function SupprimerDocument({ dossierId, documentId }: { dossierId: number; documentId: number }) {
  const { lancer, envoi, retour } = useAction();
  return (
    <div className="shrink-0 text-right">
      <button type="button" disabled={envoi} className="text-sm text-red-700 px-2 py-2" onClick={() => window.confirm('Supprimer ce document ?') && lancer(() => actions.supprimerDocument(dossierId, documentId))}>
        Supprimer
      </button>
      {retour}
    </div>
  );
}

export function Rattacher({ dossierId, demandeId, cibles }: { dossierId: number; demandeId: number; cibles: { id: number; numero: string }[] }) {
  const { lancer, envoi, retour } = useAction();
  if (cibles.length === 0) return null;
  return (
    <form
      className="mt-3 space-y-2"
      action={async (f) => {
        const cible = Number(f.get('cible'));
        if (window.confirm('Rattacher cette demande à l’autre dossier ? Si c’est la seule demande de ce dossier, il passera « Sans suite ».')) await lancer(() => actions.rattacherDemande(dossierId, demandeId, cible));
      }}
    >
      {retour}
      <label className={classeLibelle} htmlFor={`cible-${demandeId}`}>Rattacher à un autre dossier du client</label>
      <div className="flex gap-2">
        <select id={`cible-${demandeId}`} name="cible" className={classeChamp}>
          {cibles.map((c) => <option key={c.id} value={c.id}>{c.numero}</option>)}
        </select>
        <button type="submit" disabled={envoi} className={classeBouton('secondaire')}>Rattacher</button>
      </div>
    </form>
  );
}

export function LienSuivi({ dossierId, lien, peutRegenerer }: { dossierId: number; lien: string; peutRegenerer: boolean }) {
  const { lancer, envoi, retour } = useAction();
  const [url, setUrl] = useState(lien);
  const [copie, setCopie] = useState(false);
  return (
    <div className="space-y-2">
      {retour}
      <input readOnly value={url} aria-label="Lien de suivi" className={`${classeChamp} text-xs font-mono`} onFocus={(e) => e.currentTarget.select()} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={classeBouton('secondaire')} onClick={async () => { await navigator.clipboard.writeText(url); setCopie(true); }}>{copie ? 'Copié ✓' : 'Copier'}</button>
        {peutRegenerer && (
          <button
            type="button"
            disabled={envoi}
            className={classeBouton('secondaire')}
            onClick={async () => {
              if (!window.confirm('Régénérer le lien ? L’ancien cessera immédiatement de fonctionner.')) return;
              await lancer(async () => {
                const r = await actions.regenererLien(dossierId);
                if (!r.ok) return r;
                setUrl(url.replace(/[^/]+$/, r.message ?? ''));
                setCopie(false);
                return { ok: true, message: 'Nouveau lien généré. Transmettez-le au client.' };
              });
            }}
          >
            Régénérer
          </button>
        )}
      </div>
    </div>
  );
}

export function ModifierLieu({
  dossierId,
  listes,
  valeur,
  type,
  statut,
}: {
  dossierId: number;
  listes: ListesLieux;
  valeur: ValeurLieu & { lieu: string | null; secteur: string | null; description: string | null };
  type: DossierType;
  statut: Statut;
}) {
  const { lancer, envoi, retour } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [lieu, setLieu] = useState<ValeurLieu>(valeur);
  const typeModifiable = ['nouvelle_demande', 'attribuee', 'en_qualification', 'a_completer', 'devis_pret'].includes(statut);
  if (!ouvert) return <button type="button" className="text-sm text-primary py-2 mt-2" onClick={() => setOuvert(true)}>Modifier</button>;
  return (
    <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
      {retour}
      <form
        className="space-y-3"
        action={async (f) => {
          const champ = (k: string) => String(f.get(k) ?? '').trim() || null;
          await lancer(() => actions.modifierLieu(dossierId, { ...lieu, lieu: champ('lieu'), secteur: champ('secteur'), description: champ('description') }));
        }}
      >
        <ChampsLieu listes={listes} valeur={lieu} onChange={setLieu} />
        <input name="lieu" defaultValue={valeur.lieu ?? ''} aria-label="Lieu d’affectation" placeholder="Lieu d’affectation / repère" className={classeChamp} />
        <input name="secteur" defaultValue={valeur.secteur ?? ''} aria-label="Secteur" placeholder="Secteur d’activité" className={classeChamp} />
        <textarea name="description" defaultValue={valeur.description ?? ''} rows={3} aria-label="Précisions" className={classeChamp} />
        <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Enregistrer</button>
      </form>
      {typeModifiable && (
        <form className="flex gap-2" action={async (f) => { await lancer(() => actions.changerType(dossierId, String(f.get('type')) as DossierType)); }}>
          <select name="type" defaultValue={type} aria-label="Type de dossier" className={classeChamp}>
            {DOSSIER_TYPE_CODES.map((t) => <option key={t} value={t}>{DOSSIER_TYPES[t]}</option>)}
          </select>
          <button type="submit" disabled={envoi} className={classeBouton('secondaire')}>Changer le type</button>
        </form>
      )}
    </div>
  );
}

export function ModifierPostes({ dossierId, lignes: initiales, voirSalaire }: { dossierId: number; lignes: LignePosteSaisie[]; voirSalaire: boolean }) {
  const { lancer, envoi, retour } = useAction();
  const [lignes, setLignes] = useState(initiales);
  return (
    <form className="space-y-3" action={async () => { await lancer(() => actions.remplacerLignes(dossierId, lignes)); }}>
      {retour}
      <EditeurPostes lignes={lignes} onChange={setLignes} voirSalaire={voirSalaire} />
      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Enregistrer les postes</button>
    </form>
  );
}

export function CoordonneesRecues({ dossierId, clientId, recu }: { dossierId: number; clientId: number; recu: { nom: string | null; contact: string | null; email: string | null } }) {
  const { lancer, envoi, retour } = useAction();
  return (
    <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm space-y-2">
      <p className="font-medium">Nouvelles coordonnées reçues dans la dernière demande</p>
      <p>{[recu.nom, recu.contact, recu.email].filter(Boolean).join(' · ')}</p>
      {retour}
      <button type="button" disabled={envoi} className={classeBouton('secondaire')} onClick={() => lancer(() => actions.mettreAJourClient(dossierId, clientId, { ...(recu.nom ? { nom: recu.nom } : {}), contact: recu.contact, ...(recu.email ? { email: recu.email } : {}) }))}>
        Mettre à jour le client
      </button>
    </div>
  );
}

// ─── MVP1-05 : réaffectation (Direction) ──────────────────────

export function Reaffecter({ dossierId, referentActuel, candidats }: { dossierId: number; referentActuel: string | null; candidats: { id: string; nom: string; charge: number; raisons: string[] }[] }) {
  const { lancer, envoi, retour } = useAction();
  const [cible, setCible] = useState('');
  const [motif, setMotif] = useState('');
  const choisi = candidats.find((c) => c.id === cible);
  return (
    <Carte titre={referentActuel ? 'Réaffecter' : 'Attribuer'}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await lancer(() => actions.reaffecterDossier(dossierId, cible, motif));
          if (r.ok) {
            setCible('');
            setMotif('');
          }
        }}
      >
        {retour}
        <div>
          <label htmlFor="cible" className={classeLibelle}>Nouveau référent</label>
          <select id="cible" required value={cible} onChange={(e) => setCible(e.target.value)} className={classeChamp}>
            <option value="">Choisir…</option>
            {candidats
              .filter((c) => c.id !== referentActuel)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} · {c.charge} ouvert{c.charge > 1 ? 's' : ''}
                  {c.raisons.length ? ' · non éligible' : ''}
                </option>
              ))}
          </select>
          {choisi && choisi.raisons.length > 0 && <p className="text-xs text-amber-700 mt-1">Attention : {choisi.raisons.join(', ')}.</p>}
        </div>
        <div>
          <label htmlFor="motif" className={classeLibelle}>Motif (obligatoire)</label>
          <input id="motif" required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi || !cible} className={classeBouton('principal', true)}>
          {referentActuel ? 'Réaffecter' : 'Attribuer'}
        </button>
      </form>
    </Carte>
  );
}

// ─── MVP1-05 RG-17 : envoyer sur WhatsApp à partir d'un modèle ─

export function EnvoyerWhatsApp({ dossierId, numero, modeles }: { dossierId: number; numero: string; modeles: { id: number; nom: string; texte: string }[] }) {
  const { lancer, retour } = useAction();
  const [modeleId, setModeleId] = useState<number | ''>('');
  const [texte, setTexte] = useState('');
  const modele = modeles.find((m) => m.id === modeleId);
  const lien = `https://wa.me/${numero.replace(/^\+/, '')}?text=${encodeURIComponent(texte)}`;
  return (
    <div className="mt-3 space-y-2">
      {retour}
      <label htmlFor="modele" className={classeLibelle}>Envoyer sur WhatsApp</label>
      <select
        id="modele"
        value={modeleId}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : '';
          setModeleId(id);
          setTexte(modeles.find((m) => m.id === id)?.texte ?? '');
        }}
        className={classeChamp}
      >
        <option value="">Choisir un modèle…</option>
        {modeles.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </select>
      {modele && (
        <>
          <textarea aria-label="Aperçu du message" rows={7} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} />
          <a
            href={lien}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void lancer(() => actions.noterWhatsApp(dossierId, modele.nom, texte));
            }}
            className={`${classeBouton('principal', true)} !bg-whatsapp !text-ink-900 hover:!bg-whatsapp-hover text-center`}
          >
            Ouvrir WhatsApp
          </a>
        </>
      )}
    </div>
  );
}
