// Tableau de bord direction (specs/POST-03 RG-08..RG-14) et export comptable (RG-15), calculés en
// SQL selon les définitions uniques de l'ADR 0020 §2. Lecture seule ; l'appelant vérifie la
// permission (`finances.tableau_de_bord`, `export.donnees`), l'export est journalisé ici.
//
// Conventions (vérifiées dans lib/devis/facturation.ts et lib/encaissements/domaine.ts) :
// - une facture (acompte, solde) et un avoir portent des montants **positifs** (HT, TVA, TTC figés) ;
//   l'avoir vient en **déduction** du facturé ; la date d'une facture est `emise_le` ramenée au
//   jour de Douala ;
// - les écritures d'encaissement sont signées : annulations et remboursements sont négatifs. Les
//   écritures `credit` (crédit client) ne sont pas des mouvements d'argent : exclues de l'Encaissé
//   et de la Trésorerie, mais comptées dans ce qu'un Dossier a réglé (impayés).
import { sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { FUSEAU, type DossierType } from '@/lib/domain/referentiels';
import { dateDuJour, type MoyenPaiement } from '@/lib/encaissements/domaine';
import { calculerIndicateurs, joursEntre, marge, tauxMarge, ventilerImpayes, versCsvComptable, type FactureImpayee, type Indicateurs, type LigneComptable, type Periode, type SommesPeriode } from './domaine';

type Lecteur = Pick<ReturnType<typeof getDb>, 'execute'>;

const f = schema.facture;
const e = schema.encaissement;
const dep = schema.depense;
/** Jour d'émission d'une facture dans le fuseau de l'agence. */
const jourFacture = sql`(${f.emiseLe} at time zone ${sql.raw(`'${FUSEAU}'`)})::date`;
const n = (v: unknown) => Number(v ?? 0);

/** RG-09, RG-10, RG-12, RG-13 : sommes de la période. */
export async function sommesPeriode(p: Periode, db: Lecteur = getDb()): Promise<SommesPeriode> {
  const [r] = await db.execute<Record<string, string>>(sql`
    select
      (select coalesce(sum(${f.totalHt}), 0)::bigint from ${f} where ${f.type} <> 'avoir' and ${jourFacture} between ${p.du}::date and ${p.au}::date) as factures_ht,
      (select coalesce(sum(${f.totalTtc}), 0)::bigint from ${f} where ${f.type} <> 'avoir' and ${jourFacture} between ${p.du}::date and ${p.au}::date) as factures_ttc,
      (select coalesce(sum(${f.totalHt}), 0)::bigint from ${f} where ${f.type} = 'avoir' and ${jourFacture} between ${p.du}::date and ${p.au}::date) as avoirs_ht,
      (select coalesce(sum(${f.totalTtc}), 0)::bigint from ${f} where ${f.type} = 'avoir' and ${jourFacture} between ${p.du}::date and ${p.au}::date) as avoirs_ttc,
      (select coalesce(sum(${e.montant}), 0)::bigint from ${e} where ${e.type} <> 'credit' and ${e.recuLe} between ${p.du}::date and ${p.au}::date) as encaisse,
      (select coalesce(sum(${dep.montant}), 0)::bigint from ${dep} where ${dep.annuleeLe} is null and ${dep.depenseLe} between ${p.du}::date and ${p.au}::date) as depenses
  `);
  return { facturesHt: n(r!.factures_ht), facturesTtc: n(r!.factures_ttc), avoirsHt: n(r!.avoirs_ht), avoirsTtc: n(r!.avoirs_ttc), encaisse: n(r!.encaisse), depenses: n(r!.depenses) };
}

/** Dépenses de la période par catégorie (les plus élevées d'abord). */
export async function depensesParCategorie(p: Periode, db: Lecteur = getDb()) {
  const lignes = await db.execute<{ categorie_id: number; libelle: string; montant: string; nombre: string }>(sql`
    select c.id as categorie_id, c.libelle, sum(${dep.montant})::bigint as montant, count(*)::int as nombre
    from ${dep} join ${schema.categorieDepense} c on c.id = ${dep.categorieId}
    where ${dep.annuleeLe} is null and ${dep.depenseLe} between ${p.du}::date and ${p.au}::date
    group by c.id, c.libelle order by sum(${dep.montant}) desc, c.libelle
  `);
  return [...lignes].map((l) => ({ categorieId: Number(l.categorie_id), libelle: l.libelle, montant: n(l.montant), nombre: n(l.nombre) }));
}

/**
 * RG-11 : impayés à la fin de la période (ou à aujourd'hui si la période n'est pas terminée).
 * Par Dossier, ce qui est réglé = encaissements nets (crédit client compris) + avoirs, à cette date ;
 * il couvre d'abord les factures les plus anciennes, si bien que le reste dû est porté par les plus
 * récentes (`restantsParFacture` dans domaine.ts en est la référence). Ancienneté = jours depuis
 * l'émission de la facture.
 */
export async function facturesImpayees(p: Periode, maintenant = new Date(), db: Lecteur = getDb()): Promise<{ arrete: string; factures: FactureImpayee[] }> {
  const aujourdhui = dateDuJour(maintenant);
  const arrete = p.au < aujourdhui ? p.au : aujourdhui;
  const lignes = await db.execute<{ facture_id: number; numero: string; dossier_id: number; numero_dossier: string; client_nom: string; emise_le: string; total_ttc: number; restant: string }>(sql`
    with fac as (
      select ${f.id} as id, ${f.numero} as numero, ${f.dossierId} as dossier_id, ${f.totalTtc} as total_ttc, ${jourFacture} as jour
      from ${f} where ${f.type} <> 'avoir' and ${jourFacture} <= ${arrete}::date
    ),
    regle as (
      select dossier_id, sum(m) as total from (
        select ${e.dossierId} as dossier_id, ${e.montant} as m from ${e} where ${e.recuLe} <= ${arrete}::date
        union all
        select ${f.dossierId}, ${f.totalTtc} from ${f} where ${f.type} = 'avoir' and ${jourFacture} <= ${arrete}::date
      ) x group by dossier_id
    ),
    du as (
      select fac.dossier_id, sum(fac.total_ttc) - coalesce(max(regle.total), 0) as reste
      from fac left join regle on regle.dossier_id = fac.dossier_id group by fac.dossier_id
    ),
    reparti as (
      select fac.*, du.reste,
        coalesce(sum(fac.total_ttc) over (partition by fac.dossier_id order by fac.jour desc, fac.id desc rows between unbounded preceding and 1 preceding), 0) as plus_recentes
      from fac join du on du.dossier_id = fac.dossier_id
      where du.reste > 0
    )
    select r.id as facture_id, r.numero, r.dossier_id, d.numero as numero_dossier, c.nom as client_nom, to_char(r.jour, 'YYYY-MM-DD') as emise_le, r.total_ttc,
      least(r.total_ttc, greatest(0, r.reste - r.plus_recentes))::bigint as restant
    from reparti r
    join ${schema.dossier} d on d.id = r.dossier_id
    join ${schema.client} c on c.id = d.client_id
    where r.reste - r.plus_recentes > 0
    order by r.jour asc, r.id asc
  `);
  const factures = [...lignes].map((l) => ({
    factureId: Number(l.facture_id),
    numero: l.numero,
    dossierId: Number(l.dossier_id),
    numeroDossier: l.numero_dossier,
    clientNom: l.client_nom,
    emiseLe: l.emise_le,
    totalTtc: Number(l.total_ttc),
    restant: n(l.restant),
    ancienneteJours: Math.max(0, joursEntre(l.emise_le, arrete)),
  }));
  return { arrete, factures };
}

export interface MargeLigne {
  factureHt: number;
  depenses: number;
  marge: number;
  /** % de marge, null si rien n'est facturé. */
  taux: number | null;
}

/** RG-14 : marge par Dossier (Facturé HT de la période − dépenses rattachées de la période). */
export async function margesParDossier(p: Periode, limite = 100, db: Lecteur = getDb()) {
  const lignes = await db.execute<{ dossier_id: number; numero: string; type: DossierType; client_nom: string; facture_ht: string; depenses: string }>(sql`
    with fh as (
      select ${f.dossierId} as dossier_id, sum(case when ${f.type} = 'avoir' then -${f.totalHt} else ${f.totalHt} end) as ht
      from ${f} where ${jourFacture} between ${p.du}::date and ${p.au}::date group by ${f.dossierId}
    ),
    dr as (
      select ${dep.dossierId} as dossier_id, sum(${dep.montant}) as montant
      from ${dep} where ${dep.dossierId} is not null and ${dep.annuleeLe} is null and ${dep.depenseLe} between ${p.du}::date and ${p.au}::date group by ${dep.dossierId}
    )
    select d.id as dossier_id, d.numero, d.type, c.nom as client_nom, coalesce(fh.ht, 0)::bigint as facture_ht, coalesce(dr.montant, 0)::bigint as depenses
    from (select dossier_id from fh union select dossier_id from dr) ids
    join ${schema.dossier} d on d.id = ids.dossier_id
    join ${schema.client} c on c.id = d.client_id
    left join fh on fh.dossier_id = d.id
    left join dr on dr.dossier_id = d.id
    order by coalesce(fh.ht, 0) - coalesce(dr.montant, 0) desc, d.numero
    limit ${limite}
  `);
  return [...lignes].map((l) => {
    const factureHt = n(l.facture_ht);
    const depenses = n(l.depenses);
    return { dossierId: Number(l.dossier_id), numero: l.numero, type: l.type, clientNom: l.client_nom, factureHt, depenses, marge: marge(factureHt, depenses), taux: tauxMarge(factureHt, depenses) };
  });
}

/**
 * RG-14 : marge par service (type de Dossier). Facturé HT des Dossiers du service ; dépenses
 * rattachées au service (via leur Dossier, ou directement, RG-04). Les charges générales (sans
 * service) restent au niveau global.
 */
export async function margesParService(p: Periode, db: Lecteur = getDb()) {
  const lignes = await db.execute<{ service: DossierType; facture_ht: string; depenses: string }>(sql`
    with fh as (
      select d.type as service, sum(case when ${f.type} = 'avoir' then -${f.totalHt} else ${f.totalHt} end) as ht
      from ${f} join ${schema.dossier} d on d.id = ${f.dossierId}
      where ${jourFacture} between ${p.du}::date and ${p.au}::date group by d.type
    ),
    dr as (
      select ${dep.service} as service, sum(${dep.montant}) as montant
      from ${dep} where ${dep.service} is not null and ${dep.annuleeLe} is null and ${dep.depenseLe} between ${p.du}::date and ${p.au}::date group by ${dep.service}
    )
    select coalesce(fh.service, dr.service) as service, coalesce(fh.ht, 0)::bigint as facture_ht, coalesce(dr.montant, 0)::bigint as depenses
    from fh full outer join dr on dr.service = fh.service
    order by 1
  `);
  return [...lignes].map((l) => {
    const factureHt = n(l.facture_ht);
    const depenses = n(l.depenses);
    return { service: l.service, factureHt, depenses, marge: marge(factureHt, depenses), taux: tauxMarge(factureHt, depenses) };
  });
}

export interface TableauDirection {
  periode: Periode;
  indicateurs: Indicateurs;
  sommes: SommesPeriode;
  depensesParCategorie: Awaited<ReturnType<typeof depensesParCategorie>>;
  impayes: { arrete: string; factures: FactureImpayee[] } & ReturnType<typeof ventilerImpayes>;
  margesDossiers: Awaited<ReturnType<typeof margesParDossier>>;
  margesServices: Awaited<ReturnType<typeof margesParService>>;
}

/** Toutes les lectures de la page /admin/pilotage. */
export async function tableauDirection(p: Periode, maintenant = new Date(), db: Lecteur = getDb()): Promise<TableauDirection> {
  const [sommes, categories, impayes, margesDossiers, margesServices] = await Promise.all([sommesPeriode(p, db), depensesParCategorie(p, db), facturesImpayees(p, maintenant, db), margesParDossier(p, 100, db), margesParService(p, db)]);
  return { periode: p, sommes, indicateurs: calculerIndicateurs(sommes), depensesParCategorie: categories, impayes: { ...impayes, ...ventilerImpayes(impayes.factures) }, margesDossiers, margesServices };
}

// ─── Export comptable (RG-15) ─────────────────────────────────

/** Factures, avoirs et dépenses non annulées de la période, par date puis pièce. */
export async function lignesComptables(p: Periode, db: Lecteur = getDb()): Promise<LigneComptable[]> {
  const factures = await db.execute<{ type: string; jour: string; numero: string; libelle: string; client: { nom: string; ville: string | null }; dossier: string; service: DossierType; ht: number; tva: number; ttc: number }>(sql`
    select ${f.type} as type, to_char(${jourFacture}, 'YYYY-MM-DD') as jour, ${f.numero} as numero, ${f.libelle} as libelle, ${f.client} as client,
      d.numero as dossier, d.type as service, ${f.totalHt} as ht, ${f.montantTva} as tva, ${f.totalTtc} as ttc
    from ${f} join ${schema.dossier} d on d.id = ${f.dossierId}
    where ${jourFacture} between ${p.du}::date and ${p.au}::date
    order by ${f.emiseLe}, ${f.numero}
  `);
  const depenses = await db.execute<{ id: number; jour: string; libelle: string; categorie: string; dossier: string | null; service: DossierType | null; ville: string | null; moyen: MoyenPaiement; reference: string | null; montant: number; justificatif: boolean }>(sql`
    select ${dep.id} as id, to_char(${dep.depenseLe}, 'YYYY-MM-DD') as jour, ${dep.libelle} as libelle, c.libelle as categorie, d.numero as dossier, ${dep.service} as service,
      v.nom as ville, ${dep.moyen} as moyen, ${dep.reference} as reference, ${dep.montant} as montant, (${dep.justificatifCle} is not null) as justificatif
    from ${dep}
    join ${schema.categorieDepense} c on c.id = ${dep.categorieId}
    left join ${schema.dossier} d on d.id = ${dep.dossierId}
    left join ${schema.ville} v on v.id = ${dep.villeId}
    where ${dep.annuleeLe} is null and ${dep.depenseLe} between ${p.du}::date and ${p.au}::date
    order by ${dep.depenseLe}, ${dep.id}
  `);
  const lignes: LigneComptable[] = [
    ...[...factures].map(
      (l): LigneComptable => ({
        nature: l.type === 'avoir' ? 'avoir' : 'facture',
        date: l.jour,
        piece: l.numero,
        libelle: l.libelle,
        categorie: null,
        tiers: l.client?.nom ?? null,
        dossier: l.dossier,
        service: l.service,
        ville: l.client?.ville ?? null,
        moyen: null,
        reference: null,
        ht: Number(l.ht),
        tva: Number(l.tva),
        ttc: Number(l.ttc),
        justificatif: null,
      }),
    ),
    ...[...depenses].map(
      (l): LigneComptable => ({
        nature: 'depense',
        date: l.jour,
        piece: `DEP-${String(l.id).padStart(5, '0')}`,
        libelle: l.libelle,
        categorie: l.categorie,
        tiers: null,
        dossier: l.dossier,
        service: l.service,
        ville: l.ville,
        moyen: l.moyen,
        reference: l.reference,
        ht: null,
        tva: null,
        ttc: Number(l.montant),
        justificatif: !!l.justificatif,
      }),
    ),
  ];
  // Tri stable par date : les factures d'un même jour restent avant les dépenses.
  return lignes.map((l, i) => ({ l, i })).sort((a, b) => (a.l.date === b.l.date ? a.i - b.i : a.l.date < b.l.date ? -1 : 1)).map((x) => x.l);
}

/** RG-15 : export CSV pour le comptable, journalisé (période, nombre de lignes). */
export async function exporterComptable(p: Periode, a: { id: string; ip?: string | null }, db: Lecteur = getDb()): Promise<string> {
  const lignes = await lignesComptables(p, db);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'finances.export_comptable', objetType: 'export_comptable', details: { du: p.du, au: p.au, lignes: lignes.length } });
  return versCsvComptable(lignes);
}
