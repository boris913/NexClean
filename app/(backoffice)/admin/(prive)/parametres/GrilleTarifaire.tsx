'use client';
// MVP2-04 RG-01, RG-02 : grille tarifaire et textes des documents (Direction, Administrateur),
// avec l'historique de chaque paramètre. Les modifications valent pour les nouveaux devis.
import { useId, useState, type ReactNode } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, Pastille, type ResultatAction } from '@/components/backoffice/ui';
import { formaterMontant, mentionTva } from '@/lib/devis/domaine';
import type { EntreeHistorique } from './grille';
import * as actions from './actions';

function useAction() {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const lancer = async (fn: () => Promise<ResultatAction>) => {
    setEnvoi(true);
    setR(null);
    try {
      setR(await fn());
    } catch {
      setR({ ok: false, erreur: 'Connexion au serveur impossible. Réessayez.' });
    }
    setEnvoi(false);
  };
  return { r, envoi, lancer };
}

const dateHeure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

function Historique({ entrees }: { entrees?: EntreeHistorique[] }) {
  if (!entrees?.length) return <p className={`${classeAide} !mt-3`}>Valeur initiale : aucune modification enregistrée.</p>;
  return (
    <details className="mt-3 rounded-lg border border-ink-200/70 bg-ink-50/50 px-3 text-sm">
      <summary className="flex min-h-11 sm:min-h-10 cursor-pointer items-center gap-2 font-medium text-ink-700">
        <History className="h-4 w-4 opacity-70" aria-hidden /> Historique ({entrees.length}
        {entrees.length >= 10 ? ' derniers' : ''})
      </summary>
      <ol className="divide-y divide-ink-200/70 pb-2">
        {entrees.map((e) => (
          <li key={e.id} className="py-2">
            <p className="break-words text-ink-900">{e.valeur}</p>
            <p className="text-xs text-ink-500">
              En vigueur depuis le {dateHeure(e.effetLe)} — {e.auteur}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Retour({ r }: { r: ResultatAction | null }) {
  return <div aria-live="polite">{r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}</div>;
}

function Formulaire({ onSubmit, children, envoi, bouton, r }: { onSubmit: () => void; children: ReactNode; envoi: boolean; bouton: string; r: ResultatAction | null }) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <Retour r={r} />
      <button type="submit" disabled={envoi} className={classeBouton('principal', true)}>
        {bouton}
      </button>
    </form>
  );
}

const entier = (s: string) => (s.trim() === '' ? NaN : Number(s));

export interface ValeursGrille {
  commission: number;
  commissionsParCategorie: Record<string, number>;
  tvaTaux: number;
  acompteTauxDefaut: number;
  acompteBornes: { min: number; max: number };
  delaiRechercheJours: number;
  garantieJours: number;
  validiteDevisJours: number;
  mentionsLegales: string;
  conditionsDevis: string;
  minimumFacturation: number | null;
}

export default function GrilleTarifaire({ valeurs, historique, metiers }: { valeurs: ValeursGrille; historique: Record<string, EntreeHistorique[] | undefined>; metiers: string[] }) {
  const id = useId();
  const [commission, setCommission] = useState(String(valeurs.commission));
  const [paires, setPaires] = useState(Object.entries(valeurs.commissionsParCategorie).map(([intitule, montant]) => ({ intitule, montant: String(montant) })));
  const [tva, setTva] = useState(String(valeurs.tvaTaux));
  const [acompte, setAcompte] = useState({ defaut: String(valeurs.acompteTauxDefaut), min: String(valeurs.acompteBornes.min), max: String(valeurs.acompteBornes.max) });
  const [delais, setDelais] = useState({ recherche: String(valeurs.delaiRechercheJours), garantie: String(valeurs.garantieJours), validite: String(valeurs.validiteDevisJours) });
  const [mentions, setMentions] = useState(valeurs.mentionsLegales);
  const [conditions, setConditions] = useState(valeurs.conditionsDevis);
  const c = useAction();
  const cat = useAction();
  const t = useAction();
  const a = useAction();
  const d = useAction();
  const m = useAction();
  const cg = useAction();
  const n = entier(commission);
  const nTva = entier(tva);

  return (
    <div className="space-y-4">
      <Alerte type="info">
        Toute modification s’applique aux <strong>nouveaux</strong> devis uniquement : les devis déjà créés, leurs PDF et les factures émises conservent leurs valeurs.
      </Alerte>

      <Carte titre="Commission de placement" description="Montant HT par personne placée.">
        <Formulaire envoi={c.envoi} r={c.r} bouton="Enregistrer la commission" onSubmit={() => void c.lancer(() => actions.enregistrerCommission(n))}>
          <div>
            <label htmlFor={`${id}-commission`} className={classeLibelle}>
              Commission par personne (FCFA HT)
            </label>
            <input id={`${id}-commission`} type="number" inputMode="numeric" min={0} step={1} required value={commission} onChange={(e) => setCommission(e.target.value)} className={classeChamp} />
            <p className={classeAide}>
              Sert au calcul des devis et à l’estimation affichée sur « Demander du personnel »{Number.isInteger(n) && n >= 0 ? ` : 10 personnes = ${formaterMontant(10 * n)}` : ''}.
            </p>
          </div>
        </Formulaire>
        <Historique entrees={historique.commission_par_personne} />
      </Carte>

      <Carte titre="Commissions par catégorie de poste" description="Facultatif : remplace la commission générale pour un intitulé de poste donné.">
        <Formulaire
          envoi={cat.envoi}
          r={cat.r}
          bouton="Enregistrer les commissions par catégorie"
          onSubmit={() => void cat.lancer(() => actions.enregistrerCommissionsCategorie(paires))}
        >
          <datalist id={`${id}-metiers`}>
            {metiers.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          {paires.length === 0 && <p className="text-sm text-ink-500">Aucune catégorie : la commission générale s’applique à tous les postes.</p>}
          <ul className="space-y-2">
            {paires.map((p, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-end gap-2">
                <div>
                  <label htmlFor={`${id}-cat-${i}`} className={i === 0 ? classeLibelle : 'sr-only'}>
                    Intitulé du poste
                  </label>
                  <input id={`${id}-cat-${i}`} list={`${id}-metiers`} maxLength={80} value={p.intitule} onChange={(e) => setPaires((l) => l.map((x, k) => (k === i ? { ...x, intitule: e.target.value } : x)))} className={classeChamp} />
                </div>
                <div>
                  <label htmlFor={`${id}-mt-${i}`} className={i === 0 ? classeLibelle : 'sr-only'}>
                    FCFA HT
                  </label>
                  <input id={`${id}-mt-${i}`} type="number" inputMode="numeric" min={0} step={1} value={p.montant} onChange={(e) => setPaires((l) => l.map((x, k) => (k === i ? { ...x, montant: e.target.value } : x)))} className={classeChamp} />
                </div>
                <button type="button" onClick={() => setPaires((l) => l.filter((_, k) => k !== i))} className={classeBouton('fantome')} aria-label={`Retirer la catégorie ${p.intitule || i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setPaires((l) => [...l, { intitule: '', montant: String(valeurs.commission) }])} className={classeBouton('secondaire')}>
            <Plus className="h-4 w-4" aria-hidden /> Ajouter une catégorie
          </button>
          <p className={classeAide}>L’intitulé est comparé sans tenir compte des majuscules ni des accents (« Serveur » = « serveur »). Les métiers suggérés sont proposés à la saisie.</p>
        </Formulaire>
        <Historique entrees={historique.commissions_par_categorie} />
      </Carte>

      <Carte titre="TVA">
        <Formulaire envoi={t.envoi} r={t.r} bouton="Enregistrer le taux de TVA" onSubmit={() => void t.lancer(() => actions.enregistrerTva(nTva))}>
          <div>
            <label htmlFor={`${id}-tva`} className={classeLibelle}>
              Taux de TVA (%)
            </label>
            <input id={`${id}-tva`} type="number" inputMode="numeric" min={0} max={100} step={1} required value={tva} onChange={(e) => setTva(e.target.value)} className={classeChamp} />
            <p className={classeAide}>
              Mention sur les devis et factures : <strong>{Number.isInteger(nTva) && nTva >= 0 && nTva <= 100 ? (nTva > 0 ? `Total HT, ${mentionTva(nTva)}, Total TTC` : mentionTva(0)) : '—'}</strong>
            </p>
          </div>
        </Formulaire>
        <Historique entrees={historique.tva_taux} />
      </Carte>

      <Carte titre="Acompte" description="Hors des bornes, un devis exige la validation de la Direction.">
        <Formulaire envoi={a.envoi} r={a.r} bouton="Enregistrer l’acompte" onSubmit={() => void a.lancer(() => actions.enregistrerAcompte(entier(acompte.defaut), entier(acompte.min), entier(acompte.max)))}>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['defaut', 'Taux par défaut (%)'],
                ['min', 'Borne minimale (%)'],
                ['max', 'Borne maximale (%)'],
              ] as const
            ).map(([k, libelle]) => (
              <div key={k}>
                <label htmlFor={`${id}-acompte-${k}`} className={classeLibelle}>
                  {libelle}
                </label>
                <input id={`${id}-acompte-${k}`} type="number" inputMode="numeric" min={0} max={100} step={1} required value={acompte[k]} onChange={(e) => setAcompte((x) => ({ ...x, [k]: e.target.value }))} className={classeChamp} />
              </div>
            ))}
          </div>
        </Formulaire>
        <Historique entrees={[...(historique.acompte_taux_defaut ?? []).map((e) => ({ ...e, valeur: `Taux par défaut : ${e.valeur}` })), ...(historique.acompte_bornes ?? []).map((e) => ({ ...e, valeur: `Bornes : ${e.valeur}` }))].sort((x, y) => new Date(y.effetLe).getTime() - new Date(x.effetLe).getTime() || y.id - x.id)} />
      </Carte>

      <Carte titre="Délais">
        <Formulaire envoi={d.envoi} r={d.r} bouton="Enregistrer les délais" onSubmit={() => void d.lancer(() => actions.enregistrerDelais(entier(delais.recherche), entier(delais.garantie), entier(delais.validite)))}>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['recherche', 'Délai de recherche (jours)', 1, 365],
                ['garantie', 'Garantie de remplacement (jours)', 0, 180],
                ['validite', 'Validité d’un devis (jours)', 1, 180],
              ] as const
            ).map(([k, libelle, min, max]) => (
              <div key={k}>
                <label htmlFor={`${id}-delai-${k}`} className={classeLibelle}>
                  {libelle}
                </label>
                <input id={`${id}-delai-${k}`} type="number" inputMode="numeric" min={min} max={max} step={1} required value={delais[k]} onChange={(e) => setDelais((x) => ({ ...x, [k]: e.target.value }))} className={classeChamp} />
              </div>
            ))}
          </div>
          <p className={classeAide}>Le délai de recherche court à partir de l’encaissement de l’acompte ; un devis non accepté à la fin de sa validité expire.</p>
        </Formulaire>
        <Historique
          entrees={[
            ...(historique.delai_recherche_jours ?? []).map((e) => ({ ...e, valeur: `Recherche : ${e.valeur}` })),
            ...(historique.garantie_jours ?? []).map((e) => ({ ...e, valeur: `Garantie : ${e.valeur}` })),
            ...(historique.validite_devis_jours ?? []).map((e) => ({ ...e, valeur: `Validité : ${e.valeur}` })),
          ].sort((x, y) => new Date(y.effetLe).getTime() - new Date(x.effetLe).getTime() || y.id - x.id)}
        />
      </Carte>

      <Carte titre="Mentions légales des documents" description="Raison sociale, adresse, RCCM, NIU, téléphone, e-mail.">
        <Formulaire envoi={m.envoi} r={m.r} bouton="Enregistrer les mentions légales" onSubmit={() => void m.lancer(() => actions.enregistrerTexte('mentions_legales', mentions))}>
          <div>
            <label htmlFor={`${id}-mentions`} className={classeLibelle}>
              Texte imprimé en pied de chaque document
            </label>
            <textarea id={`${id}-mentions`} rows={4} maxLength={1000} value={mentions} onChange={(e) => setMentions(e.target.value)} className={classeChamp} />
            <p className={classeAide}>{mentions.length} / 1000 caractères.</p>
          </div>
        </Formulaire>
        <Historique entrees={historique.mentions_legales} />
      </Carte>

      <Carte titre="Conditions générales du devis">
        <Formulaire envoi={cg.envoi} r={cg.r} bouton="Enregistrer les conditions générales" onSubmit={() => void cg.lancer(() => actions.enregistrerTexte('conditions_devis', conditions))}>
          <div>
            <label htmlFor={`${id}-conditions`} className={classeLibelle}>
              Une condition par ligne
            </label>
            <textarea id={`${id}-conditions`} rows={10} maxLength={5000} value={conditions} onChange={(e) => setConditions(e.target.value)} className={classeChamp} />
            <p className={classeAide}>Recopiées dans chaque nouveau devis ; le référent peut ajouter des conditions particulières propres au devis.</p>
          </div>
        </Formulaire>
        <Historique entrees={historique.conditions_devis} />
      </Carte>

      <Carte titre="Minimum de facturation" actions={<Pastille>Prévu, non appliqué</Pastille>}>
        <div className="space-y-2">
          <label htmlFor={`${id}-minimum`} className={classeLibelle}>
            Montant minimum (FCFA HT)
          </label>
          <input id={`${id}-minimum`} disabled value={valeurs.minimumFacturation === null ? 'Désactivé' : formaterMontant(valeurs.minimumFacturation)} className={classeChamp} aria-describedby={`${id}-minimum-aide`} />
          <p id={`${id}-minimum-aide`} className={classeAide}>
            En attente de décision (QO-3) : ce paramètre n’est pas pris en compte dans le calcul des devis.
          </p>
        </div>
      </Carte>
    </div>
  );
}
