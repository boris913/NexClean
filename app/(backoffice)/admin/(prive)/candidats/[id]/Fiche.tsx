'use client';
// Actions de la fiche candidat. Chaque formulaire appelle une action serveur qui revérifie les droits.
import { useState, type ReactNode } from 'react';
import { Alerte, Carte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from './actions';

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
  return { lancer, envoi, retour, setR };
}

const lienWhatsApp = (numero: string, texte: string) => `https://wa.me/${numero.replace(/^\+/, '')}?text=${encodeURIComponent(texte)}`;
const classeWhatsApp = `${classeBouton('principal', true)} !bg-whatsapp !text-ink-900 hover:!bg-whatsapp-hover text-center`;

export function ChangerStatut({ candidatId, statut, options }: { candidatId: number; statut: string; options: { code: string; libelle: string }[] }) {
  const { lancer, envoi, retour } = useAction();
  const [vers, setVers] = useState('');
  const [motif, setMotif] = useState('');
  return (
    <Carte titre="Changer le statut">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await lancer(() => actions.changerStatut(candidatId, vers as Parameters<typeof actions.changerStatut>[1], motif));
          if (r.ok) {
            setVers('');
            setMotif('');
          }
        }}
      >
        {retour}
        <div>
          <label htmlFor="statut-vers" className={classeLibelle}>Nouveau statut</label>
          <select id="statut-vers" required value={vers} onChange={(e) => setVers(e.target.value)} className={classeChamp}>
            <option value="">Choisir…</option>
            {options.filter((o) => o.code !== statut).map((o) => <option key={o.code} value={o.code}>{o.libelle}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="statut-motif" className={classeLibelle}>Motif (facultatif)</label>
          <input id="statut-motif" maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi || !vers} className={classeBouton('principal', true)}>Valider</button>
      </form>
    </Carte>
  );
}

// ─── Envoyer sur WhatsApp (modèles candidat) ──────────────────

export function EnvoyerWhatsApp({ candidatId, numero, modeles }: { candidatId: number; numero: string; modeles: { nom: string; texte: string }[] }) {
  const { lancer, retour } = useAction();
  const [nom, setNom] = useState('');
  const [texte, setTexte] = useState('');
  const modele = modeles.find((m) => m.nom === nom);
  return (
    <div className="mt-3 space-y-2">
      {retour}
      <label htmlFor="modele-candidat" className={classeLibelle}>Envoyer sur WhatsApp</label>
      <select
        id="modele-candidat"
        value={nom}
        onChange={(e) => {
          setNom(e.target.value);
          setTexte(modeles.find((m) => m.nom === e.target.value)?.texte ?? '');
        }}
        className={classeChamp}
      >
        <option value="">Choisir un modèle…</option>
        {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.nom}</option>)}
      </select>
      {modele && (
        <>
          <textarea aria-label="Aperçu du message" rows={7} value={texte} onChange={(e) => setTexte(e.target.value)} className={classeChamp} />
          <a href={lienWhatsApp(numero, texte)} target="_blank" rel="noopener noreferrer" onClick={() => void lancer(() => actions.noterWhatsApp(candidatId, modele.nom, texte))} className={classeWhatsApp}>
            Ouvrir WhatsApp
          </a>
        </>
      )}
    </div>
  );
}

// ─── Vérification d'identité (MVP2-01 RG-07, RG-08) ───────────

export interface InfosVerification {
  disponibles: { code: string; libelle: string; valeur: string }[];
  minimum: number;
}

