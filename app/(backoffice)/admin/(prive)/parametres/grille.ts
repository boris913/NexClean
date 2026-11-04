// Grille tarifaire (specs/MVP2-04 RG-01, RG-02) : lecture de l'historique des paramètres,
// validation des saisies de l'écran Paramètres, mise en forme des valeurs. Indépendant de Next.js.
import { desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { cleCategorie, formaterMontant, mentionTva } from '@/lib/devis/domaine';
import type { CleParametre } from '@/lib/parametres';

/** Paramètres de la grille tarifaire et des documents affichés sur l'écran. */
export const CLES_GRILLE = [
  'commission_par_personne',
  'commissions_par_categorie',
  'tva_taux',
  'acompte_taux_defaut',
  'acompte_bornes',
  'delai_recherche_jours',
  'garantie_jours',
  'validite_devis_jours',
  'mentions_legales',
  'conditions_devis',
  'minimum_facturation',
] as const satisfies readonly CleParametre[];
export type CleGrille = (typeof CLES_GRILLE)[number];

export interface EntreeHistorique {
  id: number;
  valeur: string;
  effetLe: Date;
  auteur: string;
}

const jours = (n: unknown) => (typeof n === 'number' ? `${n} jour${n > 1 ? 's' : ''}` : '—');
const extrait = (t: string, max = 140) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

/** Valeur lisible d'un paramètre de la grille (historique). */
export function formaterValeurParametre(cle: CleParametre, valeur: unknown): string {
  switch (cle) {
    case 'commission_par_personne':
      return typeof valeur === 'number' ? `${formaterMontant(valeur)} HT / personne` : '—';
    case 'commissions_par_categorie': {
      const e = Object.entries((valeur ?? {}) as Record<string, number>);
      return e.length ? e.map(([k, v]) => `${k} : ${formaterMontant(v)}`).join(' · ') : 'Aucune';
    }
    case 'tva_taux':
      return typeof valeur === 'number' ? (valeur > 0 ? `${valeur} %` : `0 % (${mentionTva(0)})`) : '—';
    case 'acompte_taux_defaut':
      return typeof valeur === 'number' ? `${valeur} %` : '—';
    case 'acompte_bornes': {
      const b = valeur as { min?: number; max?: number } | null;
      return b && typeof b.min === 'number' ? `${b.min} % – ${b.max} %` : '—';
    }
    case 'delai_recherche_jours':
    case 'garantie_jours':
    case 'validite_devis_jours':
      return jours(valeur);
    case 'minimum_facturation':
      return typeof valeur === 'number' ? formaterMontant(valeur) : 'Désactivé';
    case 'mentions_legales':
    case 'conditions_devis':
      return typeof valeur === 'string' ? extrait(valeur.replace(/\s*\n\s*/g, ' / ')) : '—';
    default:
      return extrait(JSON.stringify(valeur));
  }
}

/** RG-01 : historique (valeur, date d'effet, auteur), du plus récent au plus ancien, par paramètre. */
export async function historiqueParametres(cles: readonly CleParametre[], parCle = 10): Promise<Partial<Record<CleParametre, EntreeHistorique[]>>> {
  if (!cles.length) return {};
  const lignes = await getDb()
    .select({ id: schema.parametreHistorique.id, cle: schema.parametreHistorique.cle, valeur: schema.parametreHistorique.valeur, effetLe: schema.parametreHistorique.effetLe, auteur: schema.user.name })
    .from(schema.parametreHistorique)
    .leftJoin(schema.user, eq(schema.user.id, schema.parametreHistorique.auteurId))
    .where(inArray(schema.parametreHistorique.cle, [...cles]))
    .orderBy(desc(schema.parametreHistorique.effetLe), desc(schema.parametreHistorique.id));
  const r: Partial<Record<CleParametre, EntreeHistorique[]>> = {};
  for (const l of lignes) {
    const cle = l.cle as CleParametre;
    const liste = (r[cle] ??= []);
    if (liste.length < parCle) liste.push({ id: l.id, valeur: formaterValeurParametre(cle, l.valeur), effetLe: l.effetLe, auteur: l.auteur ?? 'Système' });
  }
  return r;
}

// ─── Validation des saisies ─────────────────────────────────

export interface PaireCategorie {
  intitule: string;
  montant: number | string;
}

/**
 * Commissions par catégorie (RG-01) : paires intitulé / montant → objet. Lignes vides ignorées ;
 * intitulé de 2 à 80 caractères ; montant entier entre 0 et 1 000 000 ; pas deux intitulés
 * équivalents (même clé normalisée, comme pour le calcul du devis).
 */
export function commissionsDepuisPaires(paires: readonly PaireCategorie[]): Record<string, number> {
  if (!Array.isArray(paires)) throw new ErreurMetier('Saisie invalide.');
  if (paires.length > 100) throw new ErreurMetier('100 catégories au plus.');
  const r: Record<string, number> = {};
  const vues = new Map<string, string>();
  for (const p of paires) {
    const intitule = String(p?.intitule ?? '').trim().replace(/\s+/g, ' ');
    const brut = String(p?.montant ?? '').trim().replace(/[\s  ]/g, '');
    if (!intitule && !brut) continue;
    if (intitule.length < 2 || intitule.length > 80) throw new ErreurMetier(`Intitulé de catégorie invalide : « ${intitule || '(vide)'} » (2 à 80 caractères).`);
    const montant = Number(brut);
    if (!brut || !Number.isInteger(montant) || montant < 0 || montant > 1_000_000) throw new ErreurMetier(`Montant invalide pour « ${intitule} » : un nombre entier de FCFA entre 0 et 1 000 000.`);
    const cle = cleCategorie(intitule);
    const deja = vues.get(cle);
    if (deja) throw new ErreurMetier(`« ${intitule} » et « ${deja} » désignent la même catégorie.`);
    vues.set(cle, intitule);
    r[intitule] = montant;
  }
  return r;
}

/** Taux d'acompte par défaut compris dans les bornes (RG-06 : sinon chaque devis partirait en validation Direction). */
export function verifierAcompte(defaut: number, min: number, max: number): { defaut: number; bornes: { min: number; max: number } } {
  for (const [n, libelle] of [
    [defaut, 'Le taux par défaut'],
    [min, 'La borne minimale'],
    [max, 'La borne maximale'],
  ] as const) {
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new ErreurMetier(`${libelle} doit être un pourcentage entier entre 0 et 100.`);
  }
  if (min > max) throw new ErreurMetier('La borne minimale doit être inférieure ou égale à la borne maximale.');
  if (defaut < min || defaut > max) throw new ErreurMetier(`Le taux par défaut (${defaut} %) doit être compris entre les bornes (${min} % – ${max} %).`);
  return { defaut, bornes: { min, max } };
}
