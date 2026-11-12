// COM3-02 : assistant virtuel WhatsApp — mise en service (RG-08), évaluation (RG-10), base de
// connaissances (RG-03), indicateurs (RG-09), brouillons du mode fantôme comparés aux réponses réelles.
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { exigerCollaborateur } from '@/lib/authz/session';
import { getDb, schema } from '@/lib/db';
import { lireParametre } from '@/lib/parametres';
import { iaActive } from '@/lib/ia/client';
import { listerConnaissances } from '@/lib/ia/connaissance';
import { MOTIFS_PASSAGE, type MotifPassage } from '@/lib/ia/agent-regles';
import { comparaisonsFantome, indicateursAgent } from '@/lib/ia/indicateurs-agent';
import { evaluationValide, listerEvaluations, versionsCourantes } from '@/lib/ia/evaluation/service';
import { JEU } from '@/lib/ia/evaluation/jeu';
import { SEUIL_QUALIFICATION } from '@/lib/ia/evaluation/notation';
import { formatHorodatage } from '@/lib/audit-lecture';
import { Alerte, Carte, ChiffreCle, Pastille, TitrePage } from '@/components/backoffice/ui';
import { Bot, Hand, ShieldAlert, CheckCircle2, FileCheck2 } from 'lucide-react';
import Rafraichir from '../messagerie/Rafraichir';
import { Fiche, LancerEvaluation, ModeAgent } from './Formulaires';
import { statutEvaluation } from './statuts';

export const metadata = { title: 'Assistant virtuel' };
export const dynamic = 'force-dynamic';

const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);

