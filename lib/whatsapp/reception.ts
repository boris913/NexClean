// WhatsApp Cloud API, réception (specs/COM2-01 RG-02..06, RG-09).
// Le webhook stocke le corps brut puis répond 200 ; ce module traite la file (juste après la
// réponse, et par la tâche planifiée pour les reprises). Chaque message est idempotent (wamid).
import { and, asc, desc, eq, gt, inArray, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { creerDemande } from '@/lib/dossiers/service';
import { STATUTS_FINAUX } from '@/lib/dossiers/statuts';
import { listesLieux } from '@/lib/geo/service';
import { referenceDepuisTexte } from '@/lib/acquisition/source';
import { idsDirection, notifier } from '@/lib/notifications';
import { lireParametre } from '@/lib/parametres';
import { ajouterHeuresOuvrees } from '@/lib/dossiers/heures-ouvrees';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import type { MediaWhatsapp } from '@/lib/db/schema/whatsapp';
import { lireWebhook, type MessageNormalise, type StatutNormalise } from './evenements';
import { lieuProbable, posteProbable, typeProbable } from './qualification';

export const MAX_ESSAIS = 3;
/** Même limite que le reste du système (ADR 0003). */
export const TAILLE_MAX_MEDIA = 5 * 1024 * 1024;
/** RG-03 : médias conservés ; les autres types restent référencés sans contenu. */
export const MIMES_MEDIA: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'video/mp4': 'mp4',
};

const ORDRE_STATUT = { envoye: 1, remis: 2, lu: 3, echec: 4 } as const;
const extrait = (t: string, n = 500) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export const whatsappActif = () => !!env().WHATSAPP_APP_SECRET;

/** RG-02 : stockage du corps brut, avant tout traitement. */
export async function enregistrerWebhook(corps: unknown): Promise<number> {
  const [r] = await getDb().insert(schema.webhookWhatsapp).values({ corps }).returning({ id: schema.webhookWhatsapp.id });
  return r!.id;
}

/** Traite les webhooks en attente (réservation atomique, 3 essais). Renvoie le nombre traité. */
export async function traiterWebhooksEnAttente(limite = 50, maintenant = new Date()): Promise<number> {
  const db = getDb();
  const w = schema.webhookWhatsapp;
  const reserves = await db
    .update(w)
    .set({ essais: sql`${w.essais} + 1` })
    .where(inArray(w.id, db.select({ id: w.id }).from(w).where(and(isNull(w.traiteLe), lt(w.essais, MAX_ESSAIS))).orderBy(w.id).limit(limite).for('update', { skipLocked: true })))
    .returning({ id: w.id, corps: w.corps });
  let n = 0;
  for (const r of reserves.sort((a, b) => a.id - b.id)) {
    try {
      for (const e of lireWebhook(r.corps)) {
        if (e.genre === 'message') await appliquerMessage(e, maintenant);
        else await appliquerStatut(e);
      }
      await db.update(w).set({ traiteLe: new Date(), erreur: null }).where(eq(w.id, r.id));
      n++;
    } catch (err) {
      console.error('[whatsapp] webhook', r.id, err);
      await db.update(w).set({ erreur: String(err instanceof Error ? err.message : err).slice(0, 1000) }).where(eq(w.id, r.id));
    }
  }
  return n;
}

// ─── Messages ─────────────────────────────────────────────────

async function conversationDe(numero: string, nomProfil: string | null) {
  const db = getDb();
  const [existante] = await db.select().from(schema.conversation).where(eq(schema.conversation.numero, numero));
  if (existante) {
    if (nomProfil && !existante.nomProfil) await db.update(schema.conversation).set({ nomProfil }).where(eq(schema.conversation.id, existante.id));
    return existante;
  }
  // Numéro d'un candidat connu : conversation signalée « candidat », sans Dossier client (§5).
  const [cand] = await db.select({ id: schema.candidat.id }).from(schema.candidat).where(or(eq(schema.candidat.telephone, numero), eq(schema.candidat.whatsapp, numero))).limit(1);
  const [cli] = await db.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.whatsapp, numero));
  const [c] = await db
    .insert(schema.conversation)
    .values({ numero, nomProfil, candidatId: cand?.id ?? null, clientId: cand ? null : (cli?.id ?? null) })
    .onConflictDoNothing({ target: schema.conversation.numero })
    .returning();
  return c ?? (await db.select().from(schema.conversation).where(eq(schema.conversation.numero, numero)))[0]!;
}

