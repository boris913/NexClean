'use client';
// MVP2-03 : actions de la section « Propositions » d'un dossier (référent du dossier ou Direction).
// Chaque formulaire appelle une action serveur qui revérifie les droits.
import { useState, type ReactNode } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import type { StatutProposition } from '@/lib/propositions/domaine';
import * as actions from './propositions/actions';

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

const classeFichier = 'block w-full text-sm file:mr-3 file:min-h-11 file:px-4 file:rounded-lg file:border-0 file:bg-primary-light file:text-primary-dark';
const classeWhatsApp = `${classeBouton('principal', true)} !bg-[#25D366] text-center`;
const aujourdhui = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

/** Bloc repliable : garde la carte compacte sur mobile. */
function Volet({ titre, children, danger = false }: { titre: string; children: ReactNode; danger?: boolean }) {
  return (
    <details className="group border border-ink-100 rounded-lg">
      <summary className={`cursor-pointer list-none min-h-11 flex items-center px-3 text-sm font-medium ${danger ? 'text-red-700' : 'text-primary'}`}>{titre}</summary>
      <div className="px-3 pb-3 space-y-3">{children}</div>
    </details>
  );
}

// ─── Proposer un candidat ─────────────────────────────────────

export function ProposerCandidat({
  dossierId,
  lignes,
  remplacements,
}: {
  dossierId: number;
  lignes: { id: number; intitule: string }[];
  remplacements: { placementId: number; lignePosteId: number; libelle: string }[];
}) {
  const { lancer, envoi, retour, setR } = useAction();
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<actions.CandidatTrouve[] | null>(null);
  const [candidat, setCandidat] = useState<actions.CandidatTrouve | null>(null);
  const [remplace, setRemplace] = useState<number | ''>('');
  const [ligne, setLigne] = useState<number | ''>(lignes.length === 1 ? lignes[0]!.id : '');
  const [salaire, setSalaire] = useState(false);
  const ligneImposee = remplace ? remplacements.find((x) => x.placementId === remplace)?.lignePosteId : undefined;

  return (
    <div className="space-y-3">
      {retour}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setCandidat(null);
          const r = await actions.chercherCandidats(q);
          if (!r.ok) return setR(r);
          setR(null);
          setResultats(r.candidats);
        }}
      >
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone ou métier" aria-label="Rechercher un candidat" className={classeChamp} />
        <button type="submit" className={classeBouton('secondaire')}>Chercher</button>
      </form>
      {resultats && !candidat && (
        resultats.length === 0 ? (
          <p className="text-sm text-ink-600">Aucun candidat disponible ne correspond.</p>
        ) : (
          <ul className="divide-y divide-ink-50 border border-ink-100 rounded-lg">
            {resultats.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setCandidat(c)} className="w-full text-left min-h-11 px-3 py-2 text-sm hover:bg-ink-50">
                  <span className="font-medium">{c.prenom} {c.nom}</span>
                  <span className="block text-xs text-ink-500">{[c.metiers.join(', '), c.ville ?? c.villeAutre, c.statut === 'place' ? 'déjà placé' : null].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {candidat && (
        <form
          className="space-y-3 border-t border-ink-100 pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const lignePosteId = ligneImposee ?? ligne;
            if (!lignePosteId) return;
            const r = await lancer(() => actions.creerProposition({ dossierId, lignePosteId, candidatId: candidat.id, salaireCommunicable: salaire, remplacePlacementId: remplace || null }));
            if (r.ok) {
              setCandidat(null);
              setResultats(null);
              setQ('');
              setRemplace('');
            }
          }}
        >
          <p className="text-sm">
            Candidat : <strong>{candidat.prenom} {candidat.nom}</strong>{' '}
            <button type="button" className="text-primary text-sm px-2 py-1" onClick={() => setCandidat(null)}>Changer</button>
          </p>
          {remplacements.length > 0 && (
            <div>
              <label htmlFor="remplace" className={classeLibelle}>Remplacement (garantie)</label>
              <select id="remplace" value={remplace} onChange={(e) => setRemplace(e.target.value ? Number(e.target.value) : '')} className={classeChamp}>
                <option value="">Non, proposition ordinaire</option>
                {remplacements.map((x) => <option key={x.placementId} value={x.placementId}>Remplace {x.libelle}</option>)}
              </select>
            </div>
          )}
          {!ligneImposee && (
            <div>
              <label htmlFor="ligne" className={classeLibelle}>Poste</label>
              <select id="ligne" required value={ligne} onChange={(e) => setLigne(e.target.value ? Number(e.target.value) : '')} className={classeChamp}>
                <option value="">Choisir…</option>
                {lignes.map((l) => <option key={l.id} value={l.id}>{l.intitule}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm min-h-11">
            <input type="checkbox" checked={salaire} onChange={(e) => setSalaire(e.target.checked)} className="mt-1" />
            <span>Le client autorise à montrer le salaire au candidat</span>
          </label>
          <button type="submit" disabled={envoi || (!ligneImposee && !ligne)} className={classeBouton('principal', true)}>Proposer ce candidat</button>
          <p className="text-xs text-ink-500">La proposition attend l’accord du candidat (espace candidat ou accord WhatsApp) avant toute transmission au client.</p>
        </form>
      )}
    </div>
  );
}

// ─── Proposition ──────────────────────────────────────────────

export interface ModeleProposition {
  nom: string;
  destinataire: 'candidat' | 'client';
}

export function ActionsProposition({
  dossierId,
  propositionId,
  statut,
  transitions,
  intitule,
  peutAnnoncer,
  peutPlacementDirect,
  peutLien,
  entretien,
  modeles,
  voirSalaire,
}: {
  dossierId: number;
  propositionId: number;
  statut: StatutProposition;
  transitions: { code: StatutProposition; libelle: string }[];
  intitule: string;
  peutAnnoncer: boolean;
  peutPlacementDirect: boolean;
  peutLien: boolean;
  entretien: { le: string; lieu: string } | null;
  modeles: ModeleProposition[];
  voirSalaire: boolean;
}) {
  const { lancer, envoi, retour } = useAction();
  const [vers, setVers] = useState<StatutProposition | ''>('');
  const [cleFichier, setCleFichier] = useState(0);

  return (
    <div className="space-y-2 mt-2">
      {retour}
      {statut === 'en_attente_accord' && (
        <Volet titre="Enregistrer un accord recueilli par WhatsApp">
          <form
            key={cleFichier}
            className="space-y-3"
            action={async (f) => {
              const r = await lancer(() => actions.enregistrerAccordWhatsApp(dossierId, propositionId, f));
              if (r.ok) setCleFichier((k) => k + 1);
            }}
          >
            <div>
              <label className={classeLibelle} htmlFor={`capture-${propositionId}`}>Capture de l’accord (obligatoire)</label>
              <input id={`capture-${propositionId}`} type="file" name="fichier" required accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" className={classeFichier} />
            </div>
            <div>
              <label className={classeLibelle} htmlFor={`date-accord-${propositionId}`}>Date de l’accord</label>
              <input id={`date-accord-${propositionId}`} type="date" name="date" required max={aujourdhui()} defaultValue={aujourdhui()} className={classeChamp} />
            </div>
            <label className="flex items-start gap-2 text-sm min-h-11">
              <input type="checkbox" name="numeroCommunicable" className="mt-1" />
              <span>Le candidat accepte que son numéro soit communiqué au client</span>
            </label>
            <p className="text-xs text-ink-500">L’accord porte sur ce client et ce poste uniquement ; le CV est transmis tel quel.</p>
            <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Enregistrer l’accord</button>
          </form>
        </Volet>
      )}

      {transitions.length > 0 && (
        <Volet titre="Changer le statut">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await lancer(() =>
                actions.changerStatutProposition(dossierId, propositionId, vers as StatutProposition, {
                  motif: String(f.get('motif') ?? ''),
                  entretienLe: String(f.get('entretienLe') ?? '') || null,
                  entretienLieu: String(f.get('entretienLieu') ?? '') || null,
                }),
              );
              if (r.ok) setVers('');
            }}
          >
            <select aria-label="Nouveau statut" required value={vers} onChange={(e) => setVers(e.target.value as StatutProposition)} className={classeChamp}>
              <option value="">Choisir…</option>
              {transitions.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
            </select>
            {vers === 'entretien' && (
              <>
                <div>
                  <label className={classeLibelle} htmlFor={`ent-le-${propositionId}`}>Date et heure (facultatif)</label>
                  <input id={`ent-le-${propositionId}`} type="datetime-local" name="entretienLe" className={classeChamp} />
                </div>
                <div>
                  <label className={classeLibelle} htmlFor={`ent-lieu-${propositionId}`}>Lieu (facultatif)</label>
                  <input id={`ent-lieu-${propositionId}`} name="entretienLieu" maxLength={200} className={classeChamp} />
                </div>
              </>
            )}
            {(vers === 'refusee' || vers === 'retiree' || vers === 'retenue') && (
              <div>
                <label className={classeLibelle} htmlFor={`motif-${propositionId}`}>Motif {vers === 'retenue' ? '(facultatif)' : '(obligatoire)'}</label>
                <input id={`motif-${propositionId}`} name="motif" required={vers !== 'retenue'} maxLength={500} className={classeChamp} />
              </div>
            )}
            <button type="submit" disabled={envoi || !vers} className={classeBouton('principal', true)}>Valider</button>
          </form>
        </Volet>
      )}

      {statut === 'entretien' && (
        <Volet titre="Modifier l’entretien">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await lancer(() => actions.modifierEntretien(dossierId, propositionId, { entretienLe: String(f.get('entretienLe') ?? '') || null, entretienLieu: String(f.get('entretienLieu') ?? '') || null }));
            }}
          >
            <input type="datetime-local" name="entretienLe" aria-label="Date et heure" defaultValue={entretien?.le ?? ''} className={classeChamp} />
            <input name="entretienLieu" aria-label="Lieu" maxLength={200} defaultValue={entretien?.lieu ?? ''} placeholder="Lieu" className={classeChamp} />
            <button type="submit" disabled={envoi} className={classeBouton('secondaire', true)}>Enregistrer</button>
          </form>
        </Volet>
      )}

      {peutAnnoncer && (
        <Volet titre="Annoncer le placement">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await lancer(() => actions.annoncerPlacement(dossierId, propositionId, { datePrevue: String(f.get('datePrevue') ?? ''), poste: String(f.get('poste') ?? ''), salaire: String(f.get('salaire') ?? '') || null }));
            }}
          >
            <div>
              <label className={classeLibelle} htmlFor={`prevue-${propositionId}`}>Prise de poste prévue le</label>
              <input id={`prevue-${propositionId}`} type="date" name="datePrevue" required className={classeChamp} />
            </div>
            <div>
              <label className={classeLibelle} htmlFor={`poste-${propositionId}`}>Poste</label>
              <input id={`poste-${propositionId}`} name="poste" defaultValue={intitule} maxLength={120} className={classeChamp} />
            </div>
            {voirSalaire && (
              <div>
                <label className={classeLibelle} htmlFor={`salaire-${propositionId}`}>Salaire convenu (facultatif, confidentiel)</label>
                <input id={`salaire-${propositionId}`} name="salaire" maxLength={120} className={classeChamp} />
              </div>
            )}
            <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Annoncer</button>
          </form>
        </Volet>
      )}

      {peutLien && <LienTemporaire dossierId={dossierId} propositionId={propositionId} />}
      {modeles.length > 0 && <MessageWhatsApp dossierId={dossierId} propositionId={propositionId} modeles={modeles} />}

      {peutPlacementDirect && (
        <Volet titre="Le client a recruté sans le déclarer">
          <form
            className="space-y-3"
            action={async (f) => {
              if (!window.confirm('Créer un placement confirmé sur preuve ?')) return;
              await lancer(() => actions.placementDirect(dossierId, propositionId, f));
            }}
          >
            <p className="text-xs text-ink-600">Placement confirmé sur preuve (déclaration du candidat, capture). La clause de non-contournement s’applique.</p>
            <input type="file" name="fichier" required accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" aria-label="Preuve" className={classeFichier} />
            <div>
              <label className={classeLibelle} htmlFor={`direct-date-${propositionId}`}>Date de prise de poste</label>
              <input id={`direct-date-${propositionId}`} type="date" name="datePriseDePoste" required max={aujourdhui()} className={classeChamp} />
            </div>
            <input name="poste" aria-label="Poste" defaultValue={intitule} maxLength={120} className={classeChamp} />
            {voirSalaire && <input name="salaire" aria-label="Salaire convenu" placeholder="Salaire convenu (facultatif)" maxLength={120} className={classeChamp} />}
            <button type="submit" disabled={envoi} className={classeBouton('secondaire', true)}>Créer le placement confirmé</button>
          </form>
        </Volet>
      )}
    </div>
  );
}

