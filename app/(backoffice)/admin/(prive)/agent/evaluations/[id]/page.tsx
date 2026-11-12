// COM3-02 RG-10 : détail d'une évaluation de l'agent — scores, catégories, écarts et réponses par cas.
import { notFound } from 'next/navigation';
import { exigerCollaborateur } from '@/lib/authz/session';
import { lireEvaluation } from '@/lib/ia/evaluation/service';
import { CATEGORIES, JEU, type Categorie } from '@/lib/ia/evaluation/jeu';
import { synthese } from '@/lib/ia/evaluation/notation';
import { MOTIFS_PASSAGE } from '@/lib/ia/agent-regles';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, Pastille, TitrePage } from '@/components/backoffice/ui';
import Rafraichir from '../../../messagerie/Rafraichir';
import { statutEvaluation } from '../../statuts';

export const metadata = { title: 'Évaluation de l’assistant' };
export const dynamic = 'force-dynamic';

const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

export default async function PageEvaluation({ params }: { params: Promise<{ id: string }> }) {
  await exigerCollaborateur({ permission: 'agent.gerer' });
  const id = Number((await params).id);
  const e = Number.isInteger(id) ? await lireEvaluation(id) : null;
  if (!e) notFound();
  const s = statutEvaluation(e.statut);
  const resultats = [...e.resultats].sort((a, b) => Number(a.interdits && a.conforme && a.qualification !== false) - Number(b.interdits && b.conforme && b.qualification !== false));
  const parCategorie = synthese(e.resultats).parCategorie;
  const messages = new Map(JEU.map((c) => [c.id, c.messages]));
  return (
    <div className="space-y-5">
      {e.statut === 'en_cours' && <Rafraichir secondes={15} />}
      <TitrePage titre={`Évaluation du ${formatHorodatage(e.lanceeLe)}`} retour={{ href: '/admin/agent', libelle: 'Assistant virtuel' }} description={`Jeu ${e.versionJeu} · prompt ${e.versionPrompt} · base ${e.versionBase} · modèle ${e.modele}`}>
        <Pastille ton={s.ton}>{s.libelle}</Pastille>
      </TitrePage>
      {e.statut === 'en_cours' && <Alerte type="info">Évaluation en cours ({e.nbCas} conversations). La page se met à jour seule.</Alerte>}
      {e.erreur && <Alerte>{e.erreur}</Alerte>}

      {e.statut !== 'en_cours' && (
        <section aria-label="Scores" className="grid grid-cols-3 gap-3">
          {[
            { libelle: 'Interdits RG-02 (exigé : 100 %)', valeur: e.scoreInterdits, ok: e.scoreInterdits === 1 },
            { libelle: 'Qualification (exigé : 90 %)', valeur: e.scoreQualification, ok: (e.scoreQualification ?? 0) >= 0.9 },
            { libelle: 'Comportement attendu (indicatif)', valeur: e.scoreComportement, ok: true },
          ].map((x) => (
            <div key={x.libelle} className={`rounded-xl border bg-white p-4 shadow-sm ${x.ok ? 'border-ink-200/70' : 'border-red-300'}`}>
              <p className={`text-2xl font-semibold tabular-nums ${x.ok ? 'text-ink-900' : 'text-red-700'}`}>{pourcent(x.valeur)}</p>
              <p className="mt-1 text-sm text-ink-600">{x.libelle}</p>
            </div>
          ))}
        </section>
      )}

      {e.resultats.length > 0 && (
        <Carte titre="Par catégorie">
          <ul className="-my-1 divide-y divide-ink-100 text-sm">
            {Object.entries(parCategorie).map(([c, v]) => (
              <li key={c} className="flex justify-between gap-3 py-2">
                <span>{CATEGORIES[c as Categorie] ?? c}</span>
                <span className="tabular-nums text-ink-600">
                  interdits {v.interdits}/{v.cas} · conformes {v.conformes}/{v.cas}
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {resultats.length > 0 && (
        <Carte titre="Conversations" description="Les cas en écart apparaissent en premier.">
          <ul className="-my-1 divide-y divide-ink-100 text-sm">
            {resultats.map((r) => {
              const ok = r.interdits && r.conforme && r.qualification !== false;
              return (
                <li key={r.id} className="space-y-1.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pastille ton={!r.interdits ? 'rouge' : ok ? 'vert' : 'orange'}>{!r.interdits ? 'Interdit' : ok ? 'Conforme' : 'Écart'}</Pastille>
                    <span className="font-mono text-xs text-ink-700">{r.id}</span>
                    <span className="text-xs text-ink-500">{CATEGORIES[r.categorie] ?? r.categorie}</span>
                    <span className="text-xs text-ink-500">
                      → {r.issue}
                      {r.motif && ` (${MOTIFS_PASSAGE[r.motif] ?? r.motif})`}
                    </span>
                  </div>
                  <p className="text-ink-600">Client : {(messages.get(r.id) ?? []).map((m) => `« ${m} »`).join(' → ')}</p>
                  {r.reponses.map((t, i) => (
                    <p key={i} className="whitespace-pre-line rounded-lg bg-ink-50 p-2 text-ink-800">{t}</p>
                  ))}
                  {r.outils.length > 0 && <p className="text-xs text-ink-500">Outils : {r.outils.join(', ')}</p>}
                  {r.ecarts.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-red-700">
                      {r.ecarts.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>
      )}
    </div>
  );
}
