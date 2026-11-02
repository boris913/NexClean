// Écriture dans le journal d'audit (M1-AUD-02).
import { getDb, schema } from '@/lib/db';

export type ActeurType = (typeof schema.acteurTypeEnum.enumValues)[number];

export interface EntreeAudit {
  acteurType: ActeurType;
  acteurId?: string | null;
  action: string;
  objetType?: string;
  objetId?: string | number;
  avant?: unknown;
  apres?: unknown;
  details?: unknown;
  ip?: string | null;
}

/** Exécuteur minimal : base ou transaction Drizzle. */
type Executeur = Pick<ReturnType<typeof getDb>, 'insert'>;

/**
 * Ajoute une entrée au journal. À appeler dans la même transaction que l'action
 * journalisée lorsque c'est possible (passer `tx`).
 */
export async function journaliser(entree: EntreeAudit, tx?: Executeur): Promise<void> {
  const db = tx ?? getDb();
  await db.insert(schema.journalAudit).values({
    acteurType: entree.acteurType,
    acteurId: entree.acteurId ?? null,
    action: entree.action,
    objetType: entree.objetType ?? null,
    objetId: entree.objetId === undefined ? null : String(entree.objetId),
    avant: entree.avant ?? null,
    apres: entree.apres ?? null,
    details: entree.details ?? null,
    ip: entree.ip ?? null,
  });
}

/** Adresse IP du client derrière le reverse proxy (Coolify / Traefik). */
export function ipDepuisEnTetes(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim() || null;
  return headers.get('x-real-ip');
}
