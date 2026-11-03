'use client';
// Éléments interactifs de la liste « Candidatures » et du paramétrage des responsables d'offre.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alerte, classeBouton, type ResultatAction } from '@/components/backoffice/ui';
import { enregistrerResponsables, traiterCandidature } from './actions';

/** RG-09 : reçue → retenue / refusée. « Retenue » ne crée pas encore de Proposition (MVP2-03). */
export function TraiterCandidature({ id, nom }: { id: number; nom: string }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  const agir = async (vers: 'retenue' | 'refusee') => {
    if (vers === 'refusee' && !window.confirm(`Refuser la candidature de ${nom} ?`)) return;
    setEnvoi(true);
    const res = await traiterCandidature(id, vers).catch(() => ({ ok: false as const, erreur: 'Connexion au serveur impossible.' }));
    setR(res);
    setEnvoi(false);
    if (res.ok) router.refresh();
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" disabled={envoi} onClick={() => agir('retenue')} className={`${classeBouton('principal')} flex-1 sm:flex-none`}>
          Retenir
        </button>
        <button type="button" disabled={envoi} onClick={() => agir('refusee')} className={`${classeBouton('secondaire')} flex-1 sm:flex-none`}>
          Refuser
        </button>
      </div>
      {r && !r.ok && <Alerte>{r.erreur}</Alerte>}
    </div>
  );
}

/** RG-10 : responsables d'une offre (Direction). Ordre de cochage = ordre de désignation. */
export function ResponsablesOffre({ slug, titre, collaborateurs, initial }: { slug: string; titre: string; collaborateurs: { id: string; nom: string }[]; initial: string[] }) {
  const router = useRouter();
  const [choisis, setChoisis] = useState<string[]>(initial);
  const [envoi, setEnvoi] = useState(false);
  const [r, setR] = useState<ResultatAction | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnvoi(true);
        const res = await enregistrerResponsables(slug, choisis).catch(() => ({ ok: false as const, erreur: 'Connexion au serveur impossible.' }));
        setR(res);
        setEnvoi(false);
        if (res.ok) router.refresh();
      }}
    >
      <fieldset>
        <legend className="sr-only">Responsables de « {titre} »</legend>
        {collaborateurs.length === 0 ? (
          <p className="text-sm text-ink-600">Aucun collaborateur éligible (Direction, ou référent avec le service Recrutement).</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {collaborateurs.map((u) => {
              const coche = choisis.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-2 min-h-11 px-3 rounded-lg border text-sm ${coche ? 'border-primary bg-primary/5' : 'border-ink-200'}`}>
                  <input type="checkbox" checked={coche} onChange={() => setChoisis((c) => (coche ? c.filter((x) => x !== u.id) : [...c, u.id]))} className="h-5 w-5 accent-primary shrink-0" />
                  {u.nom}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <button type="submit" disabled={envoi} className={classeBouton('principal')}>
        Enregistrer
      </button>
      {r && (r.ok ? <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}
    </form>
  );
}
