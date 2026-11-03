// Tableau de bord minimal (MVP1-05 RG-18, RG-19) : compteurs basés sur les phases (ADR 0007).
import { and, eq, gte, inArray, lt, notInArray, or } from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { lireParametre } from '@/lib/parametres';
import type { DossierType } from '@/lib/domain/referentiels';
import { dateLocale } from './heures-ouvrees';
import { STATUTS_FINAUX, phaseDe, type Phase, type Statut } from './statuts';
import { STATUTS_OUVERTS } from './attribution';

export const PERIODES = { jour: 'Aujourd’hui', '7j': '7 derniers jours', mois: 'Mois en cours', mois_prec: 'Mois précédent' } as const;
export type Periode = keyof typeof PERIODES;

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;
/** Minuit à Douala (UTC+1) d'une date locale AAAA-MM-JJ. */
const minuit = (jour: string) => new Date(new Date(`${jour}T00:00:00Z`).getTime() - HEURE_MS);

/** Bornes [du, au[ de la période, en heure de Douala. */
export function bornesPeriode(p: Periode, maintenant = new Date()): { du: Date; au: Date } {
  const jour = dateLocale(maintenant);
  const debutJour = minuit(jour);
  const [a, m] = jour.split('-').map(Number) as [number, number];
  const debutMois = (an: number, mois: number) => minuit(`${an}-${String(mois).padStart(2, '0')}-01`);
  switch (p) {
    case 'jour':
      return { du: debutJour, au: new Date(debutJour.getTime() + JOUR_MS) };
    case '7j':
      return { du: new Date(debutJour.getTime() - 6 * JOUR_MS), au: new Date(debutJour.getTime() + JOUR_MS) };
    case 'mois':
      return { du: debutMois(a, m), au: m === 12 ? debutMois(a + 1, 1) : debutMois(a, m + 1) };
    case 'mois_prec':
      return { du: m === 1 ? debutMois(a - 1, 12) : debutMois(a, m - 1), au: debutMois(a, m) };
  }
}

export interface LigneCompteur {
  cle: string;
  libelle: string;
  ouverts: number;
  crees: number;
}

function agreger<T>(lignes: T[], cle: (l: T) => string, libelle: (l: T) => string, estOuvert: (l: T) => boolean, estCree: (l: T) => boolean): LigneCompteur[] {
  const m = new Map<string, LigneCompteur>();
  for (const l of lignes) {
    const k = cle(l);
    const x = m.get(k) ?? { cle: k, libelle: libelle(l), ouverts: 0, crees: 0 };
    if (estOuvert(l)) x.ouverts++;
    if (estCree(l)) x.crees++;
    m.set(k, x);
  }
  return [...m.values()].filter((x) => x.ouverts || x.crees);
}

export async function compteursReferent(userId: string, maintenant = new Date()) {
  const jours = await lireParametre('jours_sans_action');
  const lignes = await getDb()
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, statut: schema.dossier.statut, derniereActionLe: schema.dossier.derniereActionLe, client: schema.client.nom })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .where(and(eq(schema.dossier.referentId, userId), notInArray(schema.dossier.statut, [...STATUTS_FINAUX])));
  const parStatut = new Map<Statut, number>();
  for (const l of lignes) if (STATUTS_OUVERTS.includes(l.statut)) parStatut.set(l.statut, (parStatut.get(l.statut) ?? 0) + 1);
  const limite = maintenant.getTime() - jours * JOUR_MS;
  return { jours, parStatut: [...parStatut], sansAction: lignes.filter((l) => l.derniereActionLe.getTime() < limite).sort((a, b) => a.derniereActionLe.getTime() - b.derniereActionLe.getTime()) };
}

export async function compteursDirection(p: Periode, maintenant = new Date()) {
  const { du, au } = bornesPeriode(p, maintenant);
  const jours = await lireParametre('jours_sans_action');
  const referent = aliasedTable(schema.user, 'referent');
  const lignes = await getDb()
    .select({ id: schema.dossier.id, type: schema.dossier.type, statut: schema.dossier.statut, villeNom: schema.ville.nom, villeAutre: schema.dossier.villeAutre, referentId: schema.dossier.referentId, referentNom: referent.name, creeLe: schema.dossier.creeLe, derniereActionLe: schema.dossier.derniereActionLe })
    .from(schema.dossier)
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .leftJoin(referent, eq(referent.id, schema.dossier.referentId))
    .where(or(inArray(schema.dossier.statut, STATUTS_OUVERTS), and(gte(schema.dossier.creeLe, du), lt(schema.dossier.creeLe, au))));

  const ouvert = (l: (typeof lignes)[number]) => STATUTS_OUVERTS.includes(l.statut);
  const cree = (l: (typeof lignes)[number]) => l.creeLe >= du && l.creeLe < au;
  const ordrePhases: Phase[] = ['nouveau', 'qualification', 'devis', 'accepte', 'execution', 'termine', 'cloture', 'issue'];
  const limite = maintenant.getTime() - jours * JOUR_MS;
  const parOuverts = (x: LigneCompteur[]) => x.sort((a, b) => b.ouverts - a.ouverts || b.crees - a.crees || a.libelle.localeCompare(b.libelle));

  return {
    du,
    au,
    jours,
    parPhase: agreger(lignes, (l) => phaseDe(l.statut), (l) => phaseDe(l.statut), ouvert, cree).sort((a, b) => ordrePhases.indexOf(a.cle as Phase) - ordrePhases.indexOf(b.cle as Phase)),
    parType: parOuverts(agreger(lignes, (l) => l.type, (l) => l.type as DossierType, ouvert, cree)),
    parVille: parOuverts(agreger(lignes, (l) => l.villeNom ?? `autre:${l.villeAutre ?? ''}`, (l) => l.villeNom ?? (l.villeAutre ? `${l.villeAutre} (hors référentiel)` : 'Non précisée'), ouvert, cree)),
    parReferent: parOuverts(agreger(lignes, (l) => l.referentId ?? 'aucun', (l) => l.referentNom ?? 'Non attribués', ouvert, cree)),
    nonAttribues: lignes.filter((l) => !l.referentId && !STATUTS_FINAUX.includes(l.statut)).length,
    sansAction: lignes.filter((l) => l.referentId && ouvert(l) && l.derniereActionLe.getTime() < limite).length,
  };
}
