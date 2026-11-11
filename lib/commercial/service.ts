// Tableau de bord commercial (specs/COM1-02 RG-05..08) : lecture SQL des faits par Dossier.
// Définitions (ADR 0007, 0020) : un prospect est un Dossier en phase Nouveau / En qualification ;
// « devis envoyé », « accepté » et « prestation réalisée » sont des transitions du Dossier datées
// dans l'historique (valables pour le circuit devis du recrutement comme pour le mode transitoire) ;
// facturé = factures émises moins avoirs ; encaissé = écritures d'encaissement (annulations et
// remboursements déduits) à leur date de réception.
import { and, eq, gte, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { peut } from '@/lib/authz/permissions';
import type { Demandeur } from '@/lib/dossiers/acces';
import { dateLocale } from '@/lib/dossiers/heures-ouvrees';
import { STATUT_CODES, phaseDe, type Statut } from '@/lib/dossiers/statuts';
import type { Source } from '@/lib/acquisition/source';
import type { DossierType } from '@/lib/domain/referentiels';
import { versCsv, type LigneDossierCommercial } from './indicateurs';

const STATUTS_ATTENTE = STATUT_CODES.filter((s) => ['nouveau', 'qualification'].includes(phaseDe(s)));
const STATUTS_TERMINE = STATUT_CODES.filter((s) => phaseDe(s) === 'termine');
/** Événements qui ne sont pas une réponse humaine au client. */
const EVENEMENTS_NON_REPONSE = ['creation', 'attribution', 'reaffectation', 'rattachement'] as const;

const liste = (valeurs: readonly string[]) => sql.join(valeurs.map((v) => sql`${v}`), sql`, `);
const iso = (d: Date) => sql`${d.toISOString()}::timestamptz`;

/** Le référent ne voit que ses Dossiers (RG-05) ; la Direction voit tout. */
export const voitTout = (a: Demandeur) => a.roles.includes('direction');

export async function lignesCommerciales(p: { du: Date; au: Date }, a: Demandeur): Promise<LigneDossierCommercial[]> {
  if (!peut(a.roles, 'commercial.tableau_de_bord')) return [];
  const d = schema.dossier;
  const ev = schema.evenementDossier;
  const referent = aliasedTable(schema.user, 'referent');
  const [jourDu, jourAu] = [dateLocale(p.du), dateLocale(p.au)];

  const transition = (statuts: readonly Statut[], periode: boolean, entree = false): SQL<boolean> =>
    sql<boolean>`exists (select 1 from ${ev} where ${ev.dossierId} = ${d.id} and ${ev.type} = 'transition' and ${ev.versStatut} in (${liste(statuts)})${
      entree ? sql` and (${ev.deStatut} is null or ${ev.deStatut} not in (${liste(statuts)}))` : sql``
    }${periode ? sql` and ${ev.horodatage} >= ${iso(p.du)} and ${ev.horodatage} < ${iso(p.au)}` : sql``})`;

  const facture = sql<number>`coalesce((select sum(case when ${schema.facture.type} = 'avoir' then -${schema.facture.totalTtc} else ${schema.facture.totalTtc} end) from ${schema.facture} where ${schema.facture.dossierId} = ${d.id} and ${schema.facture.emiseLe} >= ${iso(p.du)} and ${schema.facture.emiseLe} < ${iso(p.au)}), 0)::int`;
  const encaissePeriode = sql<number>`coalesce((select sum(${schema.encaissement.montant}) from ${schema.encaissement} where ${schema.encaissement.dossierId} = ${d.id} and ${schema.encaissement.recuLe} >= ${jourDu}::date and ${schema.encaissement.recuLe} < ${jourAu}::date), 0)::int`;

  const lignes = await getDb()
    .select({
      id: d.id,
      numero: d.numero,
      client: schema.client.nom,
      type: d.type,
      statut: d.statut,
      ville: sql<string | null>`coalesce(${schema.ville.nom}, ${d.villeAutre})`,
      source: sql<Source>`coalesce((select ${schema.demande.source} from ${schema.demande} where ${schema.demande.dossierId} = ${d.id} order by ${schema.demande.id} limit 1), 'inconnue')`,
      referentId: d.referentId,
      referentNom: referent.name,
      creeLe: d.creeLe,
      premiereReponseLe: sql<string | null>`(select min(${ev.horodatage}) from ${ev} where ${ev.dossierId} = ${d.id} and ${ev.auteurId} is not null and ${ev.type} not in (${liste(EVENEMENTS_NON_REPONSE)}))`,
      devisEnvoyePeriode: transition(['devis_envoye'], true),
      accepteePeriode: transition(['accepte'], true),
      termineePeriode: transition(STATUTS_TERMINE, true, true),
      facturePeriode: facture,
      encaissePeriode,
      devisEnvoyeJamais: transition(['devis_envoye'], false),
      accepteeJamais: transition(['accepte'], false),
      encaisseJamais: sql<boolean>`coalesce((select sum(${schema.encaissement.montant}) from ${schema.encaissement} where ${schema.encaissement.dossierId} = ${d.id}), 0) > 0`,
    })
    .from(d)
    .innerJoin(schema.client, eq(schema.client.id, d.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, d.villeId))
    .leftJoin(referent, eq(referent.id, d.referentId))
    .where(
      and(
        voitTout(a) ? undefined : eq(d.referentId, a.id),
        or(
          and(gte(d.creeLe, p.du), lt(d.creeLe, p.au)),
          inArray(d.statut, STATUTS_ATTENTE),
          sql`exists (select 1 from ${ev} where ${ev.dossierId} = ${d.id} and ${ev.type} = 'transition' and ${ev.horodatage} >= ${iso(p.du)} and ${ev.horodatage} < ${iso(p.au)})`,
          sql`exists (select 1 from ${schema.facture} where ${schema.facture.dossierId} = ${d.id} and ${schema.facture.emiseLe} >= ${iso(p.du)} and ${schema.facture.emiseLe} < ${iso(p.au)})`,
          sql`exists (select 1 from ${schema.encaissement} where ${schema.encaissement.dossierId} = ${d.id} and ${schema.encaissement.recuLe} >= ${jourDu}::date and ${schema.encaissement.recuLe} < ${jourAu}::date)`,
        ),
      ),
    )
    .orderBy(d.creeLe);

  return lignes.map((l) => ({
    ...l,
    type: l.type as DossierType,
    premiereReponseLe: l.premiereReponseLe ? new Date(l.premiereReponseLe) : null,
    devisEnvoyePeriode: !!l.devisEnvoyePeriode,
    accepteePeriode: !!l.accepteePeriode,
    termineePeriode: !!l.termineePeriode,
    devisEnvoyeJamais: !!l.devisEnvoyeJamais,
    accepteeJamais: !!l.accepteeJamais,
    encaisseJamais: !!l.encaisseJamais,
    facturePeriode: Number(l.facturePeriode),
    encaissePeriode: Number(l.encaissePeriode),
  }));
}

/** RG-08 : export CSV (permission `export.donnees`), journalisé. */
export async function exporterCsv(p: { du: Date; au: Date }, a: Demandeur & { ip?: string | null }): Promise<string> {
  const lignes = await lignesCommerciales(p, a);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'commercial.export', objetType: 'tableau_commercial', details: { du: p.du.toISOString(), au: p.au.toISOString(), lignes: lignes.length } });
  return versCsv(lignes);
}
