// Consultation du journal d'audit (M1-AUD-04) : filtres période, auteur, action, objet.
import { and, desc, eq, gte, like, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { FUSEAU } from '@/lib/domain/referentiels';

export interface FiltresJournal {
  du?: string; // AAAA-MM-JJ (fuseau Africa/Douala)
  au?: string;
  acteur?: string;
  action?: string;
  objetType?: string;
  objetId?: string;
  page?: number;
}

export const TAILLE_PAGE = 50;

/** Début de journée en Africa/Douala (UTC+1, sans heure d'été) converti en instant UTC. */
export function debutJourDouala(jour: string): Date {
  return new Date(`${jour}T00:00:00+01:00`);
}

export async function lireJournal(f: FiltresJournal) {
  const j = schema.journalAudit;
  const conditions = [
    f.du ? gte(j.horodatage, debutJourDouala(f.du)) : undefined,
    f.au ? lt(j.horodatage, new Date(debutJourDouala(f.au).getTime() + 86_400_000)) : undefined,
    f.acteur ? eq(j.acteurId, f.acteur) : undefined,
    f.action ? like(j.action, `${f.action.replace(/[%_\\]/g, '\\$&')}%`) : undefined,
    f.objetType ? eq(j.objetType, f.objetType) : undefined,
    f.objetId ? eq(j.objetId, f.objetId) : undefined,
  ].filter(Boolean);
  const page = Math.max(1, f.page ?? 1);
  const lignes = await getDb()
    .select({
      id: j.id,
      horodatage: j.horodatage,
      acteurType: j.acteurType,
      acteurId: j.acteurId,
      acteurNom: schema.user.name,
      action: j.action,
      objetType: j.objetType,
      objetId: j.objetId,
      avant: j.avant,
      apres: j.apres,
      details: j.details,
      ip: j.ip,
    })
    .from(j)
    .leftJoin(schema.user, eq(schema.user.id, j.acteurId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(j.horodatage), desc(j.id))
    .limit(TAILLE_PAGE + 1)
    .offset((page - 1) * TAILLE_PAGE);
  return { lignes: lignes.slice(0, TAILLE_PAGE), suivante: lignes.length > TAILLE_PAGE, page };
}

export async function actionsConnues(): Promise<string[]> {
  const r = await getDb().selectDistinct({ a: sql<string>`split_part(${schema.journalAudit.action}, '.', 1)` }).from(schema.journalAudit);
  return r.map((x) => x.a).sort();
}

export const formatHorodatage = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'short', timeStyle: 'medium' }).format(d);
