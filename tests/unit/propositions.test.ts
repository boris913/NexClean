// Domaine des Propositions et Placements (specs/MVP2-03), module pur.
import { describe, expect, it } from 'vitest';
import {
  compterPlacementsRetenus,
  compterPlacesLigne,
  dansLaGarantie,
  echeanceRecherche,
  alerteEcheanceDue,
  estActive,
  estTransmise,
  nomAffichable,
  quatreDerniersChiffres,
  texteFiligrane,
  transitionsReferent,
  verifierCloture,
  verifierTransitionProposition,
} from '@/lib/propositions/domaine';

describe('Transitions de Proposition', () => {
  it('RG-04 : « refusée par le candidat » ne peut pas être forcée ni quittée', () => {
    expect(transitionsReferent('refusee_candidat')).toEqual([]);
    expect(verifierTransitionProposition('refusee_candidat', 'proposee')).toMatchObject({ ok: false });
    expect(verifierTransitionProposition('en_attente_accord', 'refusee_candidat')).toMatchObject({ ok: false });
  });

  it('RG-03 : « proposée » et « placée » ne sont jamais des cibles manuelles', () => {
    expect(verifierTransitionProposition('en_attente_accord', 'proposee')).toMatchObject({ ok: false });
    expect(verifierTransitionProposition('retenue', 'placee')).toMatchObject({ ok: false });
  });

  it('RG-12, RG-13 : entretien puis décision ; refus et retrait exigent un motif', () => {
    expect(verifierTransitionProposition('proposee', 'entretien')).toEqual({ ok: true });
    expect(verifierTransitionProposition('entretien', 'retenue')).toEqual({ ok: true });
    expect(verifierTransitionProposition('entretien', 'refusee')).toMatchObject({ ok: false, erreur: 'Indiquez le motif.' });
    expect(verifierTransitionProposition('entretien', 'refusee', 'Pas disponible le week-end')).toEqual({ ok: true });
    expect(verifierTransitionProposition('en_attente_accord', 'retiree', ' ')).toMatchObject({ ok: false });
    expect(verifierTransitionProposition('placee', 'retiree', 'x')).toMatchObject({ ok: false });
  });

  it('RG-05 / RG-07 : propositions actives et transmises', () => {
    expect(estActive('placee')).toBe(true);
    expect(estActive('retiree')).toBe(false);
    expect(estTransmise('en_attente_accord')).toBe(false);
    expect(estTransmise('proposee')).toBe(true);
  });
});

describe('Placements', () => {
  it('RG-18 : 7 confirmés dont 1 rompu et remplacé → 7 retenus', () => {
    const placements = [
      ...Array.from({ length: 6 }, () => ({ statut: 'confirme' as const, remplacement: false })),
      { statut: 'rompu_garantie' as const, remplacement: false },
      { statut: 'confirme' as const, remplacement: true },
      { statut: 'annonce' as const, remplacement: false },
      { statut: 'abandonne' as const, remplacement: false },
    ];
    expect(compterPlacementsRetenus(placements)).toBe(7);
    expect(compterPlacesLigne(placements)).toBe(7);
  });

  it('RG-18 / RG-19 : garantie de 15 jours, bornes incluses', () => {
    const debut = new Date('2026-11-01T00:00:00Z');
    expect(dansLaGarantie(debut, new Date('2026-11-11T00:00:00Z'), 15)).toBe(true);
    expect(dansLaGarantie(debut, new Date('2026-11-16T00:00:00Z'), 15)).toBe(true);
    expect(dansLaGarantie(debut, new Date('2026-11-17T00:00:00Z'), 15)).toBe(false);
  });

  it('RG-20 : échéance et alerte 5 jours avant', () => {
    const e = echeanceRecherche(new Date('2026-11-01T10:00:00Z'), 30);
    expect(e.toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(alerteEcheanceDue(e, new Date('2026-11-25T10:00:00Z'))).toBe(false);
    expect(alerteEcheanceDue(e, new Date('2026-11-26T10:00:00Z'))).toBe(true);
  });

  it('RG-21 : clôture bloquée par un placement annoncé ; motif exigé avant l’échéance', () => {
    const base = { tousPourvus: false, echeance: new Date('2026-12-01'), maintenant: new Date('2026-11-20'), annonces: [] };
    expect(verifierCloture({ ...base, annonces: [{ id: 3, libelle: 'Awa N. — Serveur' }] })).toMatchObject({ ok: false, annonces: [{ id: 3 }] });
    expect(verifierCloture(base)).toMatchObject({ ok: false });
    expect(verifierCloture({ ...base, motif: 'Client satisfait' })).toEqual({ ok: true });
    expect(verifierCloture({ ...base, tousPourvus: true })).toEqual({ ok: true });
    expect(verifierCloture({ ...base, maintenant: new Date('2026-12-02') })).toEqual({ ok: true });
  });
});

describe('Présentation au client', () => {
  it('RG-07 : prénom + initiale, 4 derniers chiffres, filigrane', () => {
    expect(nomAffichable('Awa', 'ngo Bassa')).toBe('Awa N.');
    expect(quatreDerniersChiffres('+237 690 12 34 56')).toBe('3456');
    expect(texteFiligrane('Hôtel du Lac', new Date('2026-11-04T12:00:00Z'))).toBe('Transmis par NEXCLEAN à Hôtel du Lac le 4 novembre 2026');
  });
});
