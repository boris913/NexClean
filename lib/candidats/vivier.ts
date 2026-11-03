// Lecture du vivier (MVP2-02) : file « Nouveaux candidats » (RG-01, RG-02), file « Non attribués »
// de la Direction (RG-03), recherche multicritère (RG-14..18). L'accès est vérifié par l'appelant
// (exigerAccesVivier) ; les comptes supprimés (`supprimeLe`) ne sont jamais renvoyés.
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/lib/db';
import type { DemandeurVivier } from './acces';
import { ACCENTS, SANS_ACCENTS, TAILLE_PAGE_VIVIER, echapperLike, motsRecherche, normaliserTexte, statutsExclus, type FiltresVivier } from './recherche';

const c = schema.candidat;
const e = schema.candidatExperience;
const d = schema.candidatDocument;
/** Quartier du candidat (centroïde, arrondissement). */
const qc = alias(schema.quartier, 'quartier_candidat');

// ─── Expressions SQL ──────────────────────────────────────────

/** Minuscules sans accents (même table que normaliserTexte, ./recherche.ts) : pas besoin de l'extension unaccent. */
const normaliser = (x: SQL) => sql`translate(lower(${x}), ${ACCENTS}, ${SANS_ACCENTS})`;
const contient = (x: SQL, mot: string) => sql`${normaliser(x)} like ${`%${echapperLike(normaliserTexte(mot))}%`}`;

/** Texte cherché par le plein texte (RG-15) : métiers, compétences, qualifications, expériences. */
const texteCandidat = sql`concat_ws(' ', array_to_string(${c.metiers}, ' '), array_to_string(${c.competences}, ' '), ${c.qualifications},
  (select string_agg(concat_ws(' ', ${e.poste}, ${e.missions}), ' ') from ${e} where ${e.candidatId} = ${c.id}))`;

/** Somme des durées d'expérience en années (règle d'anneesDepuisDuree, ./recherche.ts). */
export const anneesExperience = sql<number>`coalesce((select sum(case
    when lower(${e.duree}) ~ '^[[:space:]]*moins' then 0
    when lower(${e.duree}) ~ '[0-9]+[[:space:]]*(à|a|-)[[:space:]]*[0-9]+' then substring(lower(${e.duree}) from '([0-9]+)[[:space:]]*(?:à|a|-)[[:space:]]*[0-9]+')::numeric
    else coalesce(substring(lower(${e.duree}) from '([0-9]+)[[:space:]]*an')::numeric, 0)
      + coalesce(substring(lower(${e.duree}) from '([0-9]+)[[:space:]]*mois')::numeric, 0) / 12
      + case when ${e.duree} ~ '^[[:space:]]*[0-9]+[[:space:]]*$' then btrim(${e.duree})::numeric else 0 end
  end) from ${e} where ${e.candidatId} = ${c.id}), 0)`.mapWith(Number);

const aUnCv = sql<boolean>`exists (select 1 from ${d} where ${d.candidatId} = ${c.id} and ${d.categorie} = 'cv')`;

/** Profil complet = 100 % de complétude (domaine.ts, completude) et pas un compte léger. */
const profilComplet = sql`(not ${c.compteLeger} and ${aUnCv}
  and exists (select 1 from ${e} where ${e.candidatId} = ${c.id})
  and cardinality(${c.competences}) > 0 and cardinality(${c.secteurs}) > 0 and cardinality(${c.horaires}) > 0
  and ${c.qualifications} is not null and ${c.email} is not null and ${c.repere} is not null and ${c.salaireMin} is not null)`;

/** Distance haversine (km) entre le centroïde du quartier du candidat et un point. */
const distance = (lat: number, lon: number) =>
  sql<number>`(2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(${qc.latitude} - ${lat}::float8) / 2), 2)
    + cos(radians(${lat}::float8)) * cos(radians(${qc.latitude})) * power(sin(radians(${qc.longitude} - ${lon}::float8) / 2), 2)))))`.mapWith(Number);

const geolocalise = and(isNotNull(qc.latitude), isNotNull(qc.longitude))!;

