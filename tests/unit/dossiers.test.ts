// specs/MVP1-02 — statuts (RG-12..18), numérotation (RG-01), téléphones (RG-03).
import { describe, expect, it } from 'vitest';
import { estOuvert, MESSAGE_CLOTURE_RECHERCHE, phaseDe, transitionsProposees, verifierTransition, type ContexteTransition } from '@/lib/dossiers/statuts';
import { anneeDouala, formaterNumero } from '@/lib/dossiers/numero';
import { formaterTelephone, normaliserTelephone } from '@/lib/telephone';

const ctx = (c: Partial<ContexteTransition> & Pick<ContexteTransition, 'de' | 'vers'>): ContexteTransition => ({
  type: 'REC',
  direction: false,
  aUnDevisExterne: false,
  aUnJustificatif: false,
  ...c,
});

describe('Transitions (RG-12..18)', () => {
  it('avance d’une étape à la fois', () => {
    expect(verifierTransition(ctx({ de: 'attribuee', vers: 'en_qualification' }))).toEqual({ ok: true, retourArriere: false });
    expect(verifierTransition(ctx({ de: 'attribuee', vers: 'accepte' }))).toMatchObject({ ok: false, erreur: expect.stringContaining('En qualification') });
  });

  it('« Attribuée » n’est fixé que par l’attribution automatique (RG-14)', () => {
    expect(verifierTransition(ctx({ de: 'nouvelle_demande', vers: 'attribuee' }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'nouvelle_demande', vers: 'attribuee', automatique: true }))).toMatchObject({ ok: true });
  });

  it('critère RG-15 : « À compléter » sans commentaire est refusé', () => {
    expect(verifierTransition(ctx({ de: 'en_qualification', vers: 'a_completer' }))).toEqual({ ok: false, erreur: 'Indiquez les informations manquantes.' });
    expect(verifierTransition(ctx({ de: 'en_qualification', vers: 'a_completer', commentaire: 'Horaires manquants' }))).toMatchObject({ ok: true });
  });

  it('« À compléter » ne mène qu’à « En qualification » (ou une issue)', () => {
    expect(verifierTransition(ctx({ de: 'a_completer', vers: 'devis_pret', aUnDevisExterne: true }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'a_completer', vers: 'en_qualification' }))).toMatchObject({ ok: true });
    expect(verifierTransition(ctx({ de: 'a_completer', vers: 'sans_suite', commentaire: 'Client injoignable' }))).toMatchObject({ ok: true });
  });

  it('retour en arrière : commentaire obligatoire', () => {
    expect(verifierTransition(ctx({ de: 'devis_envoye', vers: 'en_qualification' }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'devis_envoye', vers: 'en_qualification', commentaire: 'Besoin revu' }))).toEqual({ ok: true, retourArriere: true });
  });

  it('Refusé / Sans suite : motif obligatoire, depuis tout statut non final', () => {
    expect(verifierTransition(ctx({ de: 'recherche_en_cours', vers: 'refuse' }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'recherche_en_cours', vers: 'refuse', commentaire: 'Client a renoncé' }))).toMatchObject({ ok: true });
  });

  it('critère RG-18 : un Référent ne rouvre pas un dossier clôturé, la Direction oui avec motif', () => {
    expect(verifierTransition(ctx({ de: 'cloture', vers: 'en_qualification', commentaire: 'x' }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'cloture', vers: 'en_qualification', direction: true }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ de: 'cloture', vers: 'en_qualification', direction: true, commentaire: 'Erreur de clôture' }))).toMatchObject({ ok: true });
  });

  describe('gardes transitoires MVP-1 (RG-16)', () => {
    it('« Devis prêt » exige un devis externe joint', () => {
      expect(verifierTransition(ctx({ de: 'en_qualification', vers: 'devis_pret' }))).toMatchObject({ ok: false });
      expect(verifierTransition(ctx({ de: 'en_qualification', vers: 'devis_pret', aUnDevisExterne: true }))).toMatchObject({ ok: true });
    });
    it('critère : « Acompte reçu » sans justificatif est refusé', () => {
      expect(verifierTransition(ctx({ de: 'accepte', vers: 'acompte_recu', commentaire: '25 000 MoMo réf. X' }))).toMatchObject({ ok: false });
      expect(verifierTransition(ctx({ de: 'accepte', vers: 'acompte_recu', aUnJustificatif: true }))).toMatchObject({ ok: false });
      expect(verifierTransition(ctx({ de: 'accepte', vers: 'acompte_recu', aUnJustificatif: true, commentaire: '25 000 MoMo réf. X' }))).toMatchObject({ ok: true });
    });
    it('MVP2-03 RG-22 : « Placements confirmés » passe par la clôture de la recherche, pas par une transition manuelle', () => {
      expect(verifierTransition(ctx({ de: 'candidats_proposes', vers: 'placements_confirmes' }))).toMatchObject({ ok: false, erreur: MESSAGE_CLOTURE_RECHERCHE });
      expect(verifierTransition(ctx({ de: 'candidats_proposes', vers: 'placements_confirmes', commentaire: '7 placés' }))).toMatchObject({ ok: false });
      // Retour en arrière (motif) et réouverture par la Direction restent possibles.
      expect(verifierTransition(ctx({ de: 'solde_recu', vers: 'placements_confirmes', commentaire: 'Erreur de saisie' }))).toMatchObject({ ok: true, retourArriere: true });
      expect(transitionsProposees('REC', 'candidats_proposes', false)).toEqual(['refuse', 'sans_suite']);
    });
  });

  it('les statuts de recherche n’existent pas dans le cycle générique', () => {
    expect(verifierTransition(ctx({ type: 'NET', de: 'acompte_recu', vers: 'recherche_en_cours' }))).toMatchObject({ ok: false });
    expect(verifierTransition(ctx({ type: 'NET', de: 'acompte_recu', vers: 'en_cours' }))).toMatchObject({ ok: true });
    expect(verifierTransition(ctx({ type: 'REC', de: 'acompte_recu', vers: 'en_cours' }))).toMatchObject({ ok: false });
  });

  it('propose l’étape suivante, « À compléter » et les issues', () => {
    expect(transitionsProposees('REC', 'en_qualification', false)).toEqual(['devis_pret', 'a_completer', 'refuse', 'sans_suite']);
    expect(transitionsProposees('REC', 'nouvelle_demande', false)).toEqual(['refuse', 'sans_suite']);
    expect(transitionsProposees('REC', 'cloture', false)).toEqual([]);
  });
});

