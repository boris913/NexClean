// Indicateurs commerciaux (specs/COM1-02 RG-06, RG-07) — module pur.
// La requête (lib/commercial/service.ts) produit une ligne par Dossier concerné par la période,
// avec ses faits datés ; ce module agrège, ventile et construit l'entonnoir.
import { SOURCES, type Source } from '@/lib/acquisition/source';
import { DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { phaseDe, type Statut } from '@/lib/dossiers/statuts';

const HEURE_MS = 60 * 60 * 1000;
/** RG-06 : « Sans réponse > 24 h ». */
export const SEUIL_SANS_REPONSE_MS = 24 * HEURE_MS;

export interface LigneDossierCommercial {
  id: number;
  numero: string;
  client: string;
  type: DossierType;
  statut: Statut;
  ville: string | null;
  source: Source;
  referentId: string | null;
  referentNom: string | null;
  creeLe: Date;
  /** Première action humaine après la création (note, transition, message, rendez-vous…). */
  premiereReponseLe: Date | null;
  /** Faits survenus pendant la période. */
  devisEnvoyePeriode: boolean;
  accepteePeriode: boolean;
  termineePeriode: boolean;
  facturePeriode: number;
  encaissePeriode: number;
  /** Faits à n'importe quelle date (entonnoir de la cohorte créée sur la période). */
  devisEnvoyeJamais: boolean;
  accepteeJamais: boolean;
  encaisseJamais: boolean;
}

export interface Totaux {
  nouveaux: number;
  enAttente: number;
  sansReponse: number;
  devisEnvoyes: number;
  devisAcceptes: number;
  /** Acceptés / nouveaux prospects, en % entier ; null sans nouveau prospect. */
  tauxTransformation: number | null;
  prestationsRealisees: number;
  facture: number;
  encaisse: number;
  /** Délai moyen création → première réponse (dossiers créés sur la période et ayant reçu une réponse), en minutes. */
  delaiPremiereReponseMin: number | null;
}

export interface EtapeEntonnoir {
  cle: string;
  libelle: string;
  dossiers: number;
  devis: number;
  acceptes: number;
  encaisses: number;
}

export type Dimension = 'source' | 'ville' | 'service' | 'referent';
export const DIMENSIONS: Record<Dimension, string> = { source: 'Source', ville: 'Ville', service: 'Service', referent: 'Référent' };

export interface Ventilation extends Totaux {
  cle: string;
  libelle: string;
}

export interface EnAttente {
  id: number;
  numero: string;
  client: string;
  creeLe: Date;
  ancienneteH: number;
  sansReponse: boolean;
}

const enPhaseAttente = (s: Statut) => ['nouveau', 'qualification'].includes(phaseDe(s));
const pourcent = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

/** Dossier en attente sans action humaine depuis plus de 24 h après sa création. */
export function estSansReponse(l: Pick<LigneDossierCommercial, 'statut' | 'creeLe' | 'premiereReponseLe'>, maintenant: Date): boolean {
  return enPhaseAttente(l.statut) && !l.premiereReponseLe && maintenant.getTime() - l.creeLe.getTime() > SEUIL_SANS_REPONSE_MS;
}

export function totaux(lignes: LigneDossierCommercial[], p: { du: Date; au: Date; maintenant: Date }): Totaux {
  const crees = lignes.filter((l) => l.creeLe >= p.du && l.creeLe < p.au);
  const delais = crees.filter((l) => l.premiereReponseLe).map((l) => l.premiereReponseLe!.getTime() - l.creeLe.getTime());
  const nouveaux = crees.length;
  const devisAcceptes = lignes.filter((l) => l.accepteePeriode).length;
  return {
    nouveaux,
    enAttente: lignes.filter((l) => enPhaseAttente(l.statut)).length,
    sansReponse: lignes.filter((l) => estSansReponse(l, p.maintenant)).length,
    devisEnvoyes: lignes.filter((l) => l.devisEnvoyePeriode).length,
    devisAcceptes,
    tauxTransformation: pourcent(devisAcceptes, nouveaux),
    prestationsRealisees: lignes.filter((l) => l.termineePeriode).length,
    facture: lignes.reduce((s, l) => s + l.facturePeriode, 0),
    encaisse: lignes.reduce((s, l) => s + l.encaissePeriode, 0),
    delaiPremiereReponseMin: delais.length ? Math.round(delais.reduce((s, d) => s + d, 0) / delais.length / 60_000) : null,
  };
}

const cles: Record<Dimension, (l: LigneDossierCommercial) => [string, string]> = {
  source: (l) => [l.source, SOURCES[l.source]],
  ville: (l) => [l.ville ?? '', l.ville ?? 'Non précisée'],
  service: (l) => [l.type, DOSSIER_TYPES[l.type]],
  referent: (l) => [l.referentId ?? '', l.referentNom ?? 'Non attribués'],
};

/** RG-07 : chaque indicateur ventilé selon une dimension, lignes triées par nouveaux prospects puis CA facturé. */
export function ventiler(lignes: LigneDossierCommercial[], dimension: Dimension, p: { du: Date; au: Date; maintenant: Date }): Ventilation[] {
  const groupes = new Map<string, { libelle: string; lignes: LigneDossierCommercial[] }>();
  for (const l of lignes) {
    const [cle, libelle] = cles[dimension](l);
    const g = groupes.get(cle) ?? { libelle, lignes: [] };
    g.lignes.push(l);
    groupes.set(cle, g);
  }
  return [...groupes]
    .map(([cle, g]) => ({ cle, libelle: g.libelle, ...totaux(g.lignes, p) }))
    .filter((v) => v.nouveaux || v.enAttente || v.devisEnvoyes || v.devisAcceptes || v.prestationsRealisees || v.facture || v.encaisse)
    .sort((a, b) => b.nouveaux - a.nouveaux || b.facture - a.facture || a.libelle.localeCompare(b.libelle));
}

/** RG-07 : entonnoir source → Dossier → Devis → Accepté → Encaissé, sur la cohorte créée pendant la période. */
export function entonnoir(lignes: LigneDossierCommercial[], p: { du: Date; au: Date }): { total: EtapeEntonnoir; parSource: EtapeEntonnoir[] } {
  const cohorte = lignes.filter((l) => l.creeLe >= p.du && l.creeLe < p.au);
  const etape = (cle: string, libelle: string, ls: LigneDossierCommercial[]): EtapeEntonnoir => ({
    cle,
    libelle,
    dossiers: ls.length,
    devis: ls.filter((l) => l.devisEnvoyeJamais).length,
    acceptes: ls.filter((l) => l.accepteeJamais).length,
    encaisses: ls.filter((l) => l.encaisseJamais).length,
  });
  const sources = [...new Set(cohorte.map((l) => l.source))];
  return {
    total: etape('total', 'Toutes sources', cohorte),
    parSource: sources.map((s) => etape(s, SOURCES[s], cohorte.filter((l) => l.source === s))).sort((a, b) => b.dossiers - a.dossiers || b.acceptes - a.acceptes),
  };
}

/** RG-06 : demandes en attente, de la plus ancienne à la plus récente. */
export function demandesEnAttente(lignes: LigneDossierCommercial[], maintenant: Date): EnAttente[] {
  return lignes
    .filter((l) => enPhaseAttente(l.statut))
    .map((l) => ({ id: l.id, numero: l.numero, client: l.client, creeLe: l.creeLe, ancienneteH: Math.floor((maintenant.getTime() - l.creeLe.getTime()) / HEURE_MS), sansReponse: estSansReponse(l, maintenant) }))
    .sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime());
}

