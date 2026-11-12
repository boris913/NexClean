// Règles de l'agent conversationnel (specs/COM3-02 RG-02, RG-04, RG-05), appliquées dans le code.
import { describe, expect, it } from 'vitest';
import { avecPresentation, controlerMessage, creneauxRappel, declencheurPassage, montantsCites } from '@/lib/ia/agent-regles';
import { HEURES_OUVREES_PAR_DEFAUT } from '@/lib/parametres';

const t = (iso: string) => new Date(`${iso}+01:00`);
const AUTORISE = { montants: [60000], liens: ['https://nexclean.xyz/suivi/abc'], telephones: ['+237696370479'] };

describe('passage à l’humain (RG-05)', () => {
  it('critère : « faites-moi 20 % et je signe » → négociation', () => {
    expect(declencheurPassage('faites-moi 20 % et je signe')).toBe('negociation');
  });
  it('autres déclencheurs', () => {
    expect(declencheurPassage('Je veux parler à un conseiller')).toBe('humain');
    expect(declencheurPassage('Vous pouvez me faire une réduction ?')).toBe('negociation');
    expect(declencheurPassage('Je ne suis pas satisfait, je veux une réclamation')).toBe('reclamation');
    expect(declencheurPassage('Comment payer par Orange Money ?')).toBe('paiement');
    expect(declencheurPassage('I want to talk to a real person')).toBe('humain');
  });
  it('message ordinaire : pas de passage', () => {
    expect(declencheurPassage('Bonjour, je cherche une ménagère à Bonamoussadi pour lundi')).toBeNull();
    expect(declencheurPassage('Il me faut 2 agents d’entretien')).toBeNull();
  });
});

describe('contrôle avant envoi (RG-02)', () => {
  it('critère : « 80 000 FCFA » alors que l’estimation a renvoyé 60 000 → bloqué', () => {
    expect(controlerMessage('Cela reviendrait à 80 000 FCFA environ.', AUTORISE)).toMatchObject({ ok: false, raison: expect.stringMatching(/80000/) });
    expect(controlerMessage('L’estimation indicative est de 60 000 FCFA.', AUTORISE)).toEqual({ ok: true });
  });
  it('liens et numéros non fournis par le serveur', () => {
    expect(controlerMessage('Voir https://exemple.com/promo', AUTORISE).ok).toBe(false);
    expect(controlerMessage('Votre suivi : https://nexclean.xyz/suivi/abc.', AUTORISE).ok).toBe(true);
    expect(controlerMessage('Appelez le 699 11 22 33', AUTORISE).ok).toBe(false);
    expect(controlerMessage('Appelez-nous au +237 696 37 04 79', AUTORISE).ok).toBe(true);
    expect(controlerMessage('Début souhaité le 2026-11-16, pour 150 000 personnes', AUTORISE).ok).toBe(true);
  });
  it('promesses de remise ou de date', () => {
    expect(controlerMessage('Je vous accorde une remise exceptionnelle.', AUTORISE).ok).toBe(false);
    expect(controlerMessage('Nous passerons demain chez vous.', AUTORISE).ok).toBe(false);
    expect(controlerMessage('Un conseiller vous rappellera pour convenir d’une date.', AUTORISE).ok).toBe(true);
  });
  it('lecture des montants', () => {
    expect(montantsCites('Entre 8 000 FCFA et 15.000 francs, ou 5000 F CFA')).toEqual([8000, 15000, 5000]);
  });
});

describe('présentation (RG-04)', () => {
  it('au premier message seulement', () => {
    expect(avecPresentation('Bonjour !', true)).toMatch(/^Bonjour, je suis l’assistant virtuel de NEXCLEAN/);
    expect(avecPresentation('Bonjour !', false)).toBe('Bonjour !');
  });
});

describe('créneaux de rappel (RG-01)', () => {
  it('heures pleines ouvrées, au moins 2 h après, sans chevaucher un rendez-vous', () => {
    const c = creneauxRappel(t('2026-11-12T10:20:00'), HEURES_OUVREES_PAR_DEFAUT, [t('2026-11-12T14:00:00')]);
    expect(c.map((x) => x.toISOString())).toEqual([t('2026-11-12T13:00:00'), t('2026-11-12T15:00:00'), t('2026-11-12T16:00:00')].map((x) => x.toISOString()));
  });
  it('le soir : créneaux du lendemain matin', () => {
    expect(creneauxRappel(t('2026-11-12T18:30:00'), HEURES_OUVREES_PAR_DEFAUT, [])[0]!.toISOString()).toBe(t('2026-11-13T07:00:00').toISOString());
  });
});
