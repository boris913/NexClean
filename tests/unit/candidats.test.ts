// Règles pures de l'espace candidat (specs/MVP2-01).
import { describe, expect, it } from 'vitest';
import { brouillonCandidatVide, completude, pseudonyme, schemaMotDePasse, validerEtapeCandidat, validerProfil } from '@/lib/candidats/domaine';

const complet = () => ({
  ...brouillonCandidatVide(),
  nom: 'Mballa',
  prenom: 'Josiane',
  telephone: '6 90 00 00 01',
  villeId: 1,
  quartierId: 2,
  zonesQuartierIds: [2],
  metiers: ['Serveur'],
  typesContrat: ['CDD'],
  niveauEtudes: 'Probatoire',
  disponibilite: 'immediate' as const,
});

describe('Validation des étapes', () => {
  it('étape 1 : nom, prénom, téléphone ; WhatsApp exigé si « identique » est décoché', () => {
    expect(Object.keys(validerEtapeCandidat(1, brouillonCandidatVide())).sort()).toEqual(['nom', 'prenom', 'telephone']);
    expect(validerEtapeCandidat(1, { ...complet(), whatsappIdentique: false })).toHaveProperty('whatsapp');
    expect(validerEtapeCandidat(1, { ...complet(), telephone: '12' })).toHaveProperty('telephone');
    expect(validerEtapeCandidat(1, { ...complet(), email: 'pas-un-email' })).toHaveProperty('email');
  });

  it('étape 2 : ville, quartier et au moins une zone de travail', () => {
    const e = validerEtapeCandidat(2, brouillonCandidatVide());
    expect(Object.keys(e).sort()).toEqual(['quartierId', 'villeId', 'zones']);
    expect(validerEtapeCandidat(2, { ...complet(), zonesQuartierIds: [], zonesTouteVille: true })).toEqual({});
    expect(validerEtapeCandidat(2, { ...complet(), villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' })).toEqual({});
  });

  it('étape 3 : 1 à 5 métiers, au moins un contrat, fourchette cohérente', () => {
    expect(validerEtapeCandidat(3, { ...complet(), metiers: [] })).toHaveProperty('metiers');
    expect(validerEtapeCandidat(3, { ...complet(), metiers: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'] })).toHaveProperty('metiers');
    expect(validerEtapeCandidat(3, { ...complet(), typesContrat: [] })).toHaveProperty('typesContrat');
    expect(validerEtapeCandidat(3, { ...complet(), salaireMin: '90 000', salaireMax: '60 000' })).toHaveProperty('salaireMax');
    expect(validerEtapeCandidat(3, { ...complet(), salaireMin: '60 000', salaireMax: '90 000' })).toEqual({});
  });

  it('étape 5 : date exigée pour « à partir du », préavis exigé pour « en poste »', () => {
    expect(validerEtapeCandidat(5, { ...complet(), disponibilite: 'a_partir_du' })).toHaveProperty('disponibleLe');
    expect(validerEtapeCandidat(5, { ...complet(), disponibilite: 'preavis' })).toHaveProperty('preavis');
  });

  it('étape 7 : deux consentements distincts et l’attestation d’âge (RG-03)', () => {
    const e = validerEtapeCandidat(7, { ...complet(), consentementTraitement: true });
    expect(Object.keys(e).sort()).toEqual(['consentementContact', 'consentementMajorite']);
  });

  it('profil complet : WhatsApp = téléphone si identique, zones vidées si « toute la ville »', () => {
    const r = validerProfil({ ...complet(), zonesTouteVille: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profil.telephone).toBe('+237690000001');
      expect(r.profil.whatsapp).toBe('+237690000001');
      expect(r.profil.zonesQuartierIds).toEqual([]);
    }
  });
});

describe('Mot de passe candidat (ADR 0016)', () => {
  it('8 caractères au moins, ou exactement 6 chiffres', () => {
    expect(schemaMotDePasse.safeParse('123456').success).toBe(true);
    expect(schemaMotDePasse.safeParse('motdepas').success).toBe(true);
    expect(schemaMotDePasse.safeParse('1234567').success).toBe(false);
    expect(schemaMotDePasse.safeParse('abc123').success).toBe(false);
  });
});

describe('Complétude (RG-09)', () => {
  const vide = { email: null, quartierId: 1, quartierAutre: null, repere: null, secteurs: [], salaireMin: null, qualifications: null, experiences: 0, competences: [], horaires: [], cv: false };
  it('40 % avec les seuls champs obligatoires, 100 % avec tout', () => {
    expect(completude(vide).pourcentage).toBe(40);
    expect(completude({ ...vide, email: 'a@b.cm', repere: 'x', secteurs: ['Commerce'], salaireMin: 1, qualifications: 'x', experiences: 1, competences: ['x'], horaires: ['jour'], cv: true })).toEqual({ pourcentage: 100, manquants: [] });
    expect(completude(vide).manquants[0]).toBe('votre CV');
  });
});

describe('Pseudonyme (RG-17)', () => {
  it('stable et sans donnée personnelle', () => {
    expect(pseudonyme(42)).toMatch(/^Candidat #[0-9A-F]{4}$/);
    expect(pseudonyme(42)).toBe(pseudonyme(42));
  });
});
