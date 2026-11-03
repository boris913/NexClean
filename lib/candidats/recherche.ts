// Recherche dans le vivier (MVP2-02 RG-14..18) : lecture des filtres depuis l'URL, liens
// pré-filtrés depuis une ligne de poste (RG-16), distance entre quartiers, expérience en années.
// Module pur (sans base de données) : les mêmes règles sont traduites en SQL dans ./vivier.ts.
import { CONTRATS, EXPERIENCES, SECTEURS } from '@/lib/dossiers/formulaire-personnel';
import { STATUTS_CANDIDAT, type StatutCandidat } from './domaine';

export const TAILLE_PAGE_VIVIER = 20;
/** Rayon proposé par défaut depuis un Dossier REC (RG-16), en km. */
export const RAYON_PAR_DEFAUT_KM = 5;
export const RAYONS_KM = [1, 2, 5, 10, 20] as const;
/** Exclus par défaut des recherches (RG-06), filtre désactivable. */
export const STATUTS_EXCLUS_PAR_DEFAUT: StatutCandidat[] = ['place', 'indisponible'];

export const ONGLETS_VIVIER = { file: 'Nouveaux candidats', non_attribues: 'Non attribués', vivier: 'Rechercher' } as const;
export type OngletVivier = keyof typeof ONGLETS_VIVIER;

export const TRIS_VIVIER = { pertinence: 'Pertinence', recent: 'Profil mis à jour récemment', inscription: 'Inscrits récemment' } as const;
export type TriVivier = keyof typeof TRIS_VIVIER;

