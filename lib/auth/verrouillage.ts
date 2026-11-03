// Verrouillage après échecs de connexion (M1-AUT-06) : 5 échecs en 15 min pour un même
// compte ou une même IP → blocage 15 min. Les échecs sont lus dans le journal d'audit.
import { and, eq, gte, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

export const MAX_ECHECS = 5;
export const FENETRE_MS = 15 * 60 * 1000;
export const ACTION_ECHEC = 'auth.connexion_echec';

/** Règle pure : faut-il bloquer compte tenu du nombre d'échecs récents ? */
export function doitBloquer(echecsCompte: number, echecsIp: number): boolean {
  return echecsCompte >= MAX_ECHECS || echecsIp >= MAX_ECHECS;
}

export async function compterEchecsRecents(email: string, ip: string | null, maintenant = new Date()) {
  const depuis = new Date(maintenant.getTime() - FENETRE_MS);
  const j = schema.journalAudit;
  const emailNormalise = email.trim().toLowerCase();
  const [ligne] = await getDb()
    .select({
      compte: sql<number>`count(*) filter (where ${j.details}->>'email' = ${emailNormalise})`.mapWith(Number),
      ip: ip ? sql<number>`count(*) filter (where ${j.ip} = ${ip})`.mapWith(Number) : sql<number>`0`.mapWith(Number),
    })
    .from(j)
    .where(
      and(
        eq(j.action, ACTION_ECHEC),
        gte(j.horodatage, depuis),
        ip ? or(sql`${j.details}->>'email' = ${emailNormalise}`, eq(j.ip, ip)) : sql`${j.details}->>'email' = ${emailNormalise}`,
      ),
    );
  return { compte: ligne?.compte ?? 0, ip: ligne?.ip ?? 0 };
}