/** Colonnes affichées dans les listes (cartes). */
const colonnes = {
  id: c.id,
  nom: c.nom,
  prenom: c.prenom,
  statut: c.statut,
  metiers: c.metiers,
  villeNom: schema.ville.nom,
  villeAutre: c.villeAutre,
  quartierNom: qc.nom,
  quartierAutre: c.quartierAutre,
  disponibilite: c.disponibilite,
  disponibleLe: c.disponibleLe,
  referentId: c.referentId,
  referentNom: schema.user.name,
  compteLeger: c.compteLeger,
  creeLe: c.creeLe,
  attribueLe: c.attribueLe,
  enFileDepuis: c.enFileDepuis,
  profilMisAJourLe: c.profilMisAJourLe,
  cv: aUnCv,
  experienceAnnees: anneesExperience,
};

/** Requête des listes ; `total` = nombre de lignes avant pagination. */
const selection = (pertinence: SQL<number> = sql<number>`0`.mapWith(Number), distanceKm: SQL<number | null> = sql<number | null>`null::float8`) =>
  getDb()
    .select({ ...colonnes, pertinence, distanceKm, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(c)
    .leftJoin(schema.ville, eq(schema.ville.id, c.villeId))
    .leftJoin(qc, eq(qc.id, c.quartierId))
    .leftJoin(schema.user, eq(schema.user.id, c.referentId));

// ─── Files (RG-01..03) ────────────────────────────────────────

export interface OptionsFile {
  /** Direction : limiter la file à un référent. */
  referentId?: string;
  page?: number;
}

const estDirection = (u: DemandeurVivier) => u.roles.includes('direction');

/**
 * File « Nouveaux candidats » : candidats au statut `nouveau`, les plus anciens d'abord.
 * Référent : les siens ; Direction : toutes les files (ou celle d'un référent).
 */
export async function fileNouveauxCandidats(u: DemandeurVivier, o: OptionsFile = {}) {
  const proprietaire = estDirection(u) ? (o.referentId ? eq(c.referentId, o.referentId) : isNotNull(c.referentId)) : eq(c.referentId, u.id);
  return paginer(and(eq(c.statut, 'nouveau'), isNull(c.supprimeLe), proprietaire)!, [asc(c.creeLe), asc(c.id)], o.page);
}

/** File « Non attribués » (Direction) : candidats sans référent, les plus anciens en file d'abord. */
export async function fileCandidatsNonAttribues(o: { page?: number } = {}) {
  return paginer(and(isNull(c.referentId), isNull(c.supprimeLe))!, [asc(sql`coalesce(${c.enFileDepuis}, ${c.creeLe})`), asc(c.id)], o.page);
}

async function paginer(condition: SQL, tri: SQL[], pageDemandee = 1) {
  const page = Math.max(1, pageDemandee);
  const lignes = await selection()
    .where(condition)
    .orderBy(...tri)
    .limit(TAILLE_PAGE_VIVIER)
    .offset((page - 1) * TAILLE_PAGE_VIVIER);
  const total = lignes[0]?.total ?? (page > 1 ? await compter(condition) : 0);
  return { lignes: lignes.map(({ total: _t, pertinence: _p, distanceKm: _d, ...l }) => l), total, page, suivante: page * TAILLE_PAGE_VIVIER < total };
}

async function compter(condition: SQL): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(c).leftJoin(qc, eq(qc.id, c.quartierId)).where(condition);
  return r?.n ?? 0;
}

/** Encart de l'accueil : taille de la file d'un référent. */
export async function compterNouveauxCandidats(referentId: string): Promise<number> {
  return compter(and(eq(c.statut, 'nouveau'), isNull(c.supprimeLe), eq(c.referentId, referentId))!);
}

/** Taille de la file « Non attribués » (onglet de la Direction). */
export async function compterCandidatsNonAttribues(): Promise<number> {
  return compter(and(isNull(c.referentId), isNull(c.supprimeLe))!);
}

export type LigneCandidat = Awaited<ReturnType<typeof fileNouveauxCandidats>>['lignes'][number];

// ─── Recherche (RG-14..18) ────────────────────────────────────

interface Centre {
  quartierId: number;
  nom: string;
  villeId: number;
  latitude: number | null;
  longitude: number | null;
}

/** Quartier du référentiel (centre du rayon, lieu des zones de travail). */
async function lireQuartier(id: number | undefined) {
  if (!id) return null;
  const [q] = await getDb()
    .select({ quartierId: schema.quartier.id, nom: schema.quartier.nom, villeId: schema.quartier.villeId, arrondissementId: schema.quartier.arrondissementId, latitude: schema.quartier.latitude, longitude: schema.quartier.longitude })
    .from(schema.quartier)
    .where(eq(schema.quartier.id, id));
  return q ?? null;
}

/** Critères de profil : éliminatoires en correspondance stricte, comptés par la pertinence (RG-16). */
function criteresProfil(f: FiltresVivier): SQL[] {
  const r: SQL[] = [];
  if (f.metier) r.push(contient(sql`array_to_string(${c.metiers}, ' | ')`, f.metier));
  if (f.contrat) r.push(sql`${f.contrat} = any(${c.typesContrat})`);
  if (f.experienceMin) r.push(sql`${anneesExperience} >= ${f.experienceMin}::numeric`);
  if (f.secteur) r.push(sql`${f.secteur} = any(${c.secteurs})`);
  // Sans prétention indiquée : non exclu.
  if (f.pretentionMax) r.push(or(isNull(c.salaireMin), lte(c.salaireMin, f.pretentionMax))!);
  if (f.disponibleAvant) r.push(or(eq(c.disponibilite, 'immediate'), and(eq(c.disponibilite, 'a_partir_du'), lte(c.disponibleLe, f.disponibleAvant)))!);
  else if (f.disponibleImmediatement) r.push(eq(c.disponibilite, 'immediate'));
  for (const comp of f.competences) r.push(contient(sql`array_to_string(${c.competences}, ' | ')`, comp));
  return r;
}

type ModeRayon = 'dans' | 'hors_geo' | 'dans_ou_hors_geo';

/** Conditions de la recherche ; `modeRayon` sert au décompte des candidats non géolocalisés. */
function conditions(f: FiltresVivier, centre: Centre | null, zone: Awaited<ReturnType<typeof lireQuartier>>, modeRayon: ModeRayon): SQL {
  const w: SQL[] = [isNull(c.supprimeLe)];
  const exclus = statutsExclus(f);
  if (exclus.length) w.push(notInArray(c.statut, exclus));
  if (f.statut) w.push(eq(c.statut, f.statut));

  // Lieu : toujours strict.
  if (f.villeId) w.push(eq(c.villeId, f.villeId));
  if (f.arrondissementId) w.push(or(eq(c.arrondissementId, f.arrondissementId), eq(qc.arrondissementId, f.arrondissementId))!);
  if (centre && f.rayonKm && centre.latitude !== null && centre.longitude !== null) {
    const dans = and(geolocalise, sql`${distance(centre.latitude, centre.longitude)} <= ${f.rayonKm}::float8`)!;
    // Hors géolocalisation : même ville que le centre, quartier sans centroïde (ou saisi en « Autre »).
    const horsGeo = and(eq(c.villeId, centre.villeId), or(isNull(qc.latitude), isNull(qc.longitude)))!;
    w.push(modeRayon === 'dans' ? dans : modeRayon === 'hors_geo' ? horsGeo : or(dans, horsGeo)!);
  } else if (f.quartierId) {
    w.push(eq(c.quartierId, f.quartierId));
  }
  if (zone) {
    w.push(
      or(
        and(eq(c.zonesTouteVille, true), eq(c.villeId, zone.villeId)),
        sql`${zone.quartierId}::integer = any(${c.zonesQuartierIds})`,
        zone.arrondissementId ? sql`${zone.arrondissementId}::integer = any(${c.zonesArrondissementIds})` : undefined,
      )!,
    );
  }

  for (const mot of motsRecherche(f.q)) w.push(contient(texteCandidat, mot));
  if (f.inscritDu) w.push(gte(c.creeLe, new Date(`${f.inscritDu}T00:00:00+01:00`)));
  if (f.inscritAu) w.push(lt(c.creeLe, new Date(new Date(`${f.inscritAu}T00:00:00+01:00`).getTime() + 86_400_000)));
  if (f.profilComplet) w.push(profilComplet);
  if (f.avecCv) w.push(aUnCv);

  const profil = criteresProfil(f);
  if (profil.length) w.push(f.souple ? or(...profil)! : and(...profil)!);
  return and(...w)!;
}

export interface ResultatRecherche {
  lignes: (LigneCandidat & { pertinence: number; distanceKm: number | null })[];
  total: number;
  page: number;
  suivante: boolean;
  /** Rayon demandé : candidats de la ville du centre dont le quartier n'a pas de centroïde. */
  nonGeolocalises: number;
  /** Rayon demandé mais le quartier choisi n'a pas de centroïde : filtré sur le quartier lui-même. */
  centreSansCentroide: boolean;
  /** Nombre de critères de profil pris en compte par la pertinence. */
  criteres: number;
}

export async function rechercherCandidats(f: FiltresVivier): Promise<ResultatRecherche> {
  const [centre, zone] = await Promise.all([f.rayonKm ? lireQuartier(f.quartierId) : null, lireQuartier(f.zoneQuartierId)]);
  const geo = !!(centre && f.rayonKm && centre.latitude !== null && centre.longitude !== null);
  const profil = criteresProfil(f);
  const pertinence = profil.length ? sql<number>`(${sql.join(profil.map((x) => sql`(case when ${x} then 1 else 0 end)`), sql` + `)})`.mapWith(Number) : sql<number>`0`.mapWith(Number);
  const dist = geo ? distance(centre!.latitude!, centre!.longitude!) : sql<number | null>`null::float8`.mapWith(Number);
  const condition = conditions(f, centre, zone, geo && f.inclureNonGeolocalises ? 'dans_ou_hors_geo' : 'dans');
  const page = Math.max(1, f.page);

  const tri: SQL[] =
    f.tri === 'pertinence'
      ? [desc(pertinence), desc(sql`(${c.disponibilite} = 'immediate')`), desc(c.profilMisAJourLe), desc(c.id)]
      : f.tri === 'inscription'
        ? [desc(c.creeLe), desc(c.id)]
        : [desc(c.profilMisAJourLe), desc(c.id)];
  if (geo && f.tri !== 'pertinence') tri.unshift(sql`${dist} asc nulls last`);

  const [lignes, nonGeolocalises] = await Promise.all([
    selection(pertinence, dist)
      .where(condition)
      .orderBy(...tri)
      .limit(TAILLE_PAGE_VIVIER)
      .offset((page - 1) * TAILLE_PAGE_VIVIER),
    geo && !f.inclureNonGeolocalises ? compter(conditions(f, centre, zone, 'hors_geo')) : Promise.resolve(0),
  ]);
  const total = lignes[0]?.total ?? (page > 1 ? await compter(condition) : 0);
  return {
    lignes: lignes.map(({ total: _t, ...l }) => ({ ...l, distanceKm: geo ? l.distanceKm : null })),
    total,
    page,
    suivante: page * TAILLE_PAGE_VIVIER < total,
    nonGeolocalises,
    centreSansCentroide: !!(f.rayonKm && f.quartierId && !geo),
    criteres: profil.length,
  };
}

// ─── Listes des filtres ───────────────────────────────────────

/** Référents recrutement (filtre de la Direction sur les files). */
export async function referentsRecrutement() {
  return getDb()
    .selectDistinct({ id: schema.user.id, nom: schema.user.name })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, and(eq(schema.collaborateurRole.userId, schema.user.id), eq(schema.collaborateurRole.role, 'referent')))
    .innerJoin(schema.collaborateurService, and(eq(schema.collaborateurService.userId, schema.user.id), eq(schema.collaborateurService.typeDossier, 'REC')))
    .orderBy(asc(schema.user.name));
}

/** Quartiers ayant un centroïde (pour signaler le rayon disponible). */
export async function quartiersGeolocalises(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const r = await getDb()
    .select({ id: schema.quartier.id })
    .from(schema.quartier)
    .where(and(inArray(schema.quartier.id, ids), isNotNull(schema.quartier.latitude), isNotNull(schema.quartier.longitude)));
  return new Set(r.map((x) => x.id));
}