describe('Phases (ADR 0007)', () => {
  it('associe chaque statut à sa phase', () => {
    expect(phaseDe('recherche_en_cours')).toBe('execution');
    expect(phaseDe('a_completer')).toBe('qualification');
    expect(phaseDe('sans_suite')).toBe('issue');
  });
  it('un dossier est ouvert avant la phase « Terminé »', () => {
    expect(estOuvert('candidats_proposes')).toBe(true);
    expect(estOuvert('placements_confirmes')).toBe(false);
    expect(estOuvert('refuse')).toBe(false);
  });
});

describe('Numéro de dossier (RG-01)', () => {
  it('formate PRÉFIXE-AAAA-NNNNN', () => {
    expect(formaterNumero('REC', 2026, 42)).toBe('REC-2026-00042');
  });
  it('utilise l’année civile de Douala', () => {
    expect(anneeDouala(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
    expect(anneeDouala(new Date('2026-12-31T22:30:00Z'))).toBe(2026);
  });
});

describe('Téléphones (RG-03)', () => {
  it.each([
    ['690 00 00 00', '+237690000000'],
    ['+237 690000000', '+237690000000'],
    ['00237 6 90 00 00 00', '+237690000000'],
    ['237690000000', '+237690000000'],
    ['233 42 10 10', '+237233421010'],
    ['+33 6 12 34 56 78', '+33612345678'],
  ])('%s → %s', (saisie, attendu) => {
    expect(normaliserTelephone(saisie)).toBe(attendu);
  });
  it.each(['', '12345', '+237 12345', 'abc', '0690000000'])('refuse « %s »', (saisie) => {
    expect(normaliserTelephone(saisie)).toBeNull();
  });
  it('formate pour l’affichage', () => {
    expect(formaterTelephone('+237690000000')).toBe('+237 6 90 00 00 00');
  });
});