function Verification({ id, infos, coches, onChange }: { id: string; infos: InfosVerification; coches: string[]; onChange: (c: string[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className={classeLibelle}>Vérification d’identité : posez les questions, puis cochez au moins {infos.minimum} réponses conformes au profil</legend>
      {infos.disponibles.length < infos.minimum && <Alerte type="info">Le profil ne contient pas assez d’informations pour vérifier l’identité. Passez par la Direction.</Alerte>}
      {infos.disponibles.map((e) => (
        <label key={e.code} htmlFor={`${id}-${e.code}`} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3 text-sm min-h-11">
          <input
            id={`${id}-${e.code}`}
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={coches.includes(e.code)}
            onChange={(ev) => onChange(ev.target.checked ? [...coches, e.code] : coches.filter((x) => x !== e.code))}
          />
          <span className="min-w-0">
            <span className="font-medium">{e.libelle}</span>
            <span className="block text-ink-600 break-words whitespace-pre-line">{e.valeur}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function ReinitialisationAssistee({ candidatId, numero, infos, demandeLe }: { candidatId: number; numero: string | null; infos: InfosVerification; demandeLe: string | null }) {
  const [coches, setCoches] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [genere, setGenere] = useState<{ lien: string; expireLe: string; message: string } | null>(null);
  const [copie, setCopie] = useState(false);
  return (
    <Carte titre="Mot de passe oublié — réinitialisation assistée">
      <div id="reinitialisation" className="space-y-3 scroll-mt-20">
        {demandeLe ? <Alerte type="info">Demande du candidat reçue le {demandeLe}.</Alerte> : <p className="text-sm text-ink-600">Aucune demande en attente. Vous pouvez tout de même générer un lien si le candidat vous le demande.</p>}
        {erreur && <Alerte>{erreur}</Alerte>}
        {genere ? (
          <div className="space-y-2">
            <Alerte type="succes">Lien généré, valable jusqu’à {new Date(genere.expireLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' })}, utilisable une seule fois. Il ne sera plus affiché : envoyez-le maintenant.</Alerte>
            <input readOnly value={genere.lien} aria-label="Lien de réinitialisation" className={`${classeChamp} text-xs font-mono`} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={classeBouton('secondaire', true)} onClick={async () => { await navigator.clipboard.writeText(genere.lien); setCopie(true); }}>{copie ? 'Copié ✓' : 'Copier le lien'}</button>
            {numero && (
              <>
                <textarea aria-label="Message WhatsApp" rows={6} value={genere.message} onChange={(e) => setGenere({ ...genere, message: e.target.value })} className={classeChamp} />
                <a href={lienWhatsApp(numero, genere.message)} target="_blank" rel="noopener noreferrer" onClick={() => void actions.noterWhatsApp(candidatId, 'Lien de réinitialisation', genere.message)} className={classeWhatsApp}>
                  Envoyer sur WhatsApp
                </a>
              </>
            )}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setEnvoi(true);
              setErreur(null);
              const r = await actions.genererLienReinitialisation(candidatId, coches);
              setEnvoi(false);
              if (r.ok) setGenere({ lien: r.lien, expireLe: r.expireLe, message: r.message });
              else setErreur(r.erreur);
            }}
          >
            <Verification id="verif-reinit" infos={infos} coches={coches} onChange={setCoches} />
            <button type="submit" disabled={envoi || coches.length < infos.minimum} className={classeBouton('principal', true)}>
              {envoi ? 'Génération…' : 'Générer un lien (30 min, usage unique)'}
            </button>
            <p className="text-xs text-ink-500">Les liens précédents non utilisés cessent de fonctionner. Vérification et génération sont journalisées.</p>
          </form>
        )}
      </div>
    </Carte>
  );
}

export function ChangerNumero({ candidatId, infos }: { candidatId: number; infos: InfosVerification }) {
  const { lancer, envoi, retour } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [coches, setCoches] = useState<string[]>([]);
  const [numero, setNumero] = useState('');
  if (!ouvert) return <button type="button" className="text-sm text-primary py-2 mt-2 min-h-11" onClick={() => setOuvert(true)}>Changer de numéro (procédure assistée)</button>;
  return (
    <form
      className="mt-3 space-y-3 border-t border-ink-100 pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm('Changer le numéro ? Le candidat sera déconnecté de tous ses appareils.')) return;
        const r = await lancer(() => actions.changerNumero(candidatId, numero, coches));
        if (r.ok) {
          setNumero('');
          setCoches([]);
          setOuvert(false);
        }
      }}
    >
      {retour}
      <Verification id="verif-numero" infos={infos} coches={coches} onChange={setCoches} />
      <div>
        <label htmlFor="nouveau-numero" className={classeLibelle}>Nouveau numéro</label>
        <input id="nouveau-numero" type="tel" inputMode="tel" autoComplete="off" required value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="6 90 00 00 00" className={classeChamp} />
      </div>
      <button type="submit" disabled={envoi || coches.length < infos.minimum || !numero.trim()} className={classeBouton('principal', true)}>Changer le numéro</button>
    </form>
  );
}

// ─── Réaffectation (Direction) ────────────────────────────────

export function Reaffecter({ candidatId, referentActuel, referents }: { candidatId: number; referentActuel: string | null; referents: { id: string; nom: string; charge: number; raisons: string[] }[] }) {
  const { lancer, envoi, retour } = useAction();
  const [cible, setCible] = useState('');
  const [motif, setMotif] = useState('');
  const choisi = referents.find((c) => c.id === cible);
  return (
    <Carte titre={referentActuel ? 'Réaffecter' : 'Attribuer'}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await lancer(() => actions.reaffecter(candidatId, cible, motif));
          if (r.ok) {
            setCible('');
            setMotif('');
          }
        }}
      >
        {retour}
        <div>
          <label htmlFor="cible-referent" className={classeLibelle}>Référent recrutement</label>
          <select id="cible-referent" required value={cible} onChange={(e) => setCible(e.target.value)} className={classeChamp}>
            <option value="">Choisir…</option>
            {referents
              .filter((c) => c.id !== referentActuel)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} · {c.charge} dossier{c.charge > 1 ? 's' : ''} ouvert{c.charge > 1 ? 's' : ''}
                  {c.raisons.length ? ' · non éligible' : ''}
                </option>
              ))}
          </select>
          {choisi && choisi.raisons.length > 0 && <p className="text-xs text-amber-700 mt-1">Attention : {choisi.raisons.join(', ')}.</p>}
        </div>
        <div>
          <label htmlFor="motif-reaffectation" className={classeLibelle}>Motif (obligatoire)</label>
          <input id="motif-reaffectation" required minLength={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
        </div>
        <button type="submit" disabled={envoi || !cible} className={classeBouton('principal', true)}>
          {referentActuel ? 'Réaffecter' : 'Attribuer'}
        </button>
      </form>
    </Carte>
  );
}
