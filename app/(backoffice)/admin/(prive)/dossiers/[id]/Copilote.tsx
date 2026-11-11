'use client';
// COM3-01 RG-06, RG-09, RG-10 : suggestions de l'IA sur la fiche dossier. Rien n'est appliqué ni
// envoyé sans un clic du référent.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Alerte, classeBouton, classeChamp, type ResultatAction } from '@/components/backoffice/ui';
import * as actions from '../actions';

export interface QualificationProposee {
  id: number;
  lignes: [string, string][];
  dejaTraitee: boolean;
}

export default function Copilote({ dossierId, resume, qualification, relancePossible }: { dossierId: number; resume: string | null; qualification: QualificationProposee | null; relancePossible: boolean }) {
  const [r, setR] = useState<ResultatAction | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [relance, setRelance] = useState<{ moment: string | null; message: string } | null>(null);
  const lancer = async (cle: string, fn: () => Promise<ResultatAction>) => {
    setEnvoi(cle);
    setR(await fn());
    setEnvoi(null);
  };
  return (
    <div className="space-y-3">
      {r && (r.ok ? r.message && <Alerte type="succes">{r.message}</Alerte> : <Alerte>{r.erreur}</Alerte>)}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Résumé</h3>
          <button type="button" disabled={!!envoi} onClick={() => lancer('resume', () => actions.resumerDossierIa(dossierId))} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
            {envoi === 'resume' ? 'Rédaction…' : resume ? 'Régénérer' : 'Générer'}
          </button>
        </div>
        {resume ? <p className="whitespace-pre-line text-sm text-ink-800">{resume}</p> : <p className="text-sm text-ink-500">Pas encore de résumé.</p>}
      </div>

      {qualification && !qualification.dejaTraitee && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-900">
            <Sparkles aria-hidden className="h-3.5 w-3.5" /> Qualification proposée
          </h3>
          <dl className="grid grid-cols-[7rem,1fr] gap-x-3 gap-y-1 text-sm [&>dt]:text-ink-500 [&>dd]:text-ink-900">
            {qualification.lignes.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!!envoi} onClick={() => lancer('appliquer', () => actions.appliquerQualificationIa(dossierId, qualification.id))} className={classeBouton('principal')}>
              Appliquer
            </button>
            <button type="button" disabled={!!envoi} onClick={() => lancer('ignorer', () => actions.ignorerSuggestionIa(dossierId, qualification.id))} className={classeBouton('secondaire')}>
              Ignorer
            </button>
          </div>
        </div>
      )}

      {relancePossible && (
        <div>
          <button
            type="button"
            disabled={!!envoi}
            onClick={async () => {
              setEnvoi('relance');
              const res = await actions.suggererRelanceIa(dossierId);
              setEnvoi(null);
              if (res.ok) {
                setRelance({ moment: res.moment, message: res.message });
                setR(null);
              } else setR({ ok: false, erreur: res.erreur });
            }}
            className={classeBouton('secondaire')}
          >
            {envoi === 'relance' ? 'Rédaction…' : 'Suggérer une relance'}
          </button>
          {relance && (
            <div className="mt-2 space-y-1">
              {relance.moment && <p className="text-xs text-ink-600">Moment conseillé : {relance.moment}</p>}
              <textarea aria-label="Relance suggérée" rows={4} defaultValue={relance.message} className={classeChamp} />
              <p className="text-xs text-ink-500">À relire puis envoyer depuis la messagerie ou WhatsApp.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
