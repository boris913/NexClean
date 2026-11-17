// Offres publiées (ADR 0013) : vocabulaire, validation et règles pures, sans dépendance serveur.
// L'Offre est une annonce publique distincte de la Ligne de poste : brouillon → publiée → fermée,
// jamais publiée automatiquement, anonyme par défaut (pas de raison sociale du Client).
import { z } from 'zod';

export const CATEGORIES_OFFRE = [
  'Agent de nettoyage',
  "Chef d'équipe",
  'Commercial',
  'Community manager',
  'Agent de caisse',
  'Administratif / RH',
  'Agent espaces verts',
  'Stage / Alternance',
  'Candidature spontanée',
] as const;
export type CategorieOffre = (typeof CATEGORIES_OFFRE)[number];

export const STATUTS_OFFRE_CODES = ['brouillon', 'publiee', 'fermee'] as const;
export type StatutOffre = (typeof STATUTS_OFFRE_CODES)[number];
export const STATUTS_OFFRE: Record<StatutOffre, string> = { brouillon: 'Brouillon', publiee: 'Publiée', fermee: 'Fermée' };

/** ADR 0013 §2 : recrutement interne NEXCLEAN, ou placement (Ligne de poste d'un Dossier REC). */
export const ORIGINES_OFFRE_CODES = ['interne', 'placement'] as const;
export type OrigineOffre = (typeof ORIGINES_OFFRE_CODES)[number];
export const ORIGINES_OFFRE: Record<OrigineOffre, string> = { interne: 'Recrutement interne', placement: 'Placement chez un client' };

export interface Salaire {
  base?: string;
  bonus?: string;
  target?: string;
  note?: string;
  /** true = salaire fixe (pas de prime liée aux objectifs) */
  fixed?: boolean;
}

/**
 * Offre telle que l'affiche le site public (/recrutement, accueil, sitemap, JSON-LD).
 * Forme héritée de `content/jobs-data.ts` : seules les offres publiées (`open`) ou fermées
 * (`closed`) sont exposées, jamais les brouillons.
 */
export interface OffrePublique {
  slug: string;
  title: string;
  category: CategorieOffre;
  location: string;
  contract: string;
  status: 'open' | 'closed';
  description: string;
  requirements: string[];
  intro?: string;
  missions?: string[];
  profile?: string[];
  salary?: Salaire;
  schedule?: string[];
  sector?: string;
  positions?: number;
  /** Date de publication ISO (AAAA-MM-JJ), requise par Google pour le JSON-LD JobPosting. */
  datePosted?: string;
  validThrough?: string;
}

// ─── Validation ───────────────────────────────────────────────

const liste = (max = 30) =>
  z
    .array(z.string().trim().max(500, 'Ligne trop longue (500 caractères au plus)'))
    .max(max)
    .transform((l) => l.filter(Boolean));
const texteFacultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
const dateFacultative = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Date invalide (AAAA-MM-JJ)');

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const schemaOffre = z
  .object({
    slug: z.string().trim().toLowerCase().min(3, 'Adresse trop courte').max(80).regex(SLUG_REGEX, 'Adresse : lettres minuscules, chiffres et tirets uniquement'),
    titre: z.string().trim().min(3, 'Titre trop court').max(150),
    categorie: z.enum(CATEGORIES_OFFRE, 'Catégorie inconnue'),
    origine: z.enum(ORIGINES_OFFRE_CODES),
    lignePosteId: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
    lieu: z.string().trim().min(2, 'Lieu obligatoire').max(150),
    contrat: z.string().trim().min(2, 'Contrat obligatoire').max(80),
    secteur: texteFacultatif(120),
    postes: z.number().int().min(1, 'Au moins 1 poste').max(500),
    description: z.string().trim().min(20, 'Résumé trop court (20 caractères au moins)').max(400, 'Résumé trop long (400 caractères au plus)'),
    exigences: liste(10),
    intro: texteFacultatif(3000),
    missions: liste(),
    profil: liste(),
    horaires: liste(10),
    salaire: z
      .object({
        base: texteFacultatif(80),
        bonus: texteFacultatif(120),
        target: texteFacultatif(80),
        note: texteFacultatif(500),
        fixed: z.boolean().optional().default(false),
      })
      .nullable()
      .optional()
      .transform((s): Salaire | null =>
        s && (s.base || s.bonus || s.target || s.note)
          ? { ...(s.base && { base: s.base }), ...(s.bonus && { bonus: s.bonus }), ...(s.target && { target: s.target }), ...(s.note && { note: s.note }), ...(s.fixed && { fixed: true }) }
          : null,
      ),
    valableJusquau: dateFacultative,
    /** ADR 0013 §4 : le salaire d'une offre de placement n'est publié qu'avec l'accord du Client. */
    accordSalaireClient: z.boolean().optional().default(false),
  })
  .refine((o) => o.origine !== 'placement' || !o.salaire || o.accordSalaireClient, { message: 'Salaire d’une offre de placement : cochez l’accord du client pour le publier, ou retirez-le.', path: ['accordSalaireClient'] })
  .refine((o) => o.origine === 'placement' || o.lignePosteId === null, { message: 'Une offre interne n’est liée à aucune ligne de poste.', path: ['lignePosteId'] });

export type EntreeOffre = z.input<typeof schemaOffre>;
export type DonneesOffre = z.output<typeof schemaOffre>;

// ─── Règles ───────────────────────────────────────────────────

