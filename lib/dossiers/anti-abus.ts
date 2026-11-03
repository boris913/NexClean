// Protection des formulaires publics (MVP1-03 §3, MVP1-04 RG-08) : champ piège et
// limitation de débit par IP (10 envois / 10 min, tous formulaires confondus).
// Les envois sont comptés dans le journal d'audit : la limite tient sur plusieurs instances.
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';

export const MAX_ENVOIS_IP = 10;
export const FENETRE_ENVOIS_MS = 10 * 60 * 1000;
const ACTION_ENVOI = 'formulaire.envoi';

export const MESSAGE_ROBOT = 'Envoi refusé.';
export const MESSAGE_DEBIT = 'Trop d’envois depuis cette connexion. Réessayez dans quelques minutes ou envoyez votre demande sur WhatsApp.';

async function envoisRecents(ip: string): Promise<number> {
  const j = schema.journalAudit;
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(j)
    .where(and(eq(j.action, ACTION_ENVOI), eq(j.ip, ip), gte(j.horodatage, new Date(Date.now() - FENETRE_ENVOIS_MS))));
  return r?.n ?? 0;
}

/**
 * Contrôle un envoi public. Renvoie un message de refus, ou null si l'envoi est admis
 * (il est alors compté).
 */
export async function controlerEnvoi(formulaire: string, champPiege: unknown, ip: string | null): Promise<string | null> {
  if (typeof champPiege === 'string' && champPiege.trim()) {
    await journaliser({ acteurType: 'anonyme', action: 'formulaire.robot', ip, details: { formulaire } });
    return MESSAGE_ROBOT;
  }
  if (ip && (await envoisRecents(ip)) >= MAX_ENVOIS_IP) return MESSAGE_DEBIT;
  await journaliser({ acteurType: 'anonyme', action: ACTION_ENVOI, ip, details: { formulaire } });
  return null;
}
