// Messagerie WhatsApp du Back-Office (specs/COM2-01 RG-07, RG-08, RG-10) : lectures avec contrôle d'accès.
// Accès : `messagerie.voir_tout` (Direction) voit tout ; un référent voit les conversations de ses
// Dossiers ; le Responsable finances n'a pas accès.
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { peut } from '@/lib/authz/permissions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, type Demandeur } from '@/lib/dossiers/acces';
import { getStockage } from '@/lib/fichiers/stockage';
import { conditionNonTraitee } from './reception';

export const peutOuvrirMessagerie = (a: Demandeur) => peut(a.roles, 'messagerie.voir_tout') || a.roles.includes('referent');

function visibilite(a: Demandeur): SQL | undefined {
  if (peut(a.roles, 'messagerie.voir_tout')) return undefined;
  if (!a.roles.includes('referent')) return sql`false`;
  return eq(schema.dossier.referentId, a.id);
}

const colonnes = {
  id: schema.conversation.id,
  numero: schema.conversation.numero,
  nomProfil: schema.conversation.nomProfil,
  clientNom: schema.client.nom,
  candidatId: schema.conversation.candidatId,
  dossierId: schema.conversation.dossierId,
  dossierNumero: schema.dossier.numero,
  dossierType: schema.dossier.type,
  referentId: schema.dossier.referentId,
  dernierEntrantLe: schema.conversation.dernierEntrantLe,
  dernierSortantLe: schema.conversation.dernierSortantLe,
  automate: schema.conversation.automate,
  nonTraitee: sql<boolean>`coalesce(${conditionNonTraitee}, false)`,
  dernierTexte: sql<string | null>`(select ${schema.messageWhatsapp.texte} from ${schema.messageWhatsapp} where ${schema.messageWhatsapp.conversationId} = ${schema.conversation.id} order by ${schema.messageWhatsapp.horodatage} desc limit 1)`,
};

/** RG-08 : non traitées d'abord (la plus ancienne attente en tête), puis par dernier message. */
export async function listerConversations(a: Demandeur, filtre: 'toutes' | 'non_traitees' = 'toutes', limite = 100) {
  return getDb()
    .select(colonnes)
    .from(schema.conversation)
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.conversation.dossierId))
    .leftJoin(schema.client, eq(schema.client.id, schema.conversation.clientId))
    .where(and(visibilite(a), filtre === 'non_traitees' ? conditionNonTraitee : undefined))
    .orderBy(desc(sql`coalesce(${conditionNonTraitee}, false)`), sql`case when coalesce(${conditionNonTraitee}, false) then ${schema.conversation.dernierEntrantLe} end asc`, desc(sql`greatest(${schema.conversation.dernierEntrantLe}, ${schema.conversation.dernierSortantLe})`))
    .limit(limite);
}

/** Compteur de la navigation (RG-09). */
export async function compterNonTraitees(a: Demandeur): Promise<number> {
  if (!peutOuvrirMessagerie(a)) return 0;
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.conversation)
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.conversation.dossierId))
    .where(and(visibilite(a), conditionNonTraitee, sql`${schema.conversation.candidatId} is null`));
  return r?.n ?? 0;
}

export async function lireConversation(id: number, a: Demandeur) {
  const [c] = await getDb()
    .select(colonnes)
    .from(schema.conversation)
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.conversation.dossierId))
    .leftJoin(schema.client, eq(schema.client.id, schema.conversation.clientId))
    .where(and(eq(schema.conversation.id, id), visibilite(a)));
  if (!c) return null;
  const messages = await getDb()
    .select({ id: schema.messageWhatsapp.id, sens: schema.messageWhatsapp.sens, origine: schema.messageWhatsapp.origine, automatique: schema.messageWhatsapp.automatique, modele: schema.messageWhatsapp.modele, type: schema.messageWhatsapp.type, texte: schema.messageWhatsapp.texte, media: schema.messageWhatsapp.media, horodatage: schema.messageWhatsapp.horodatage, statut: schema.messageWhatsapp.statut, erreur: schema.messageWhatsapp.erreur })
    .from(schema.messageWhatsapp)
    .where(eq(schema.messageWhatsapp.conversationId, id))
    .orderBy(asc(schema.messageWhatsapp.horodatage), asc(schema.messageWhatsapp.id));
  return { ...c, messages };
}

/** Média stocké d'un message, après contrôle d'accès à la conversation ; journalisé. */
export async function lireMedia(messageId: number, a: Demandeur & { ip?: string | null }): Promise<{ mime: string; nom: string; octets: Uint8Array }> {
  const [m] = await getDb().select({ conversationId: schema.messageWhatsapp.conversationId, media: schema.messageWhatsapp.media }).from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.id, messageId));
  if (!m?.media?.cle) throw new ErreurMetier('Média indisponible.');
  if (!(await lireConversation(m.conversationId, a))) throw new ErreurMetier('Accès refusé.');
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'whatsapp.media_consulte', objetType: 'message_whatsapp', objetId: messageId });
  const ext = m.media.cle.split('.').pop();
  return { mime: m.media.mime ?? 'application/octet-stream', nom: m.media.nom ?? `whatsapp-${messageId}.${ext}`, octets: await getStockage().lire(m.media.cle) };
}

/** RG-07 : rattacher la conversation à un autre Dossier (droit de traitement sur la cible) ; journalisé. */
export async function rattacherConversation(id: number, dossierId: number, a: Demandeur & { ip?: string | null }): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [c] = await tx.select().from(schema.conversation).where(eq(schema.conversation.id, id)).for('update');
    if (!c) throw new ErreurMetier('Conversation introuvable.');
    const [actuel] = c.dossierId ? await tx.select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, c.dossierId)) : [];
    if (!peut(a.roles, 'messagerie.voir_tout') && !(actuel && peutTraiter(a, actuel.referentId))) throw new ErreurMetier('Accès refusé.');
    const [cible] = await tx.select({ id: schema.dossier.id, numero: schema.dossier.numero, referentId: schema.dossier.referentId, clientId: schema.dossier.clientId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
    if (!cible) throw new ErreurMetier('Dossier introuvable.');
    if (!peutTraiter(a, cible.referentId)) throw new ErreurMetier('Vous ne pouvez pas rattacher à ce dossier.');
    if (c.dossierId === cible.id) return;
    await tx.update(schema.conversation).set({ dossierId: cible.id }).where(eq(schema.conversation.id, id));
    await tx.insert(schema.evenementDossier).values({ dossierId: cible.id, auteurId: a.id, type: 'rattachement', commentaire: `Conversation WhatsApp ${c.numero} rattachée à ce dossier` });
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'whatsapp.conversation_rattachee', objetType: 'conversation', objetId: id, avant: { dossierId: c.dossierId }, apres: { dossierId: cible.id } }, tx);
  });
}