/** Dossier ouvert le plus récent d'un client. */
async function dossierOuvert(clientId: number): Promise<number | null> {
  const [d] = await getDb()
    .select({ id: schema.dossier.id })
    .from(schema.dossier)
    .where(and(eq(schema.dossier.clientId, clientId), notInArray(schema.dossier.statut, [...STATUTS_FINAUX])))
    .orderBy(desc(schema.dossier.creeLe))
    .limit(1);
  return d?.id ?? null;
}

/** RG-06 : premier message sans Dossier ouvert → Demande `whatsapp` + Dossier attribué. */
async function ouvrirDossier(m: MessageNormalise): Promise<{ dossierId: number; clientId: number }> {
  const lieux = await listesLieux();
  const lieu = lieuProbable(m.texte, lieux.map((v) => ({ id: v.id, nom: v.nom, quartiers: v.quartiers })));
  const ref = referenceDepuisTexte(m.texte);
  const type = typeProbable(m.texte);
  const r = await creerDemande({
    type,
    // Un Dossier de recrutement exige un poste : premier poste pré-rempli, à compléter par le référent.
    lignes: type === 'REC' ? [{ intitule: posteProbable(m.texte), nombre: 1, missions: 'À préciser avec le client (demande reçue sur WhatsApp).' }] : [],
    canal: 'whatsapp',
    formulaire: 'whatsapp',
    source: ref?.source ?? 'whatsapp_direct',
    client: { type: 'particulier', nom: m.nomProfil?.trim() || m.numero, contact: null, whatsapp: m.numero },
    villeId: lieu.villeId,
    villeAutre: null,
    quartierId: lieu.quartierId,
    quartierAutre: null,
    lieu: null,
    secteur: null,
    description: extrait(m.texte || `Message WhatsApp (${m.type})`, 2000),
    donnees: { whatsapp: { waId: m.waId, numero: m.numero, nomProfil: m.nomProfil, texte: m.texte, type: m.type, ...(ref?.piste ? { piste: ref.piste } : {}) } },
  });
  const [d] = await getDb().select({ clientId: schema.dossier.clientId }).from(schema.dossier).where(eq(schema.dossier.id, r.dossierId));
  return { dossierId: r.dossierId, clientId: d!.clientId };
}

export async function appliquerMessage(m: MessageNormalise, maintenant = new Date()): Promise<void> {
  const conversationId = await enregistrerMessage(m, maintenant);
  // COM2-02 RG-06..09 : STOP, accusé de réception, réponses par mot-clé (jamais bloquant).
  if (conversationId && m.sens === 'entrant') {
    // COM4-01 RG-09 : message portant la référence d'une Piste → Piste convertie, rattachée au Dossier.
    const piste = referenceDepuisTexte(m.texte)?.piste;
    if (piste) {
      const [c] = await getDb().select({ dossierId: schema.conversation.dossierId }).from(schema.conversation).where(eq(schema.conversation.id, conversationId));
      if (c?.dossierId) {
        const { convertirPiste } = await import('@/lib/veille/service');
        await convertirPiste(piste, c.dossierId, maintenant);
      }
    }
    // COM3-02 : l'agent conversationnel passe en premier ; s'il ne prend pas la conversation (mode,
    // interrupteurs, STOP, réponse humaine récente…), les réponses automatiques de COM2-02 s'appliquent.
    const { agentRepond } = await import('@/lib/ia/agent');
    if (await agentRepond(conversationId, m.texte, maintenant)) return;
    const { entrantPrecedent, repondreAutomatiquement } = await import('./envoi');
    await repondreAutomatiquement(conversationId, m.texte, await entrantPrecedent(conversationId, m.waId), maintenant);
  }
}

