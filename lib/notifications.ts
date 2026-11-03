// Notifications des collaborateurs (MVP1-05 RG-10..13).
// La notification in-app est créée dans la transaction de l'événement. Les e-mails partent
// ensuite (file d'attente = lignes `email = true` non envoyées), sans bloquer l'action ;
// la tâche planifiée reprend les envois en échec (3 essais, puis journalisation).
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { echapperHtml, envoyerEmail } from '@/lib/email';

type Executeur = Pick<ReturnType<typeof getDb>, 'insert' | 'select'>;

export const MAX_ESSAIS_EMAIL = 3;

export interface NouvelleNotification {
  destinataires: (string | null | undefined)[];
  type: string;
  dossierId?: number | null;
  titre: string;
  texte: string;
  /** Chemin relatif dans le Back-Office (ex. /admin/dossiers/12). */
  lien?: string | null;
  /** Clé de dédoublonnage : un même destinataire ne reçoit qu'une fois la même clé. */
  cle?: string | null;
  email?: boolean;
  inApp?: boolean;
}

/** Ajoute une notification pour chaque destinataire distinct (sans doublon pour une même clé). */
export async function notifier(n: NouvelleNotification, tx?: Executeur): Promise<void> {
  const ids = [...new Set(n.destinataires.filter((d): d is string => !!d))];
  if (!ids.length) return;
  await (tx ?? getDb())
    .insert(schema.notification)
    .values(ids.map((destinataireId) => ({ destinataireId, type: n.type, dossierId: n.dossierId ?? null, titre: n.titre, texte: n.texte, lien: n.lien ?? null, cle: n.cle ?? null, email: !!n.email, inApp: n.inApp ?? true })))
    .onConflictDoNothing({ target: [schema.notification.destinataireId, schema.notification.cle] });
}

/** Collaborateurs actifs ayant le rôle Direction. */
export async function idsDirection(tx?: Executeur): Promise<string[]> {
  const r = await (tx ?? getDb())
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'direction')));
  return r.map((x) => x.id);
}

// ─── Envoi des e-mails ────────────────────────────────────────

function contenuEmail(n: { titre: string; texte: string; lien: string | null }) {
  const url = n.lien ? `${env().BETTER_AUTH_URL}${n.lien}` : null;
  const text = [n.texte, url ? `\nOuvrir dans le Back-Office (connexion requise) : ${url}` : '', '\nNEXCLEAN Back-Office'].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:560px">
<p style="white-space:pre-line">${echapperHtml(n.texte)}</p>
${url ? `<p><a href="${echapperHtml(url)}" style="display:inline-block;background:#3d7a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ouvrir dans le Back-Office</a></p><p style="color:#6b7280;font-size:13px">Connexion requise.</p>` : ''}
<p style="color:#6b7280">NEXCLEAN Back-Office</p></div>`;
  return { subject: `[NEXCLEAN] ${n.titre}`, text, html };
}

/** Envoie les e-mails en attente. Renvoie le nombre d'envois réussis. */
export async function envoyerNotificationsEnAttente(limite = 50): Promise<number> {
  const db = getDb();
  const n = schema.notification;
  // Réservation atomique : deux exécutions simultanées ne prennent pas les mêmes lignes.
  const reservees = await db
    .update(n)
    .set({ emailEssais: sql`${n.emailEssais} + 1` })
    .where(
      inArray(
        n.id,
        db
          .select({ id: n.id })
          .from(n)
          .where(and(eq(n.email, true), isNull(n.emailEnvoyeLe), isNull(n.emailEchecLe), lt(n.emailEssais, MAX_ESSAIS_EMAIL)))
          .orderBy(n.id)
          .limit(limite)
          .for('update', { skipLocked: true }),
      ),
    )
    .returning();
  let envoyes = 0;
  for (const r of reservees) {
    const [u] = await db.select({ email: schema.user.email, active: schema.user.active }).from(schema.user).where(eq(schema.user.id, r.destinataireId));
    if (!u?.active) {
      await db.update(n).set({ emailEchecLe: new Date() }).where(eq(n.id, r.id));
      continue;
    }
    try {
      await envoyerEmail({ to: u.email, ...contenuEmail(r) });
      await db.update(n).set({ emailEnvoyeLe: new Date() }).where(eq(n.id, r.id));
      envoyes++;
    } catch (e) {
      console.error('Notification : e-mail non envoyé', r.id, e);
      if (r.emailEssais >= MAX_ESSAIS_EMAIL) {
        await db.update(n).set({ emailEchecLe: new Date() }).where(eq(n.id, r.id));
        await journaliser({ acteurType: 'systeme', action: 'email.echec', objetType: 'notification', objetId: r.id, details: { type: r.type, dossierId: r.dossierId, essais: r.emailEssais } });
      }
    }
  }
  return envoyes;
}

/** Lance l'envoi sans attendre (après validation d'une action). Désactivé pendant les tests. */
export function declencherEnvoi(): void {
  if (process.env.VITEST) return;
  void envoyerNotificationsEnAttente().catch((e) => console.error('Envoi des notifications', e));
}

// ─── Lecture (cloche, liste) ──────────────────────────────────

export async function compterNonLues(userId: string): Promise<number> {
  const n = schema.notification;
  const [r] = await getDb()
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(n)
    .where(and(eq(n.destinataireId, userId), eq(n.inApp, true), isNull(n.luLe)));
  return r?.c ?? 0;
}

export async function listerNotifications(userId: string, limite = 50) {
  const n = schema.notification;
  return getDb()
    .select({ id: n.id, type: n.type, titre: n.titre, texte: n.texte, lien: n.lien, creeLe: n.creeLe, luLe: n.luLe, dossierId: n.dossierId })
    .from(n)
    .where(and(eq(n.destinataireId, userId), eq(n.inApp, true)))
    .orderBy(desc(n.creeLe), desc(n.id))
    .limit(limite);
}

/** Marque une notification lue ; renvoie son lien (seul le destinataire peut la lire). */
export async function marquerLue(id: number, userId: string): Promise<string | null> {
  const n = schema.notification;
  const [r] = await getDb()
    .update(n)
    .set({ luLe: sql`coalesce(${n.luLe}, now())` })
    .where(and(eq(n.id, id), eq(n.destinataireId, userId)))
    .returning({ lien: n.lien });
  return r?.lien ?? null;
}

export async function marquerToutesLues(userId: string): Promise<void> {
  const n = schema.notification;
  await getDb()
    .update(n)
    .set({ luLe: new Date() })
    .where(and(eq(n.destinataireId, userId), isNull(n.luLe)));
}
