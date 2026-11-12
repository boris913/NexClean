// Veille prospects (specs/COM4-01 RG-12) : pistes trouvées, retenues, contactées, converties et
// CA issu des pistes, par source et par requête ; requêtes improductives sur 30 jours.
import { and, gte, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { motsRequete } from './flux';
import { TYPES_SOURCE, type TypeSource } from './domaine';

export interface LigneVeille {
  cle: string;
  libelle: string;
  trouvees: number;
  retenues: number;
  contactees: number;
  converties: number;
  /** CA encaissé sur la période, sur les Dossiers issus des pistes (FCFA). */
  ca: number;
}

const JOUR_MS = 24 * 3600_000;
/** Statuts atteints après « retenue » (la piste a été jugée intéressante). */
const RETENUES = `('retenue','contactee','en_conversation','convertie','sans_suite')`;

/**
 * Agrégats sur les pistes créées dans la période (trouvées, retenues, contactées, converties), et
 * CA encaissé dans la période sur les Dossiers issus de pistes (quelle que soit leur date de création).
 */
export async function indicateursVeille(p: { du: Date; au: Date }): Promise<{ total: LigneVeille; parSource: LigneVeille[]; parRequete: LigneVeille[] }> {
  const pi = schema.piste;
  const jourDu = p.du.toISOString();
  const jourAu = p.au.toISOString();
  const compte = (cle: SQLFragment, libelle: SQLFragment) =>
    getDb()
      .select({
        cle: sql<string>`${cle}`,
        libelle: sql<string>`${libelle}`,
        trouvees: sql<number>`count(*) filter (where ${pi.creeLe} >= ${jourDu}::timestamptz and ${pi.creeLe} < ${jourAu}::timestamptz)::int`,
        retenues: sql<number>`count(*) filter (where ${pi.creeLe} >= ${jourDu}::timestamptz and ${pi.creeLe} < ${jourAu}::timestamptz and ${pi.statut}::text in ${sql.raw(RETENUES)})::int`,
        contactees: sql<number>`count(*) filter (where ${pi.creeLe} >= ${jourDu}::timestamptz and ${pi.creeLe} < ${jourAu}::timestamptz and exists (select 1 from contact_piste c where c.piste_id = ${pi.id}))::int`,
        converties: sql<number>`count(*) filter (where ${pi.convertieLe} >= ${jourDu}::timestamptz and ${pi.convertieLe} < ${jourAu}::timestamptz)::int`,
        ca: sql<number>`coalesce(sum((select sum(e.montant) from encaissement e where e.dossier_id = ${pi.dossierId} and e.recu_le >= ${jourDu}::timestamptz and e.recu_le < ${jourAu}::timestamptz)), 0)::int`,
      })
      .from(pi)
      .leftJoin(schema.sourceVeille, sql`${schema.sourceVeille.id} = ${pi.sourceId}`)
      .groupBy(sql`1`, sql`2`);
  const [parSource, parRequete] = await Promise.all([
    compte(sql`coalesce(${pi.sourceId}::text, ${pi.source})`, sql`coalesce(${schema.sourceVeille.nom}, ${pi.source})`),
    compte(sql`coalesce(${pi.sourceId}::text, ${pi.source}) || ':' || coalesce(${pi.requete}, '')`, sql`coalesce(${schema.sourceVeille.nom}, ${pi.source}) || coalesce(' — ' || ${pi.requete}, '')`),
  ]);
  const libelle = (l: LigneVeille) => ({ ...l, libelle: TYPES_SOURCE[l.libelle as TypeSource] ?? l.libelle });
  const actives = (l: LigneVeille) => l.trouvees + l.converties + l.ca > 0;
  const tri = (a: LigneVeille, b: LigneVeille) => b.converties - a.converties || b.retenues - a.retenues || b.trouvees - a.trouvees;
  const sources = parSource.map(libelle).filter(actives).sort(tri);
  const total = sources.reduce<LigneVeille>((t, l) => ({ ...t, trouvees: t.trouvees + l.trouvees, retenues: t.retenues + l.retenues, contactees: t.contactees + l.contactees, converties: t.converties + l.converties, ca: t.ca + l.ca }), { cle: 'total', libelle: 'Total', trouvees: 0, retenues: 0, contactees: 0, converties: 0, ca: 0 });
  return { total, parSource: sources, parRequete: parRequete.map(libelle).filter(actives).sort(tri) };
}
type SQLFragment = ReturnType<typeof sql>;

/**
 * RG-12 : requêtes de sources actives sans aucune piste retenue sur les 30 derniers jours (la
 * source doit exister depuis 30 jours) → à désactiver.
 */
export async function requetesImproductives(maintenant = new Date()): Promise<{ sourceId: number; source: string; requete: string }[]> {
  const depuis = new Date(maintenant.getTime() - 30 * JOUR_MS);
  const [sources, productives] = await Promise.all([
    getDb().select().from(schema.sourceVeille).where(and(sql`${schema.sourceVeille.actif}`, lt(schema.sourceVeille.creeLe, depuis))),
    getDb()
      .selectDistinct({ sourceId: schema.piste.sourceId, requete: schema.piste.requete })
      .from(schema.piste)
      .where(and(gte(schema.piste.creeLe, depuis), sql`${schema.piste.statut}::text in ${sql.raw(RETENUES)}`)),
  ]);
  const cle = (id: number | null, r: string | null) => `${id}:${(r ?? '').toLowerCase()}`;
  const vues = new Set(productives.map((x) => cle(x.sourceId, x.requete)));
  return sources.flatMap((s) => s.requetes.filter((r) => motsRequete(r).length && !vues.has(cle(s.id, r))).map((r) => ({ sourceId: s.id, source: s.nom, requete: r })));
}