/** RG-10 : lien d'accès temporaire au profil, à copier (7 jours). */
function LienTemporaire({ dossierId, propositionId }: { dossierId: number; propositionId: number }) {
  const { envoi, retour, setR } = useAction();
  const [url, setUrl] = useState('');
  const [copie, setCopie] = useState(false);
  return (
    <Volet titre="Lien d’accès temporaire au profil">
      {retour}
      {url ? (
        <div className="space-y-2">
          <input readOnly value={url} aria-label="Lien d’accès" className={`${classeChamp} text-xs font-mono`} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className={classeBouton('secondaire', true)} onClick={async () => { await navigator.clipboard.writeText(url); setCopie(true); }}>{copie ? 'Copié ✓' : 'Copier'}</button>
          <p className="text-xs text-ink-500">Valable 7 jours, révocable. Ce lien n’est affiché qu’une fois.</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={envoi}
          className={classeBouton('secondaire', true)}
          onClick={async () => {
            const r = await actions.creerLien(dossierId, propositionId, 'profil');
            if (!r.ok) return setR(r);
            setR(null);
            setUrl(r.url);
          }}
        >
          Créer un lien (7 jours)
        </button>
      )}
    </Volet>
  );
}

/** « Envoyer sur WhatsApp » : modèles de proposition (au candidat ou au client). */
function MessageWhatsApp({ dossierId, propositionId, modeles }: { dossierId: number; propositionId: number; modeles: ModeleProposition[] }) {
  const { lancer, envoi, retour, setR } = useAction();
  const [nom, setNom] = useState('');
  const [message, setMessage] = useState<{ texte: string; numero: string | null } | null>(null);
  return (
    <Volet titre="Envoyer sur WhatsApp">
      {retour}
      <select
        aria-label="Modèle"
        value={nom}
        onChange={(e) => {
          setNom(e.target.value);
          setMessage(null);
        }}
        className={classeChamp}
      >
        <option value="">Choisir un modèle…</option>
        {modeles.map((m) => <option key={m.nom} value={m.nom}>{m.nom} ({m.destinataire === 'client' ? 'au client' : 'au candidat'})</option>)}
      </select>
      {nom && !message && (
        <button
          type="button"
          disabled={envoi}
          className={classeBouton('secondaire', true)}
          onClick={async () => {
            const r = await actions.preparerMessage(dossierId, propositionId, nom);
            if (!r.ok) return setR(r);
            setR(null);
            setMessage({ texte: r.texte, numero: r.numero });
          }}
        >
          Préparer le message
        </button>
      )}
      {message && (
        <>
          <textarea aria-label="Aperçu du message" rows={8} value={message.texte} onChange={(e) => setMessage({ ...message, texte: e.target.value })} className={classeChamp} />
          {message.numero ? (
            <a
              href={`https://wa.me/${message.numero.replace(/^\+/, '')}?text=${encodeURIComponent(message.texte)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void lancer(() => actions.noterWhatsApp(dossierId, propositionId, nom, message.texte))}
              className={classeWhatsApp}
            >
              Ouvrir WhatsApp
            </a>
          ) : (
            <Alerte type="info">Aucun numéro WhatsApp pour ce destinataire.</Alerte>
          )}
        </>
      )}
    </Volet>
  );
}

// ─── Placement ────────────────────────────────────────────────

export function ActionsPlacement({ dossierId, placementId, statut }: { dossierId: number; placementId: number; statut: 'annonce' | 'confirme' | 'rompu_garantie' | 'termine' | 'abandonne' }) {
  const { lancer, envoi, retour } = useAction();
  if (statut !== 'annonce' && statut !== 'confirme') return null;
  return (
    <div className="space-y-2 mt-2">
      {retour}
      {statut === 'annonce' && (
        <>
          <Volet titre="Confirmer avec une preuve">
            <form className="space-y-3" action={async (f) => { await lancer(() => actions.confirmerPlacement(dossierId, placementId, f)); }}>
              <div>
                <label className={classeLibelle} htmlFor={`preuve-${placementId}`}>Attestation signée ou capture WhatsApp (obligatoire)</label>
                <input id={`preuve-${placementId}`} type="file" name="fichier" required accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" capture="environment" className={classeFichier} />
              </div>
              <div>
                <label className={classeLibelle} htmlFor={`prise-${placementId}`}>Date effective de prise de poste</label>
                <input id={`prise-${placementId}`} type="date" name="datePriseDePoste" required max={aujourdhui()} className={classeChamp} />
              </div>
              <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>Confirmer la prise de poste</button>
            </form>
          </Volet>
          <Volet titre="Abandonner le placement" danger>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const motif = String(new FormData(e.currentTarget).get('motif') ?? '');
                await lancer(() => actions.abandonnerPlacement(dossierId, placementId, motif));
              }}
            >
              <input name="motif" required maxLength={500} aria-label="Motif de l’abandon" placeholder="Motif (obligatoire)" className={classeChamp} />
              <button type="submit" disabled={envoi} className={classeBouton('danger', true)}>Abandonner</button>
            </form>
          </Volet>
        </>
      )}
      {statut === 'confirme' && (
        <Volet titre="Le candidat a quitté le poste" danger>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await lancer(() => actions.declarerRupture(dossierId, placementId, { dateRupture: String(f.get('dateRupture') ?? ''), motif: String(f.get('motif') ?? '') }));
            }}
          >
            <div>
              <label className={classeLibelle} htmlFor={`rupture-${placementId}`}>Date du départ</label>
              <input id={`rupture-${placementId}`} type="date" name="dateRupture" required max={aujourdhui()} className={classeChamp} />
            </div>
            <input name="motif" required maxLength={500} aria-label="Motif du départ" placeholder="Motif (obligatoire)" className={classeChamp} />
            <p className="text-xs text-ink-500">Pendant la garantie : placement « rompu », remplacement sans commission. Après : « terminé », sans effet financier.</p>
            <button type="submit" disabled={envoi} className={classeBouton('danger', true)}>Enregistrer le départ</button>
          </form>
        </Volet>
      )}
    </div>
  );
}

export function RevoquerLien({ dossierId, accesId }: { dossierId: number; accesId: number }) {
  const { lancer, envoi, retour } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" disabled={envoi} className="text-sm text-red-700 px-2 py-2" onClick={() => window.confirm('Révoquer ce lien ? Il cessera immédiatement de fonctionner.') && lancer(() => actions.revoquerLien(dossierId, accesId))}>
        Révoquer
      </button>
      {retour}
    </span>
  );
}

// ─── Clôture de la recherche ──────────────────────────────────

export function ClotureRecherche({ dossierId, motifRequis, bloquee }: { dossierId: number; motifRequis: boolean; bloquee: boolean }) {
  const { lancer, envoi, retour } = useAction();
  const [motif, setMotif] = useState('');
  return (
    <form
      className="space-y-3 mt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!window.confirm('Clôturer la recherche ? Le nombre de placements retenus sera figé, les propositions en cours retirées et l’accès du client aux profils non placés révoqué.')) return;
        await lancer(() => actions.cloturerRecherche(dossierId, motif.trim()));
      }}
    >
      {retour}
      {motifRequis && (
        <div>
          <label htmlFor="motif-cloture" className={classeLibelle}>Motif (obligatoire avant l’échéance)</label>
          <input id="motif-cloture" required maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} className={classeChamp} />
        </div>
      )}
      <button type="submit" disabled={envoi || bloquee} className={classeBouton('principal', true)}>Clôturer la recherche</button>
    </form>
  );
}
