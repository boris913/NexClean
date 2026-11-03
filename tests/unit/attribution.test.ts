// Règles pures de MVP1-05 : heures ouvrées, choix du référent, absences, variables des modèles.
import { describe, expect, it } from 'vitest';
import { HEURES_OUVREES_PAR_DEFAUT as H } from '@/lib/parametres';
import { ajouterHeuresOuvrees, dateLocale, estApresHuitHeuresUnJourOuvre, prochaineEscalade, prochainHuitHeuresOuvre } from '@/lib/dossiers/heures-ouvrees';
import { choisirReferent, estAbsent, type Candidat } from '@/lib/dossiers/attribution';
import { rendreMessage, variableInconnue, variablesDe } from '@/lib/modeles/variables';
import { bornesPeriode } from '@/lib/dossiers/compteurs';

/** Heure de Douala (UTC+1) → instant. */
const douala = (s: string) => new Date(`${s}+01:00`);

describe('Heures ouvrées (RG-06, RG-07)', () => {
  it('vendredi 17 h + 4 h ouvrées = samedi 10 h (2 h vendredi + 2 h samedi), pas pendant la nuit', () => {
    // 2026-11-06 est un vendredi.
    expect(ajouterHeuresOuvrees(douala('2026-11-06T17:00:00'), 4, H)).toEqual(douala('2026-11-07T10:00:00'));
  });
  it('samedi 16 h + 4 h → lundi 10 h (dimanche non ouvré)', () => {
    expect(ajouterHeuresOuvrees(douala('2026-11-07T16:00:00'), 4, H)).toEqual(douala('2026-11-09T10:00:00'));
  });
  it('avant l’ouverture : mardi 5 h + 4 h → mardi 11 h', () => {
    expect(ajouterHeuresOuvrees(douala('2026-11-10T05:00:00'), 4, H)).toEqual(douala('2026-11-10T11:00:00'));
  });
  it('dimanche 12 h + 1 h → lundi 8 h', () => {
    expect(ajouterHeuresOuvrees(douala('2026-11-08T12:00:00'), 1, H)).toEqual(douala('2026-11-09T08:00:00'));
  });
  it('relances suivantes : chaque jour ouvré à 8 h (samedi 10 h → lundi 8 h)', () => {
    expect(prochainHuitHeuresOuvre(douala('2026-11-07T10:00:00'), H)).toEqual(douala('2026-11-09T08:00:00'));
    expect(prochainHuitHeuresOuvre(douala('2026-11-09T07:59:00'), H)).toEqual(douala('2026-11-09T08:00:00'));
    expect(prochaineEscalade(douala('2026-11-06T17:00:00'), null, 4, H)).toEqual(douala('2026-11-07T10:00:00'));
    expect(prochaineEscalade(douala('2026-11-06T17:00:00'), douala('2026-11-07T10:00:00'), 4, H)).toEqual(douala('2026-11-09T08:00:00'));
  });
  it('envois quotidiens : jour ouvré, à partir de 8 h', () => {
    expect(estApresHuitHeuresUnJourOuvre(douala('2026-11-09T08:00:00'), H)).toBe(true);
    expect(estApresHuitHeuresUnJourOuvre(douala('2026-11-09T07:59:00'), H)).toBe(false);
    expect(estApresHuitHeuresUnJourOuvre(douala('2026-11-08T10:00:00'), H)).toBe(false);
  });
  it('date locale : 23 h 30 UTC = lendemain à Douala', () => {
    expect(dateLocale(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
  });
});

const cand = (id: string, charge: number, x: Partial<Candidat> = {}): Candidat => ({ id, nom: id, charge, capacite: null, derniereAttributionLe: null, raisons: [], ...x });

describe('Choix du référent (RG-03)', () => {
  it('continuité si le référent précédent est éligible', () => {
    expect(choisirReferent([cand('awa', 9), cand('ben', 0)], 'awa')).toEqual({ id: 'awa', regle: 'continuité' });
  });
  it('continuité ignorée si le référent précédent n’est pas éligible', () => {
    expect(choisirReferent([cand('awa', 0, { raisons: ['absent'] }), cand('ben', 5)], 'awa')).toEqual({ id: 'ben', regle: 'charge minimale' });
  });
  it('charge minimale : 4 dossiers ouverts plutôt que 7', () => {
    expect(choisirReferent([cand('sept', 7), cand('quatre', 4)], null)).toEqual({ id: 'quatre', regle: 'charge minimale' });
  });
  it('tour de rôle : à égalité, la dernière attribution la plus ancienne (jamais = la plus ancienne)', () => {
    expect(choisirReferent([cand('recent', 2, { derniereAttributionLe: new Date('2026-11-02') }), cand('ancien', 2, { derniereAttributionLe: new Date('2026-10-01') })], null)).toEqual({ id: 'ancien', regle: 'tour de rôle' });
    expect(choisirReferent([cand('recent', 2, { derniereAttributionLe: new Date('2026-11-02') }), cand('jamais', 2)], null)).toEqual({ id: 'jamais', regle: 'tour de rôle' });
  });
  it('aucun éligible → null', () => {
    expect(choisirReferent([cand('a', 0, { raisons: ['absent'] })], null)).toBeNull();
    expect(choisirReferent([], null)).toBeNull();
  });
});

describe('Absence (RG-02)', () => {
  it('bornes incluses, période ouverte d’un côté', () => {
    expect(estAbsent('2026-11-01', '2026-11-05', '2026-11-05')).toBe(true);
    expect(estAbsent('2026-11-01', '2026-11-05', '2026-11-06')).toBe(false);
    expect(estAbsent(null, null, '2026-11-06')).toBe(false);
    expect(estAbsent('2026-11-01', null, '2026-12-01')).toBe(true);
  });
});

describe('Variables des modèles (RG-15)', () => {
  it('variable inconnue détectée : {{dossier.montant}}', () => {
    expect(variableInconnue('Montant : {{dossier.montant}}')).toBe('dossier.montant');
    expect(variableInconnue('Bonjour {{ client.contact }}, n° {{dossier.numero}}')).toBeNull();
  });
  it('rendu : variables remplacées, absentes = vide', () => {
    expect(rendreMessage('Bonjour {{client.contact}} ({{referent.telephone}})', { 'client.contact': 'Mme Essomba' })).toBe('Bonjour Mme Essomba ()');
    expect(variablesDe('{{a}} {{b.c}}')).toEqual(['a', 'b.c']);
  });
});

describe('Périodes du tableau de bord (RG-18)', () => {
  it('mois précédent en janvier = décembre de l’année d’avant, heure de Douala', () => {
    const { du, au } = bornesPeriode('mois_prec', douala('2027-01-15T12:00:00'));
    expect(du).toEqual(douala('2026-12-01T00:00:00'));
    expect(au).toEqual(douala('2027-01-01T00:00:00'));
  });
  it('7 jours = aujourd’hui et les 6 jours précédents', () => {
    const { du, au } = bornesPeriode('7j', douala('2026-11-09T00:30:00'));
    expect(du).toEqual(douala('2026-11-03T00:00:00'));
    expect(au).toEqual(douala('2026-11-10T00:00:00'));
  });
});