/** Enregistre le message et le rattache ; renvoie l'id de conversation, ou null s'il était déjà reçu. */
async function enregistrerMessage(m: MessageNormalise, maintenant: Date): Promise<number | null> {
  const db = getDb();
  let conv = await conversationDe(m.numero, m.nomProfil);
  const media: MediaWhatsapp | null = m.media ? { ...m.media, cle: null, essais: 0 } : null;
  const [insere] = await db
    .insert(schema.messageWhatsapp)
    .values({ conversationId: conv.id, waId: m.waId, sens: m.sens, origine: m.origine, type: m.type, texte: m.texte, media, horodatage: m.horodatage, recuLe: maintenant })
    .onConflictDoNothing({ target: schema.messageWhatsapp.waId })
    .returning({ id: schema.messageWhatsapp.id });
  if (!insere) return null; // RG-02 : déjà reçu

  await db
    .update(schema.conversation)
    .set(m.sens === 'entrant' ? { dernierEntrantLe: sql`greatest(${schema.conversation.dernierEntrantLe}, ${m.horodatage.toISOString()}::timestamptz)` } : { dernierSortantLe: sql`greatest(${schema.conversation.dernierSortantLe}, ${m.horodatage.toISOString()}::timestamptz)` })
    .where(eq(schema.conversation.id, conv.id));

  if (conv.candidatId) return conv.id;
  if (!conv.clientId) {
    // Client créé entre-temps par un autre canal (formulaire du site, saisie) : on rattache.
    const [cli] = await db.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.whatsapp, m.numero));
    if (cli) {
      await db.update(schema.conversation).set({ clientId: cli.id }).where(eq(schema.conversation.id, conv.id));
      conv = { ...conv, clientId: cli.id };
    }
  }

  // Dossier de rattachement : celui de la conversation s'il est encore ouvert, sinon le dossier
  // ouvert du client, sinon (message du client seulement) un nouveau Dossier.
  let dossierId = conv.dossierId;
  if (dossierId) {
    const [d] = await db.select({ statut: schema.dossier.statut }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
    if (!d || STATUTS_FINAUX.includes(d.statut)) dossierId = null;
  }
  if (!dossierId && conv.clientId) dossierId = await dossierOuvert(conv.clientId);
  if (!dossierId && m.sens === 'entrant') {
    let o: Awaited<ReturnType<typeof ouvrirDossier>>;
    try {
      o = await ouvrirDossier(m);
    } catch (err) {
      // Le message est retiré pour que la reprise (tâche planifiée) le retraite : sinon l'idempotence
      // le considérerait comme déjà reçu et la demande serait perdue.
      await db.delete(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.id, insere.id));
      throw err;
    }
    await db.update(schema.conversation).set({ dossierId: o.dossierId, clientId: o.clientId }).where(eq(schema.conversation.id, conv.id));
    return conv.id; // le message est déjà dans la Demande
  }
  if (!dossierId) return conv.id;
  if (dossierId !== conv.dossierId) {
    await db.update(schema.conversation).set({ dossierId }).where(eq(schema.conversation.id, conv.id));
    conv = { ...conv, dossierId };
  }
  // Historique du Dossier, sans toucher à « dernière action » (ce n'est pas une action de l'équipe).
  await db.insert(schema.evenementDossier).values({
    dossierId,
    auteurId: null,
    type: 'whatsapp',
    horodatage: m.horodatage,
    commentaire: `${m.sens === 'entrant' ? 'WhatsApp reçu' : 'WhatsApp envoyé depuis le téléphone'} : ${extrait(m.texte || m.type)}`,
  });
  return conv.id;
}

export async function appliquerStatut(s: StatutNormalise): Promise<void> {
  const db = getDb();
  const [m] = await db.select({ id: schema.messageWhatsapp.id, statut: schema.messageWhatsapp.statut }).from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.waId, s.waId));
  if (!m) return; // message envoyé hors du système (non connu) : ignoré
  if (m.statut && ORDRE_STATUT[m.statut] >= ORDRE_STATUT[s.statut]) return; // les statuts arrivent dans le désordre
  await db.update(schema.messageWhatsapp).set({ statut: s.statut, statutLe: s.horodatage, erreur: s.erreur }).where(eq(schema.messageWhatsapp.id, m.id));
}

// ─── Médias (RG-03) ───────────────────────────────────────────

