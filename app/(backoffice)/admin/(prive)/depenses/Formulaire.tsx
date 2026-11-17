'use client';
// POST-03 RG-01, RG-03, RG-06 : formulaire d'une dépense (création / modification) et annulation.
import { useRef, useState } from 'react';
import { Alerte, Carte, classeAide, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { MOYENS_PAIEMENT } from '@/lib/encaissements/domaine';
import { MOYENS_DEPENSE, type MoyenDepense } from '@/lib/depenses/domaine';
import * as actions from './actions';

function Retour({ r }: { r: ResultatAction | null }) {
  return r ? r.ok ? r.message ? <Alerte type="succes">{r.message}</Alerte> : null : <Alerte>{r.erreur}</Alerte> : null;
}

export interface DepenseFormulaire {
  id?: number;
  depenseLe: string;
  categorieId: number | null;
  libelle: string;
  montant: number | null;
  moyen: MoyenDepense;
  reference: string | null;
  villeId: number | null;
  dossierNumero: string | null;
  service: DossierType | null;
  commentaire: string | null;
  justificatifNom?: string | null;
}

export function FormulaireDepense({ depense, categories, villes, aujourdhui }: { depense: DepenseFormulaire; categories: { id: number; libelle: string; actif: boolean }[]; villes: { id: number; nom: string }[]; aujourdhui: string }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [dossier, setDossier] = useState(depense.dossierNumero ?? '');
  const suivante = useRef(false);
  const nouvelle = depense.id === undefined;

  return (
    <form
      className="space-y-5"
      action={async (f) => {
        setEnvoi(true);
        setR(null);
        if (suivante.current) f.set('suivante', '1');
        const res = nouvelle ? await actions.creer(f) : await actions.modifier(depense.id!, f);
        suivante.current = false;
        setEnvoi(false);
        setR(res);
        if (!res.ok) window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <Retour r={r} />

      <Carte titre="La dépense">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="d-date" className={classeLibelle}>Date</label>
            <input id="d-date" name="depenseLe" type="date" required max={aujourdhui} defaultValue={depense.depenseLe} className={classeChamp} />
          </div>
          <div>
            <label htmlFor="d-montant" className={classeLibelle}>Montant payé (FCFA)</label>
            <input id="d-montant" name="montant" inputMode="numeric" required pattern="[0-9  .]+" defaultValue={depense.montant ?? ''} placeholder="15000" className={classeChamp} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="d-libelle" className={classeLibelle}>Libellé</label>
            <input id="d-libelle" name="libelle" required maxLength={200} defaultValue={depense.libelle} placeholder="Taxi Akwa – Bonamoussadi (entretien candidats)" className={classeChamp} />
          </div>
          <div>
            <label htmlFor="d-cat" className={classeLibelle}>Catégorie</label>
            <select id="d-cat" name="categorieId" required defaultValue={depense.categorieId ?? ''} className={classeChamp}>
              <option value="" disabled>Choisir…</option>
              {categories
                .filter((c) => c.actif || c.id === depense.categorieId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                    {c.actif ? '' : ' (désactivée)'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="d-moyen" className={classeLibelle}>Moyen de paiement</label>
            <select id="d-moyen" name="moyen" defaultValue={depense.moyen} className={classeChamp}>
              {MOYENS_DEPENSE.map((m) => (
                <option key={m} value={m}>{MOYENS_PAIEMENT[m]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="d-ref" className={classeLibelle}>Référence (facultatif)</label>
            <input id="d-ref" name="reference" maxLength={100} defaultValue={depense.reference ?? ''} placeholder="N° de transaction, de facture fournisseur…" className={classeChamp} />
          </div>
        </div>
      </Carte>

      <Carte titre="Rattachement (facultatif)" description="Une dépense rattachée à un dossier ou à un service entre dans le calcul de sa marge ; sinon elle reste une charge générale.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="d-dossier" className={classeLibelle}>Dossier</label>
            <input id="d-dossier" name="dossierNumero" value={dossier} onChange={(e) => setDossier(e.target.value.toUpperCase())} placeholder="REC-2026-00012" className={`${classeChamp} font-mono`} />
          </div>
          <div>
            <label htmlFor="d-service" className={classeLibelle}>Service</label>
            <select id="d-service" name="service" defaultValue={depense.service ?? ''} disabled={!!dossier.trim()} className={classeChamp}>
              <option value="">Aucun (charge générale)</option>
              {Object.entries(DOSSIER_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {dossier.trim() && <p className={classeAide}>Le service du dossier s’applique.</p>}
          </div>
          <div>
            <label htmlFor="d-ville" className={classeLibelle}>Ville</label>
            <select id="d-ville" name="villeId" defaultValue={depense.villeId ?? ''} className={classeChamp}>
              <option value="">—</option>
              {villes.map((v) => (
                <option key={v.id} value={v.id}>{v.nom}</option>
              ))}
            </select>
          </div>
        </div>
      </Carte>

      <Carte titre="Justificatif et commentaire">
        <div className="space-y-4">
          <div>
            <label htmlFor="d-just" className={classeLibelle}>{depense.justificatifNom ? 'Remplacer le justificatif' : 'Justificatif (facultatif)'}</label>
            <input id="d-just" name="justificatif" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className={classeChamp} />
            <p className={classeAide}>Photo du reçu ou PDF, 5 Mo au plus. Conservé dans le Back-Office, jamais public.</p>
            {depense.justificatifNom && (
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="retirerJustificatif" className="h-5 w-5 accent-primary" /> Retirer le justificatif actuel ({depense.justificatifNom})
              </label>
            )}
          </div>
          <div>
            <label htmlFor="d-com" className={classeLibelle}>Commentaire (facultatif)</label>
            <textarea id="d-com" name="commentaire" rows={2} maxLength={1000} defaultValue={depense.commentaire ?? ''} className={classeChamp} />
          </div>
        </div>
      </Carte>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={envoi} className={classeBouton('principal')}>
          {envoi ? 'Enregistrement…' : nouvelle ? 'Enregistrer la dépense' : 'Enregistrer'}
        </button>
        {nouvelle && (
          <button type="submit" disabled={envoi} className={classeBouton('secondaire')} onClick={() => (suivante.current = true)}>
            Enregistrer et saisir la suivante
          </button>
        )}
      </div>
    </form>
  );
}

export function AnnulerDepense({ id }: { id: number }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="space-y-2">
      <Retour r={r} />
      <button
        type="button"
        disabled={envoi}
        className={classeBouton('danger')}
        onClick={async () => {
          const motif = window.prompt('Motif de l’annulation (obligatoire) :', 'Saisie en double');
          if (motif === null) return;
          setEnvoi(true);
          setR(await actions.annuler(id, motif));
          setEnvoi(false);
        }}
      >
        Annuler la dépense
      </button>
    </div>
  );
}
