// Règles des rendez-vous (specs/COM1-02 RG-01..03), heure de Douala (UTC+1).
import { describe, expect, it } from 'vitest';
import { bornesAgenda, decalerJour, echeancesRappel, estACloturer, instantDouala, partiesDouala, rappelsDus } from '@/lib/rendezvous/domaine';

const d = (iso: string) => new Date(iso);

describe('heure de Douala', () => {
  it('saisie locale → instant UTC, et retour', () => {
    expect(instantDouala('2026-11-12', '10:00')!.toISOString()).toBe('2026-11-12T09:00:00.000Z');
    expect(partiesDouala(d('2026-11-12T23:30:00Z'))).toEqual({ jour: '2026-11-13', heure: '00:30' });
  });
  it('saisie invalide → null', () => {
    expect(instantDouala('12/11/2026', '10:00')).toBeNull();
    expect(instantDouala('2026-11-12', '10h')).toBeNull();
    expect(instantDouala('2026-13-45', '10:00')).toBeNull();
  });
});

describe('rappels (RG-02)', () => {
  // Rendez-vous demain jeudi 12 novembre à 10 h (Douala), planifié mardi.
  const rdv = { statut: 'prevu' as const, debut: instantDouala('2026-11-12', '10:00')!, planifieLe: d('2026-11-10T08:00:00Z') };

  it('critère d’acceptation : la veille à 18 h et le jour même à 9 h', () => {
    const [veille, h1] = echeancesRappel(rdv.debut);
    expect(partiesDouala(veille!.quand)).toEqual({ jour: '2026-11-11', heure: '18:00' });
    expect(partiesDouala(h1!.quand)).toEqual({ jour: '2026-11-12', heure: '09:00' });
  });

  it('rien avant 18 h la veille, le rappel de la veille ensuite, puis celui d’1 h avant', () => {
    expect(rappelsDus(rdv, instantDouala('2026-11-11', '17:59')!)).toEqual([]);
    expect(rappelsDus(rdv, instantDouala('2026-11-11', '18:00')!)).toEqual(['veille']);
    expect(rappelsDus(rdv, instantDouala('2026-11-12', '07:00')!)).toEqual(['veille']);
    expect(rappelsDus(rdv, instantDouala('2026-11-12', '09:05')!)).toEqual(['h-1']);
    expect(rappelsDus(rdv, instantDouala('2026-11-12', '10:00')!)).toEqual([]);
  });

  it('rendez-vous pris le jour même : pas de rappel « de la veille »', () => {
    const jourMeme = { ...rdv, planifieLe: instantDouala('2026-11-12', '08:00')! };
    expect(rappelsDus(jourMeme, instantDouala('2026-11-12', '08:15')!)).toEqual([]);
    expect(rappelsDus(jourMeme, instantDouala('2026-11-12', '09:00')!)).toEqual(['h-1']);
  });

  it('pris moins d’une heure avant : aucun rappel', () => {
    expect(rappelsDus({ ...rdv, planifieLe: instantDouala('2026-11-12', '09:30')! }, instantDouala('2026-11-12', '09:45')!)).toEqual([]);
  });

  it('annulé : aucun rappel', () => {
    expect(rappelsDus({ ...rdv, statut: 'annule' }, instantDouala('2026-11-11', '18:00')!)).toEqual([]);
  });

  it('rendez-vous à 7 h : rappel la veille à 18 h, puis à 6 h', () => {
    const tot = { ...rdv, debut: instantDouala('2026-11-12', '07:00')! };
    expect(rappelsDus(tot, instantDouala('2026-11-11', '18:00')!)).toEqual(['veille']);
    expect(rappelsDus(tot, instantDouala('2026-11-12', '06:00')!)).toEqual(['h-1']);
  });
});

describe('à clôturer (RG-02)', () => {
  const rdv = { statut: 'prevu' as const, debut: instantDouala('2026-11-12', '10:00')!, dureeMinutes: 60 };
  it('24 h après la fin, toujours prévu', () => {
    expect(estACloturer(rdv, instantDouala('2026-11-13', '10:59')!)).toBe(false);
    expect(estACloturer(rdv, instantDouala('2026-11-13', '11:00')!)).toBe(true);
    expect(estACloturer({ ...rdv, statut: 'fait' }, instantDouala('2026-11-20', '11:00')!)).toBe(false);
  });
});

describe('agenda (RG-03)', () => {
  it('semaine du lundi au dimanche, en heure de Douala', () => {
    const b = bornesAgenda('semaine', '2026-11-12'); // jeudi
    expect(b.jours).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(b.du.toISOString()).toBe('2026-11-08T23:00:00.000Z');
    expect(b.au.toISOString()).toBe('2026-11-15T23:00:00.000Z');
  });
  it('un dimanche appartient à la semaine qui se termine', () => {
    expect(bornesAgenda('semaine', '2026-11-15').jours[0]).toBe('2026-11-09');
  });
  it('vue jour', () => {
    const b = bornesAgenda('jour', '2026-11-12');
    expect(b.jours).toEqual(['2026-11-12']);
    expect([b.du.toISOString(), b.au.toISOString()]).toEqual(['2026-11-11T23:00:00.000Z', '2026-11-12T23:00:00.000Z']);
  });
  it('navigation', () => {
    expect(decalerJour('2026-11-30', 1)).toBe('2026-12-01');
    expect(decalerJour('2026-11-12', -7)).toBe('2026-11-05');
  });
});
