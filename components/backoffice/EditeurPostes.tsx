'use client';
// Saisie des lignes de poste d'un dossier de recrutement (1 à 10).
import type { LignePosteSaisie } from '@/lib/dossiers/service';
import { classeBouton, classeChamp, classeLibelle } from './ui';

export const CONTRATS = ['CDI', 'CDD', 'Stage', 'Job étudiant', 'Temps partiel', 'Alternance', 'Mission ponctuelle', 'Saisonnier'];
export const EXPERIENCES = ['Débutant accepté', 'Moins d’1 an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans'];
export const ligneVide = (): LignePosteSaisie => ({ intitule: '', nombre: 1, joursRepos: [], desQuePossible: false });

export default function EditeurPostes({ lignes, onChange, voirSalaire = true }: { lignes: LignePosteSaisie[]; onChange: (l: LignePosteSaisie[]) => void; voirSalaire?: boolean }) {
  const maj = (i: number, champs: Partial<LignePosteSaisie>) => onChange(lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)));
  return (
    <div className="space-y-3">
      {lignes.map((l, i) => (
        <fieldset key={i} className="border border-ink-100 rounded-lg p-3 space-y-3">
          <legend className="px-1 text-sm font-semibold">Poste {i + 1}</legend>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={classeLibelle} htmlFor={`intitule-${i}`}>Intitulé</label>
              <input id={`intitule-${i}`} required className={classeChamp} value={l.intitule} onChange={(e) => maj(i, { intitule: e.target.value })} />
            </div>
            <div>
              <label className={classeLibelle} htmlFor={`nombre-${i}`}>Personnes</label>
              <input id={`nombre-${i}`} type="number" inputMode="numeric" min={1} max={100} required className={classeChamp} value={l.nombre} onChange={(e) => maj(i, { nombre: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={classeLibelle} htmlFor={`contrat-${i}`}>Contrat</label>
              <select id={`contrat-${i}`} className={classeChamp} value={l.typeContrat ?? ''} onChange={(e) => maj(i, { typeContrat: e.target.value || null })}>
                <option value="">—</option>
                {CONTRATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={classeLibelle} htmlFor={`experience-${i}`}>Expérience</label>
              <select id={`experience-${i}`} className={classeChamp} value={l.experience ?? ''} onChange={(e) => maj(i, { experience: e.target.value || null })}>
                <option value="">—</option>
                {EXPERIENCES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            {voirSalaire && (
              <div>
                <label className={classeLibelle} htmlFor={`salaire-${i}`}>Salaire / budget (confidentiel)</label>
                <input id={`salaire-${i}`} className={classeChamp} value={l.salaire ?? ''} onChange={(e) => maj(i, { salaire: e.target.value || null })} />
              </div>
            )}
            <div>
              <label className={classeLibelle} htmlFor={`horaires-${i}`}>Horaires</label>
              <input id={`horaires-${i}`} className={classeChamp} value={l.horaires ?? ''} onChange={(e) => maj(i, { horaires: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className={classeLibelle} htmlFor={`missions-${i}`}>Missions</label>
            <textarea id={`missions-${i}`} rows={2} className={classeChamp} value={l.missions ?? ''} onChange={(e) => maj(i, { missions: e.target.value || null })} />
          </div>
          {lignes.length > 1 && (
            <button type="button" className="text-sm text-red-700 py-2" onClick={() => onChange(lignes.filter((_, j) => j !== i))}>
              Retirer ce poste
            </button>
          )}
        </fieldset>
      ))}
      {lignes.length < 10 && (
        <button type="button" className={classeBouton('secondaire', true)} onClick={() => onChange([...lignes, ligneVide()])}>
          + Ajouter un poste
        </button>
      )}
    </div>
  );
}
