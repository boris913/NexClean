'use client';
// MVP2-03 RG-02 : « Proposer pour un dossier » depuis la fiche candidat (dossiers de recrutement
// traitables par l'utilisateur, au statut « Recherche en cours » ou « Candidats proposés »).
import { useState } from 'react';
import { Alerte, classeBouton, classeChamp, classeLibelle, type ResultatAction } from '@/components/backoffice/ui';
import { creerProposition } from '../../dossiers/[id]/propositions/actions';

export function ProposerPourDossier({ candidatId, dossiers }: { candidatId: number; dossiers: { id: number; numero: string; client: string; lignes: { id: number; intitule: string; nombre: number }[] }[] }) {
  const [dossierId, setDossierId] = useState<number | ''>('');
  const [ligneId, setLigneId] = useState<number | ''>('');
  const [salaire, setSalaire] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const dossier = dossiers.find((d) => d.id === dossierId);
  if (dossiers.length === 0) return <p className="text-sm text-ink-600 mt-3">Aucun dossier de recrutement en recherche que vous pouvez traiter.</p>;
  return (
    <form
      className="space-y-3 mt-3 border-t border-ink-100 pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!dossierId || !ligneId) return;
        setEnvoi(true);
        const res = await creerProposition({ dossierId, lignePosteId: ligneId, candidatId, salaireCommunicable: salaire });
        setEnvoi(false);
        setR(res);
        if (res.ok) {
          setDossierId('');
          setLigneId('');
          setSalaire(false);
        }
      }}
    >
      <h3 className="text-sm font-semibold">Proposer pour un dossier</h3>
      {r && (r.ok ? r.message && <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
      <div>
        <label htmlFor="proposer-dossier" className={classeLibelle}>Dossier</label>
        <select
          id="proposer-dossier"
          required
          value={dossierId}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : '';
            setDossierId(id);
            const d = dossiers.find((x) => x.id === id);
            setLigneId(d?.lignes.length === 1 ? d.lignes[0]!.id : '');
          }}
          className={classeChamp}
        >
          <option value="">Choisir…</option>
          {dossiers.map((d) => <option key={d.id} value={d.id}>{d.numero} — {d.client}</option>)}
        </select>
      </div>
      {dossier && (
        <div>
          <label htmlFor="proposer-ligne" className={classeLibelle}>Poste</label>
          <select id="proposer-ligne" required value={ligneId} onChange={(e) => setLigneId(e.target.value ? Number(e.target.value) : '')} className={classeChamp}>
            <option value="">Choisir…</option>
            {dossier.lignes.map((l) => <option key={l.id} value={l.id}>{l.intitule} ({l.nombre})</option>)}
          </select>
        </div>
      )}
      <label className="flex items-start gap-2 text-sm min-h-11">
        <input type="checkbox" checked={salaire} onChange={(e) => setSalaire(e.target.checked)} className="mt-1" />
        <span>Le client autorise à montrer le salaire au candidat</span>
      </label>
      <button type="submit" disabled={envoi || !dossierId || !ligneId} className={classeBouton('principal', true)}>Proposer</button>
      <p className="text-xs text-ink-500">La proposition attend l’accord du candidat avant toute transmission au client.</p>
    </form>
  );
}