export interface FiltresVivier {
  /** Plein texte : métiers, compétences, expériences, qualifications (RG-15). */
  q?: string;
  villeId?: number;
  arrondissementId?: number;
  /** Quartier du candidat ; centre du cercle si `rayonKm` est renseigné. */
  quartierId?: number;
  rayonKm?: number;
  /** Rayon : inclure quand même les candidats de quartiers sans centroïde (cas limite). */
  inclureNonGeolocalises: boolean;
  /** Lieu de travail (quartier) que les zones acceptées du candidat doivent couvrir. */
  zoneQuartierId?: number;
  metier?: string;
  secteur?: string;
  /** Années d'expérience minimales (somme des durées des expériences). */
  experienceMin?: number;
  competences: string[];
  contrat?: string;
  disponibleImmediatement: boolean;
  /** Disponible au plus tard à cette date (AAAA-MM-JJ). */
  disponibleAvant?: string;
  /** Prétentions salariales (minimum demandé) inférieures ou égales à ce montant, en FCFA. */
  pretentionMax?: number;
  statut?: StatutCandidat;
  inscritDu?: string;
  inscritAu?: string;
  profilComplet: boolean;
  avecCv: boolean;
  /** Inclure `placé` et `indisponible` (RG-06). */
  inclureInactifs: boolean;
  /**
   * Correspondance souple : les critères de profil (métier, contrat, expérience, compétences,
   * secteur, disponibilité, prétentions) ne sont plus éliminatoires ; au moins un doit être
   * satisfait et le tri par pertinence les compte (RG-16). Les critères de lieu restent stricts.
   */
  souple: boolean;
  tri: TriVivier;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const texte = (v: string | string[] | undefined, max = 100): string | undefined => {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, max) : undefined;
};
const entier = (v: string | string[] | undefined, max = 1_000_000_000): number | undefined => {
  const s = texte(v);
  if (!s) return undefined;
  const n = Number(s.replace(/[\s .]/g, ''));
  return Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
};
const dateIso = (v: string | string[] | undefined): string | undefined => {
  const s = texte(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined;
};
const coche = (v: string | string[] | undefined) => texte(v) === '1';

/** Lit les filtres de l'URL (searchParams) ; toute valeur invalide est ignorée. */
export function lireFiltres(p: Params): FiltresVivier {
  const statut = texte(p.statut);
  const secteur = texte(p.secteur);
  const contrat = texte(p.contrat);
  const tri = texte(p.tri);
  const rayon = entier(p.rayon, 100);
  return {
    q: texte(p.q),
    villeId: entier(p.ville),
    arrondissementId: entier(p.arrondissement),
    quartierId: entier(p.quartier),
    rayonKm: rayon,
    inclureNonGeolocalises: coche(p.nongeo),
    zoneQuartierId: entier(p.zone),
    metier: texte(p.metier, 80),
    secteur: secteur && (SECTEURS as readonly string[]).includes(secteur) ? secteur : undefined,
    experienceMin: entier(p.exp, 50),
    competences: (texte(p.competences, 300) ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 10),
    contrat: contrat && (CONTRATS as readonly string[]).includes(contrat) ? contrat : undefined,
    disponibleImmediatement: texte(p.dispo) === 'immediate',
    disponibleAvant: dateIso(p.dispoAvant),
    pretentionMax: entier(p.pretention, 100_000_000),
    statut: statut && statut in STATUTS_CANDIDAT ? (statut as StatutCandidat) : undefined,
    inscritDu: dateIso(p.du),
    inscritAu: dateIso(p.au),
    profilComplet: coche(p.complet),
    avecCv: coche(p.cv),
    inclureInactifs: coche(p.inactifs),
    souple: coche(p.souple),
    tri: tri && tri in TRIS_VIVIER ? (tri as TriVivier) : 'recent',
    page: entier(p.page, 10_000) ?? 1,
  };
}

/** Paramètres d'URL correspondant aux filtres (sans la page) : liens de pagination, retour. */
export function parametresFiltres(f: FiltresVivier): Record<string, string> {
  const r: Record<string, string> = {};
  const mettre = (cle: string, v: string | number | boolean | undefined) => {
    if (v === undefined || v === false || v === '') return;
    r[cle] = v === true ? '1' : String(v);
  };
  mettre('q', f.q);
  mettre('ville', f.villeId);
  mettre('arrondissement', f.arrondissementId);
  mettre('quartier', f.quartierId);
  mettre('rayon', f.rayonKm);
  mettre('nongeo', f.inclureNonGeolocalises);
  mettre('zone', f.zoneQuartierId);
  mettre('metier', f.metier);
  mettre('secteur', f.secteur);
  mettre('exp', f.experienceMin);
  mettre('competences', f.competences.join(', '));
  mettre('contrat', f.contrat);
  if (f.disponibleImmediatement) r.dispo = 'immediate';
  mettre('dispoAvant', f.disponibleAvant);
  mettre('pretention', f.pretentionMax);
  mettre('statut', f.statut);
  mettre('du', f.inscritDu);
  mettre('au', f.inscritAu);
  mettre('complet', f.profilComplet);
  mettre('cv', f.avecCv);
  mettre('inactifs', f.inclureInactifs);
  mettre('souple', f.souple);
  if (f.tri !== 'recent') r.tri = f.tri;
  return r;
}

/** Statuts exclus par la recherche : `placé` et `indisponible` sauf case cochée ou statut demandé. */
export function statutsExclus(f: Pick<FiltresVivier, 'inclureInactifs' | 'statut'>): StatutCandidat[] {
  return f.inclureInactifs || f.statut ? [] : STATUTS_EXCLUS_PAR_DEFAUT;
}

// ─── Lieux (RG-14 rayon, ADR 0021 §4) ─────────────────────────

export interface Point {
  latitude: number;
  longitude: number;
}

const RAYON_TERRE_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau (haversine), en km. Même formule qu'en SQL (./vivier.ts). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ZonesCandidat {
  villeId: number | null;
  zonesTouteVille: boolean;
  zonesArrondissementIds: number[];
  zonesQuartierIds: number[];
}

/** Les zones de travail acceptées couvrent-elles ce quartier ? « Toute la ville » couvre tout lieu de la ville. */
export function zonesCouvrent(z: ZonesCandidat, lieu: { villeId: number; arrondissementId: number | null; quartierId: number }): boolean {
  if (z.zonesTouteVille && z.villeId === lieu.villeId) return true;
  if (z.zonesQuartierIds.includes(lieu.quartierId)) return true;
  return lieu.arrondissementId !== null && z.zonesArrondissementIds.includes(lieu.arrondissementId);
}

// ─── Expérience ───────────────────────────────────────────────

/**
 * Années d'une durée saisie librement (« 2 ans », « 18 mois », « 1 an et 6 mois », « 3 »).
 * Règle reprise en SQL dans ./vivier.ts : nombre devant « an », plus nombre devant « mois » / 12,
 * ou nombre seul = années. Tranches : « moins de… » → 0, « 1 à 3 ans » → 1. Illisible → 0.
 */