/** « 45 min », « 3 h 20 », « 2 j 4 h ». */
export function libelleDuree(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `${Math.floor(h / 24)} j${h % 24 ? ` ${h % 24} h` : ''}`;
}

/** Écart en % par rapport à la période précédente (rapport hebdomadaire, RG-10) ; null si non calculable. */
export function ecart(actuel: number, precedent: number): number | null {
  if (precedent === 0) return actuel === 0 ? 0 : null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}

// ─── Export CSV (RG-08) ───────────────────────────────────────

const champCsv = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  // Neutralise les formules (injection CSV) puis échappe les guillemets.
  const sur = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
  return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
};

const dateCsv = (d: Date | null) => (d ? new Date(d.getTime() + HEURE_MS).toISOString().slice(0, 16).replace('T', ' ') : null);

/** Une ligne par Dossier ; séparateur « ; » et BOM UTF-8 pour Excel en français. */
export function versCsv(lignes: LigneDossierCommercial[]): string {
  const entete = ['Dossier', 'Client', 'Service', 'Statut', 'Ville', 'Source', 'Référent', 'Créé le', 'Première réponse', 'Devis envoyé (période)', 'Accepté (période)', 'Prestation réalisée (période)', 'Facturé TTC (période)', 'Encaissé (période)'];
  const oui = (b: boolean) => (b ? 'oui' : 'non');
  const corps = lignes.map((l) =>
    [l.numero, l.client, DOSSIER_TYPES[l.type], l.statut, l.ville, SOURCES[l.source], l.referentNom, dateCsv(l.creeLe), dateCsv(l.premiereReponseLe), oui(l.devisEnvoyePeriode), oui(l.accepteePeriode), oui(l.termineePeriode), l.facturePeriode, l.encaissePeriode].map(champCsv).join(';'),
  );
  return '﻿' + [entete.join(';'), ...corps].join('\r\n') + '\r\n';
}