export default async function PageAgent() {
  await exigerCollaborateur({ permission: 'agent.gerer' });
  const au = new Date();
  const du = new Date(au.getTime() - 30 * 24 * 3600_000);
  const [mode, fiches, ind, recents, evaluations, valide, versions, fantome] = await Promise.all([
    lireParametre('mode_agent'),
    listerConnaissances(),
    indicateursAgent({ du, au }),
    getDb()
      .select({ id: schema.evenementAgent.id, type: schema.evenementAgent.type, motif: schema.evenementAgent.motif, texte: schema.evenementAgent.texte, creeLe: schema.evenementAgent.creeLe, conversationId: schema.evenementAgent.conversationId, numero: schema.conversation.numero })
      .from(schema.evenementAgent)
      .innerJoin(schema.conversation, eq(schema.conversation.id, schema.evenementAgent.conversationId))
      .orderBy(desc(schema.evenementAgent.creeLe))
      .limit(30),
    listerEvaluations(8),
    evaluationValide(),
    versionsCourantes(),
    comparaisonsFantome(15),
  ]);
  const enCours = evaluations.some((e) => e.statut === 'en_cours');
  const autonome = mode === 'hors_heures' || mode === 'permanent';
  return (
    <div className="space-y-5">
      {enCours && <Rafraichir secondes={15} />}
      <TitrePage titre="Assistant virtuel" description="Agent IA qui répond aux prospects sur WhatsApp dans un périmètre fermé, avec passage à un conseiller." />
      {autonome && !valide && <Alerte>L’agent répond seul alors que le prompt, la base de connaissances ou le modèle ont changé depuis la dernière évaluation réussie. Relancez l’évaluation ou repassez en mode fantôme.</Alerte>}
      <ModeAgent mode={mode} iaConfiguree={iaActive()} evaluee={!!valide} />

      <Carte
        titre="Évaluation"
        description={`${JEU.length} conversations types (services, villes, anglais et pidgin, prix fermes, remises, injections de consignes…) jouées avec le vrai modèle, sans rien envoyer. Mise en service : 100 % sur les interdits, au moins ${Math.round(SEUIL_QUALIFICATION * 100)} % sur la qualification.`}
      >
        <div className="space-y-3">
          <p className="text-xs text-ink-500">
            Versions en vigueur : jeu {versions.versionJeu} · prompt {versions.versionPrompt} · base {versions.versionBase} · modèle {versions.modele}
            {' — '}
            {valide ? <span className="font-medium text-leaf-700">évaluation réussie le {formatHorodatage(valide.termineeLe ?? new Date())}</span> : <span className="font-medium text-amber-800">aucune évaluation réussie pour ces versions</span>}
          </p>
          <LancerEvaluation nbCas={JEU.length} enCours={enCours} iaConfiguree={iaActive()} />
          {evaluations.length > 0 && (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="pb-2 font-semibold">Lancée</th>
                    <th className="pb-2 font-semibold">Statut</th>
                    <th className="pb-2 text-right font-semibold">Interdits</th>
                    <th className="pb-2 text-right font-semibold">Qualification</th>
                    <th className="pb-2 text-right font-semibold">Comportement</th>
                    <th className="pb-2 pl-3 font-semibold">Versions</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {evaluations.map((e) => {
                    const s = statutEvaluation(e.statut);
                    return (
                      <tr key={e.id} className="border-t border-ink-100">
                        <td className="py-2 pr-2">
                          <Link href={`/admin/agent/evaluations/${e.id}`} className="text-primary hover:underline">{formatHorodatage(e.lanceeLe)}</Link>
                          {e.lanceePar && <span className="block text-xs text-ink-500">{e.lanceePar}</span>}
                        </td>
                        <td className="py-2"><Pastille ton={s.ton}>{s.libelle}</Pastille></td>
                        <td className="py-2 text-right">{pourcent(e.scoreInterdits)}</td>
                        <td className="py-2 text-right">{pourcent(e.scoreQualification)}</td>
                        <td className="py-2 text-right">{pourcent(e.scoreComportement)}</td>
                        <td className="py-2 pl-3 text-xs text-ink-500">{e.versionPrompt} · {e.versionBase} · {e.modele}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Carte>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Indicateurs sur 30 jours</h2>
      <section aria-label="Indicateurs sur 30 jours" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <ChiffreCle icone={Bot} valeur={ind.conversationsPrises} libelle="conversations prises" href="#activite" />
        <ChiffreCle icone={CheckCircle2} valeur={ind.qualificationsCompletes} libelle={`qualifications complètes${ind.tauxQualification === null ? '' : ` (${ind.tauxQualification} %)`}`} href="#activite" />
        <ChiffreCle icone={Hand} valeur={ind.passages.reduce((s, p) => s + p.n, 0)} libelle="passages à un conseiller" href="#passages" />
        <ChiffreCle icone={ShieldAlert} valeur={ind.bloques} libelle="messages bloqués par le contrôle" href="#activite" alerte />
        <ChiffreCle icone={FileCheck2} valeur={ind.devisAcceptes} libelle={`devis acceptés sur ${ind.dossiersAgent} dossier(s) pris par l’agent`} href="#activite" />
      </section>
      {ind.passages.length > 0 && (
        <Carte titre="Passages à un conseiller, par motif">
          <ul id="passages" className="-my-1 divide-y divide-ink-100 text-sm">
            {ind.passages.map((m) => (
              <li key={m.motif} className="flex justify-between gap-3 py-2">
                <span>{MOTIFS_PASSAGE[m.motif] ?? m.motif}</span>
                <span className="font-semibold tabular-nums">{m.n}{m.taux !== null && <span className="ml-2 font-normal text-ink-500">{m.taux} %</span>}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {fantome.length > 0 && (
        <Carte titre="Mode fantôme : brouillon de l’agent et réponse réelle" description="Pour chaque message, ce que l’agent aurait envoyé et la première réponse d’un conseiller.">
          <ul className="-my-1 divide-y divide-ink-100 text-sm">
            {fantome.map((f) => (
              <li key={f.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link href={`/admin/messagerie/${f.conversationId}`} className="font-mono text-primary hover:underline">{f.numero}</Link>
                  <span className="text-ink-400">{formatHorodatage(f.creeLe)}</span>
                </div>
                {f.client && <p className="text-ink-600">Client : « {f.client} »</p>}
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg bg-ink-50 p-2.5">
                    <p className="mb-1 text-xs font-semibold text-ink-500">Agent (non envoyé)</p>
                    <p className="whitespace-pre-line text-ink-800">{f.brouillon}</p>
                  </div>
                  <div className="rounded-lg bg-brand-50 p-2.5">
                    <p className="mb-1 text-xs font-semibold text-ink-500">Conseiller</p>
                    <p className="whitespace-pre-line text-ink-800">{f.reponseHumaine ?? <span className="text-ink-400">Pas encore de réponse.</span>}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Base de connaissances</h2>
      <p className="-mt-3 text-sm text-ink-600">Services, villes, horaires et garantie sont ajoutés automatiquement depuis le système. Ajoutez ici le déroulé d’un recrutement, les délais habituels, les questions fréquentes… Toute modification impose une nouvelle évaluation avant la mise en service.</p>
      <div className="space-y-3">
        <Fiche fiche={null} />
        {fiches.map((f) => <Fiche key={`${f.id}-${f.version}`} fiche={f} />)}
      </div>

      <Carte titre="Activité récente">
        <ul id="activite" className="-my-1 divide-y divide-ink-100 text-sm">
          {recents.length === 0 && <li className="py-2 text-ink-500">Aucune activité.</li>}
          {recents.map((e) => (
            <li key={e.id} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pastille ton={e.type === 'bloque' ? 'rouge' : e.type === 'passage' ? 'orange' : e.type === 'brouillon' ? 'neutre' : 'vert'}>{e.type === 'brouillon' ? 'Brouillon (fantôme)' : e.type === 'bloque' ? 'Bloqué' : e.type === 'passage' ? 'Passage' : e.type === 'reponse' ? 'Réponse' : 'Qualification complète'}</Pastille>
                {e.motif && <span className="text-xs text-ink-600">{MOTIFS_PASSAGE[e.motif as MotifPassage] ?? e.motif}</span>}
                <Link href={`/admin/messagerie/${e.conversationId}`} className="font-mono text-xs text-primary hover:underline">{e.numero}</Link>
                <span className="text-xs text-ink-400">{formatHorodatage(e.creeLe)}</span>
              </div>
              {e.texte && <p className="whitespace-pre-line text-ink-700">{e.texte}</p>}
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