export function anneesDepuisDuree(duree: string | null | undefined): number {
  if (!duree) return 0;
  const d = duree.toLowerCase();
  // Tranches du formulaire court de candidature (MVP2-02) : borne basse.
  if (/^\s*moins/.test(d)) return 0;
  const tranche = /([0-9]+)\s*(?:à|a|-)\s*[0-9]+/.exec(d);
  if (tranche) return Number(tranche[1]);
  const an = /([0-9]+)\s*an/.exec(d);
  const mois = /([0-9]+)\s*mois/.exec(d);
  const seul = /^\s*([0-9]+)\s*$/.exec(d);
  return (an ? Number(an[1]) : 0) + (mois ? Number(mois[1]) / 12 : 0) + (seul ? Number(seul[1]) : 0);
}

/** Expérience minimale (années) d'une ligne de poste (« 1 à 3 ans » → 1) ; undefined si débutant accepté. */
export function experienceMinimale(libelle: string | null | undefined): number | undefined {
  if (!libelle) return undefined;
  const connu: Record<(typeof EXPERIENCES)[number], number> = { 'Débutant accepté': 0, 'Moins d’1 an': 0, '1 à 3 ans': 1, '3 à 5 ans': 3, 'Plus de 5 ans': 5 };
  const n = libelle in connu ? connu[libelle as keyof typeof connu] : Number(/([0-9]+)/.exec(libelle)?.[1] ?? 0);
  return n > 0 ? n : undefined;
}

// ─── Texte (RG-15) ────────────────────────────────────────────

/**
 * Correspondance caractère à caractère, utilisée telle quelle par `translate()` en SQL. Les
 * majuscules accentuées y figurent aussi : `lower()` ne les convertit pas sous une collation « C ».
 */
export const ACCENTS = 'àáâãäåāèéêëēìíîïòóôõöùúûüçñÿ’ÀÁÂÃÄÅĀÈÉÊËĒÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑŸ';
export const SANS_ACCENTS = "aaaaaaaeeeeeiiiiooooouuuucny'aaaaaaaeeeeeiiiiooooouuuucny";

/** Minuscules sans accents : même normalisation que `translate(lower(…))` en SQL. */
export function normaliserTexte(s: string): string {
  let r = '';
  for (const ch of s.toLowerCase()) {
    const i = ACCENTS.indexOf(ch);
    r += i >= 0 ? SANS_ACCENTS[i] : ch;
  }
  return r;
}

/** Mots de la recherche plein texte (chacun doit être trouvé), normalisés, au plus 8. */
export function motsRecherche(q: string | undefined): string[] {
  return [...new Set(normaliserTexte(q ?? '').split(/[\s,;]+/).filter((m) => m.length >= 2))].slice(0, 8);
}

/** Échappe `%`, `_` et `\` pour un motif LIKE. */
export const echapperLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ─── Lien « Trouver des candidats » (RG-16) ───────────────────

export interface LignePourRecherche {
  intitule: string;
  typeContrat: string | null;
  experience: string | null;
}

export interface LieuPourRecherche {
  villeId: number | null;
  quartierId: number | null;
  /** Le quartier du lieu d'affectation a un centroïde : rayon par défaut. */
  quartierGeolocalise: boolean;
}

/**
 * Recherche pré-filtrée depuis une ligne de poste : ville et quartier du lieu d'affectation
 * (rayon 5 km si centroïde, sinon le quartier lui-même), métier = intitulé, contrat, expérience
 * minimale ; tri par pertinence en correspondance souple. Les filtres restent modifiables.
 */
export function lienTrouverCandidats(l: LignePourRecherche, lieu: LieuPourRecherche): string {
  const p: Record<string, string> = { onglet: 'vivier' };
  if (lieu.villeId) p.ville = String(lieu.villeId);
  if (lieu.quartierId) {
    p.quartier = String(lieu.quartierId);
    if (lieu.quartierGeolocalise) p.rayon = String(RAYON_PAR_DEFAUT_KM);
  }
  const metier = l.intitule.trim();
  if (metier) p.metier = metier.slice(0, 80);
  if (l.typeContrat && (CONTRATS as readonly string[]).includes(l.typeContrat)) p.contrat = l.typeContrat;
  const exp = experienceMinimale(l.experience);
  if (exp) p.exp = String(exp);
  p.souple = '1';
  p.tri = 'pertinence';
  return `/admin/candidats?${new URLSearchParams(p)}`;
}

/** Nombre de critères de profil saisis (ceux que la pertinence compte). */
export function criteresProfil(f: FiltresVivier): number {
  return [f.metier, f.contrat, f.experienceMin, f.secteur, f.pretentionMax, f.disponibleImmediatement || f.disponibleAvant || undefined, ...f.competences].filter(Boolean).length;
}