/** Adresse lisible à partir d'un titre : « Agent de caisse (H/F) — 2 postes » → « agent-de-caisse-h-f-2-postes ». */
export function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Transitions manuelles : publier (brouillon ou rouvrir une fermée), fermer, repasser en brouillon tant qu'elle n'a jamais été publiée. */
export function transitionOffrePermise(de: StatutOffre, vers: StatutOffre): boolean {
  if (de === vers) return false;
  if (vers === 'publiee') return true;
  if (vers === 'fermee') return de === 'publiee';
  return false;
}

/** Ce qui manque pour publier : une offre publiée doit être complète pour le candidat et pour Google. */
export function manquesPourPublier(o: Pick<DonneesOffre, 'description' | 'exigences' | 'missions' | 'profil'>): string[] {
  const m: string[] = [];
  if (!o.exigences.length) m.push('au moins une exigence (affichée sur la carte)');
  if (!o.missions.length && !o.profil.length) m.push('les missions ou le profil recherché');
  return m;
}

/**
 * ADR 0013 §3–4 : brouillon pré-rempli depuis une Ligne de poste, anonymisé (aucune raison sociale,
 * description générique par secteur et quartier). Le salaire n'est jamais repris : il n'est publié
 * qu'une fois l'accord du Client coché sur l'offre.
 */
export function brouillonDepuisLigne(l: {
  id: number;
  intitule: string;
  nombre: number;
  missions: string | null;
  competences: string | null;
  experience: string | null;
  typeContrat: string | null;
  horaires: string | null;
  secteur: string | null;
  ville: string | null;
  quartier: string | null;
}): EntreeOffre {
  const lignes = (t: string | null) =>
    (t ?? '')
      .split(/\r?\n|;|•/)
      .map((x) => x.replace(/^[-*\s]+/, '').trim())
      .filter(Boolean);
  const lieu = [l.quartier, l.ville].filter(Boolean).join(', ') || 'Douala';
  const titre = `${l.intitule} (H/F)${l.nombre > 1 ? ` — ${l.nombre} postes` : ''}`;
  const chez = l.secteur ? ` pour un client du secteur ${l.secteur.toLowerCase()}` : ' pour l’un de ses clients';
  return {
    slug: slugifier(`${l.intitule} ${l.quartier ?? l.ville ?? ''}`),
    titre,
    categorie: categorieProbable(l.intitule),
    origine: 'placement',
    lignePosteId: l.id,
    lieu,
    contrat: l.typeContrat?.trim() || 'À préciser',
    secteur: l.secteur,
    postes: l.nombre,
    description: `NEXCLEAN recrute ${l.nombre > 1 ? `${l.nombre} personnes` : 'une personne'} au poste de ${l.intitule.toLowerCase()}${chez} à ${lieu}.`.slice(0, 400),
    exigences: [...lignes(l.competences), ...lignes(l.experience)].slice(0, 5),
    intro: null,
    missions: lignes(l.missions),
    profil: [...lignes(l.competences), ...lignes(l.experience)],
    horaires: lignes(l.horaires),
    salaire: null,
    valableJusquau: null,
    accordSalaireClient: false,
  };
}

/** Catégorie déduite de l'intitulé, modifiable ensuite. */
export function categorieProbable(intitule: string): CategorieOffre {
  const t = intitule.toLowerCase();
  if (/caiss/.test(t)) return 'Agent de caisse';
  if (/jardin|espace.?vert|paysag/.test(t)) return 'Agent espaces verts';
  if (/chef|superviseur|encadr/.test(t)) return "Chef d'équipe";
  if (/commercial|vente|prospect/.test(t)) return 'Commercial';
  if (/community|réseaux sociaux|reseaux sociaux/.test(t)) return 'Community manager';
  if (/stag|altern/.test(t)) return 'Stage / Alternance';
  if (/secr[ée]tai|assistant|administ|rh\b|comptab/.test(t)) return 'Administratif / RH';
  return 'Agent de nettoyage';
}

/** Une Ligne de poste est pourvue quand ses placements confirmés atteignent le nombre de postes (ADR 0013 §5). */
export function lignePourvue(nombre: number, placementsConfirmes: number): boolean {
  return placementsConfirmes >= nombre;
}

/** Vue publique d'une offre en base (null pour un brouillon : jamais exposé). */
export function versPublique(o: {
  slug: string;
  titre: string;
  categorie: string;
  lieu: string;
  contrat: string;
  statut: StatutOffre;
  description: string;
  exigences: string[];
  intro: string | null;
  missions: string[];
  profil: string[];
  horaires: string[];
  salaire: Salaire | null;
  secteur: string | null;
  postes: number;
  publieeLe: string | null;
  valableJusquau: string | null;
}): OffrePublique | null {
  if (o.statut === 'brouillon') return null;
  return {
    slug: o.slug,
    title: o.titre,
    category: o.categorie as CategorieOffre,
    location: o.lieu,
    contract: o.contrat,
    status: o.statut === 'publiee' ? 'open' : 'closed',
    description: o.description,
    requirements: o.exigences,
    ...(o.intro && { intro: o.intro }),
    ...(o.missions.length && { missions: o.missions }),
    ...(o.profil.length && { profile: o.profil }),
    ...(o.horaires.length && { schedule: o.horaires }),
    ...(o.salaire && { salary: o.salaire }),
    ...(o.secteur && { sector: o.secteur }),
    ...(o.postes > 1 && { positions: o.postes }),
    ...(o.publieeLe && { datePosted: o.publieeLe }),
    ...(o.valableJusquau && { validThrough: o.valableJusquau }),
  };
}