async function graph(chemin: string, init: { binaire: true }): Promise<Uint8Array>;
async function graph(chemin: string): Promise<{ url: string; mime_type?: string; file_size?: number }>;
async function graph(chemin: string, init?: { binaire: true }) {
  const { WHATSAPP_ACCESS_TOKEN: jeton, WHATSAPP_GRAPH_VERSION: version } = env();
  if (!jeton) throw new Error('WHATSAPP_ACCESS_TOKEN manquant');
  const url = chemin.startsWith('https://') ? chemin : `https://graph.facebook.com/${version}/${chemin}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${jeton}` }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Graph ${r.status}`);
  return init?.binaire ? new Uint8Array(await r.arrayBuffer()) : r.json();
}

/** Télécharge les médias reçus et pas encore stockés (les URL Meta expirent). */
export async function telechargerMediasEnAttente(limite = 20): Promise<number> {
  if (!env().WHATSAPP_ACCESS_TOKEN) return 0;
  const db = getDb();
  const mw = schema.messageWhatsapp;
  const enAttente = await db
    .select({ id: mw.id, media: mw.media, horodatage: mw.horodatage })
    .from(mw)
    .where(and(sql`${mw.media} is not null`, sql`${mw.media}->>'cle' is null`, sql`coalesce((${mw.media}->>'tropVolumineux')::boolean, false) = false`, sql`coalesce((${mw.media}->>'essais')::int, 0) < ${MAX_ESSAIS}`))
    .orderBy(asc(mw.id))
    .limit(limite);
  let n = 0;
  for (const m of enAttente) {
    const media = m.media!;
    try {
      const info = await graph(media.mediaId);
      const mime = (info.mime_type ?? media.mime ?? '').split(';')[0]!.trim();
      const ext = MIMES_MEDIA[mime];
      if (!ext || (info.file_size ?? 0) > TAILLE_MAX_MEDIA) {
        await db.update(mw).set({ media: { ...media, mime, taille: info.file_size ?? null, tropVolumineux: true, erreur: ext ? 'Fichier trop volumineux (> 5 Mo)' : `Type ${mime || 'inconnu'} non conservé` } }).where(eq(mw.id, m.id));
        continue;
      }
      const octets = await graph(info.url, { binaire: true });
      if (octets.byteLength > TAILLE_MAX_MEDIA) {
        await db.update(mw).set({ media: { ...media, mime, taille: octets.byteLength, tropVolumineux: true, erreur: 'Fichier trop volumineux (> 5 Mo)' } }).where(eq(mw.id, m.id));
        continue;
      }
      const cle = nouvelleCle('whatsapp', ext, m.horodatage);
      await getStockage().deposer(cle, octets);
      await db.update(mw).set({ media: { ...media, mime, cle, taille: octets.byteLength, erreur: null } }).where(eq(mw.id, m.id));
      n++;
    } catch (err) {
      await db.update(mw).set({ media: { ...media, essais: (media.essais ?? 0) + 1, erreur: String(err instanceof Error ? err.message : err).slice(0, 300) } }).where(eq(mw.id, m.id));
    }
  }
  return n;
}

// ─── Conversations non traitées (RG-09) ───────────────────────

/** Non traitée : aucune réponse (téléphone ou Back-Office) depuis le dernier message entrant. */
export const conditionNonTraitee = sql`${schema.conversation.dernierEntrantLe} is not null and (${schema.conversation.dernierSortantLe} is null or ${schema.conversation.dernierSortantLe} < ${schema.conversation.dernierEntrantLe})`;

/** 2 h ouvrées sans réponse → référent ; 4 h → Direction (heures ouvrées de MVP1-05 RG-07). */
export async function alerterConversationsNonTraitees(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const horaires = await lireParametre('heures_ouvrees');
  const lignes = await db
    .select({ id: schema.conversation.id, numero: schema.conversation.numero, nomProfil: schema.conversation.nomProfil, dernierEntrantLe: schema.conversation.dernierEntrantLe, dossierId: schema.conversation.dossierId, referentId: schema.dossier.referentId, numeroDossier: schema.dossier.numero })
    .from(schema.conversation)
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.conversation.dossierId))
    .where(and(conditionNonTraitee, isNull(schema.conversation.candidatId), gt(schema.conversation.dernierEntrantLe, new Date(maintenant.getTime() - 7 * 24 * 3600_000))));
  const direction = lignes.length ? await idsDirection() : [];
  let n = 0;
  for (const c of lignes) {
    const depuis = c.dernierEntrantLe!;
    const qui = `${c.nomProfil ?? c.numero}${c.numeroDossier ? ` (${c.numeroDossier})` : ''}`;
    const commun = { type: 'whatsapp_non_traite', dossierId: c.dossierId, lien: `/admin/messagerie/${c.id}`, email: true };
    if (c.referentId && ajouterHeuresOuvrees(depuis, 2, horaires) <= maintenant) {
      await notifier({ ...commun, destinataires: [c.referentId], titre: `WhatsApp sans réponse : ${qui}`, texte: `Message reçu sans réponse depuis plus de 2 h ouvrées.`, cle: `wa:${c.id}:${depuis.toISOString()}:2h` });
      n++;
    }
    if (ajouterHeuresOuvrees(depuis, 4, horaires) <= maintenant) {
      await notifier({ ...commun, destinataires: direction, titre: `WhatsApp sans réponse depuis 4 h : ${qui}`, texte: `Message reçu sans réponse depuis plus de 4 h ouvrées.`, cle: `wa:${c.id}:${depuis.toISOString()}:4h` });
      n++;
    }
  }
  return n;
}
