// Évaluation de l'agent (specs/COM3-02 RG-10) : le jeu versionné est joué avec le vrai modèle, le
// prompt et la base de connaissances en vigueur, sans aucun effet (ni écriture métier, ni envoi).
// Condition de mise en service (modes « hors heures » et « permanent ») et de tout changement de
// prompt, de base ou de modèle.
import { and, desc, eq, lt } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { iaActive } from '@/lib/ia/client';
import { PROMPT_AGENT } from '@/lib/ia/prompts';
import { versionBase } from '@/lib/ia/connaissance';
import { simulerConversation } from '@/lib/ia/agent';
import { JEU, VERSION_JEU, type CasEvaluation } from './jeu';
import { noterCas, synthese, type ResultatCas } from './notation';

/** Jeudi 12 novembre 2026, 10 h à Douala : jour et heure ouvrés, fixes pour la reproductibilité. */
const INSTANT_EVALUATION = new Date('2026-11-12T10:00:00+01:00');
const PARALLELE = 4;
const DUREE_MAX_MS = 45 * 60_000;

export interface Versions {
  versionJeu: string;
  versionPrompt: string;
  versionBase: string;
  modele: string;
}

export async function versionsCourantes(): Promise<Versions> {
  return { versionJeu: VERSION_JEU, versionPrompt: PROMPT_AGENT.version, versionBase: await versionBase(), modele: env().IA_MODELE_AGENT };
}

const memesVersions = (a: Versions, b: Versions) => a.versionJeu === b.versionJeu && a.versionPrompt === b.versionPrompt && a.versionBase === b.versionBase && a.modele === b.modele;

export async function listerEvaluations(limite = 10) {
  return getDb()
    .select({ id: schema.evaluationAgent.id, statut: schema.evaluationAgent.statut, versionJeu: schema.evaluationAgent.versionJeu, versionPrompt: schema.evaluationAgent.versionPrompt, versionBase: schema.evaluationAgent.versionBase, modele: schema.evaluationAgent.modele, nbCas: schema.evaluationAgent.nbCas, scoreInterdits: schema.evaluationAgent.scoreInterdits, scoreQualification: schema.evaluationAgent.scoreQualification, scoreComportement: schema.evaluationAgent.scoreComportement, erreur: schema.evaluationAgent.erreur, lanceeLe: schema.evaluationAgent.lanceeLe, termineeLe: schema.evaluationAgent.termineeLe, lanceePar: schema.user.name })
    .from(schema.evaluationAgent)
    .leftJoin(schema.user, eq(schema.user.id, schema.evaluationAgent.lanceePar))
    .orderBy(desc(schema.evaluationAgent.lanceeLe))
    .limit(limite);
}

export async function lireEvaluation(id: number) {
  const [e] = await getDb().select().from(schema.evaluationAgent).where(eq(schema.evaluationAgent.id, id));
  return e ? { ...e, resultats: (e.resultats ?? []) as ResultatCas[] } : null;
}

/** Évaluation réussie pour les versions en vigueur, ou null. */
export async function evaluationValide(): Promise<{ id: number; termineeLe: Date | null } | null> {
  const v = await versionsCourantes();
  const [e] = await getDb()
    .select({ id: schema.evaluationAgent.id, termineeLe: schema.evaluationAgent.termineeLe, versionJeu: schema.evaluationAgent.versionJeu, versionPrompt: schema.evaluationAgent.versionPrompt, versionBase: schema.evaluationAgent.versionBase, modele: schema.evaluationAgent.modele })
    .from(schema.evaluationAgent)
    .where(and(eq(schema.evaluationAgent.statut, 'reussie'), eq(schema.evaluationAgent.versionJeu, v.versionJeu), eq(schema.evaluationAgent.versionPrompt, v.versionPrompt), eq(schema.evaluationAgent.versionBase, v.versionBase), eq(schema.evaluationAgent.modele, v.modele)))
    .orderBy(desc(schema.evaluationAgent.lanceeLe))
    .limit(1);
  return e && memesVersions(e, v) ? { id: e.id, termineeLe: e.termineeLe } : null;
}

/** Crée l'évaluation (une seule à la fois) ; l'exécution est lancée à part, en arrière-plan. */
export async function demarrerEvaluation(a: { id: string; ip?: string | null }): Promise<number> {
  if (!iaActive()) throw new ErreurMetier('La clé de l’API IA n’est pas configurée.');
  // Une évaluation restée « en cours » au-delà de la durée maximale (redémarrage) est abandonnée.
  await getDb().update(schema.evaluationAgent).set({ statut: 'erreur', erreur: 'Interrompue (durée maximale dépassée).', termineeLe: new Date() }).where(and(eq(schema.evaluationAgent.statut, 'en_cours'), lt(schema.evaluationAgent.lanceeLe, new Date(Date.now() - DUREE_MAX_MS))));
  const [enCours] = await getDb().select({ id: schema.evaluationAgent.id }).from(schema.evaluationAgent).where(eq(schema.evaluationAgent.statut, 'en_cours')).limit(1);
  if (enCours) throw new ErreurMetier('Une évaluation est déjà en cours.');
  const v = await versionsCourantes();
  const [r] = await getDb().insert(schema.evaluationAgent).values({ ...v, nbCas: JEU.length, lanceePar: a.id }).returning({ id: schema.evaluationAgent.id });
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'agent.evaluation_lancee', objetType: 'evaluation_agent', objetId: r!.id, details: { ...v } });
  return r!.id;
}

async function jouerCas(cas: CasEvaluation): Promise<ResultatCas> {
  try {
    return noterCas(cas, await simulerConversation(cas.messages, INSTANT_EVALUATION, cas.dossier ?? null));
  } catch (e) {
    return noterCas(cas, e instanceof Error ? e : new Error(String(e)));
  }
}

/** Joue le jeu complet (quelques cas en parallèle) et enregistre le verdict. Ne lève pas. */
export async function executerEvaluation(id: number, jeu: CasEvaluation[] = JEU): Promise<void> {
  try {
    const resultats: ResultatCas[] = new Array(jeu.length);
    let suivant = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLELE, jeu.length) }, async () => {
        while (suivant < jeu.length) {
          const i = suivant++;
          resultats[i] = await jouerCas(jeu[i]!);
        }
      }),
    );
    const s = synthese(resultats);
    await getDb()
      .update(schema.evaluationAgent)
      .set({ statut: s.reussie ? 'reussie' : 'echouee', nbCas: s.nbCas, scoreInterdits: s.scoreInterdits, scoreQualification: s.scoreQualification, scoreComportement: s.scoreComportement, resultats, termineeLe: new Date() })
      .where(eq(schema.evaluationAgent.id, id));
    await journaliser({ acteurType: 'systeme', action: 'agent.evaluation_terminee', objetType: 'evaluation_agent', objetId: id, details: { reussie: s.reussie, interdits: s.scoreInterdits, qualification: s.scoreQualification } });
  } catch (e) {
    console.error('[evaluation agent]', id, e);
    await getDb()
      .update(schema.evaluationAgent)
      .set({ statut: 'erreur', erreur: e instanceof Error ? e.message.slice(0, 500) : 'erreur', termineeLe: new Date() })
      .where(eq(schema.evaluationAgent.id, id))
      .catch(() => {});
  }
}
