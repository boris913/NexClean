// Indicateurs de l'agent conversationnel (specs/COM3-02 RG-09) : conversations prises, taux de
// qualification complète, taux de passage par motif, messages bloqués, Dossiers issus de l'agent
// ayant abouti à un Devis accepté. Le mode fantôme (brouillons) est compté à part.
import { and, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { MotifPassage } from './agent-regles';

export interface IndicateursAgent {
  conversationsPrises: number;
  qualificationsCompletes: number;
  tauxQualification: number | null;
  passages: { motif: MotifPassage; n: number; taux: number | null }[];
  bloques: number;
  dossiersAgent: number;
  devisAcceptes: number;
  brouillons: number;
}

const taux = (n: number, total: number) => (total ? Math.round((n / total) * 100) : null);

export async function indicateursAgent(p: { du: Date; au: Date }): Promise<IndicateursAgent> {
  const e = schema.evenementAgent;
  const periode = and(gte(e.creeLe, p.du), lt(e.creeLe, p.au));
  const [compte, motifs, dossiers] = await Promise.all([
    getDb().select({ type: e.type, n: sql<number>`count(*)::int`, conversations: sql<number>`count(distinct ${e.conversationId})::int` }).from(e).where(periode).groupBy(e.type),
    getDb()
      .select({ motif: e.motif, conversations: sql<number>`count(distinct ${e.conversationId})::int` })
      .from(e)
      .where(and(periode, eq(e.type, 'passage')))
      .groupBy(e.motif),
    // Dossiers sur lesquels l'agent a répondu pendant la période, et ceux dont un devis a été accepté depuis.
    getDb()
      .select({
        dossiers: sql<number>`count(distinct ${e.dossierId})::int`,
        acceptes: sql<number>`count(distinct ${e.dossierId}) filter (where exists (select 1 from ${schema.devis} d where d.dossier_id = ${e.dossierId} and d.accepte_le is not null and d.accepte_le >= ${e.creeLe}))::int`,
      })
      .from(e)
      .where(and(periode, inArray(e.type, ['reponse', 'passage']), isNotNull(e.dossierId))),
  ]);
  const de = (type: string) => compte.find((c) => c.type === type);
  // Conversations prises : celles où l'agent a répondu ou passé la main (hors mode fantôme).
  const [{ prises }] = (await getDb()
    .select({ prises: sql<number>`count(distinct ${e.conversationId})::int` })
    .from(e)
    .where(and(periode, inArray(e.type, ['reponse', 'passage', 'bloque'])))) as [{ prises: number }];
  const qualifs = de('qualification_complete')?.conversations ?? 0;
  return {
    conversationsPrises: prises,
    qualificationsCompletes: qualifs,
    tauxQualification: taux(qualifs, prises),
    passages: motifs
      .filter((m) => m.motif)
      .map((m) => ({ motif: m.motif as MotifPassage, n: m.conversations, taux: taux(m.conversations, prises) }))
      .sort((a, b) => b.n - a.n),
    bloques: de('bloque')?.n ?? 0,
    dossiersAgent: dossiers[0]?.dossiers ?? 0,
    devisAcceptes: dossiers[0]?.acceptes ?? 0,
    brouillons: de('brouillon')?.n ?? 0,
  };
}

/**
 * RG-08 : brouillons du mode fantôme et première réponse humaine envoyée ensuite dans la même
 * conversation, pour juger l'agent avant de lui confier l'envoi.
 */
export async function comparaisonsFantome(limite = 20) {
  const e = schema.evenementAgent;
  return getDb()
    .select({
      id: e.id,
      conversationId: e.conversationId,
      numero: schema.conversation.numero,
      creeLe: e.creeLe,
      brouillon: e.texte,
      motif: e.motif,
      client: sql<string | null>`(select m.texte from message_whatsapp m where m.conversation_id = ${e.conversationId} and m.sens = 'entrant' and m.horodatage <= ${e.creeLe} order by m.horodatage desc limit 1)`,
      reponseHumaine: sql<string | null>`(select m.texte from message_whatsapp m where m.conversation_id = ${e.conversationId} and m.sens = 'sortant' and m.automatique = false and m.horodatage >= ${e.creeLe} order by m.horodatage limit 1)`,
    })
    .from(e)
    .innerJoin(schema.conversation, eq(schema.conversation.id, e.conversationId))
    .where(eq(e.type, 'brouillon'))
    .orderBy(sql`${e.creeLe} desc`)
    .limit(limite);
}
