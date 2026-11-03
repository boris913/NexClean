// Formulaire « Demander du personnel » (specs/MVP1-03) : validation, estimation, récapitulatif.
import { describe, expect, it } from 'vitest';
import {
  aujourdhuiDouala,
  brouillonVide,
  estimer,
  formaterFCFA,
  ligneVide,
  recapitulatifWhatsApp,
  texteEstimation,
  totalPersonnes,
  validerDemandePersonnel,
  validerEtape,
  type Brouillon,
  type LigneBrouillon,
} from '@/lib/dossiers/formulaire-personnel';

const ligne = (x: Partial<LigneBrouillon> = {}): LigneBrouillon => ({
  ...ligneVide(),
  intitule: 'Serveur',
  nombre: '3',
  missions: 'Service en salle',
  experience: '1 à 3 ans',
  typeContrat: 'CDI',
  desQuePossible: true,
  ...x,
});

const valide = (x: Partial<Brouillon> = {}): Brouillon => ({
  ...brouillonVide(),
  clientType: 'entreprise',
  entreprise: 'Hôtel Test',
  contact: 'Mme Essomba',
  whatsapp: '690 00 00 01',
  villeId: 1,
  quartierId: 2,
  secteur: 'Hôtellerie',
  lignes: [ligne(), ligne({ intitule: 'Cuisinier', nombre: '2' })],
  consentement: true,
  ...x,
});

describe('Étape 1 – Vous', () => {
  it('exige l’entreprise si « entreprise », pas si « particulier »', () => {
    expect(validerEtape(1, valide({ entreprise: '' }))).toHaveProperty('entreprise');
    expect(validerEtape(1, valide({ clientType: 'particulier', entreprise: '' }))).toEqual({});
  });
  it('refuse un numéro WhatsApp invalide et un e-mail mal formé', () => {
    const e = validerEtape(1, valide({ whatsapp: '12', email: 'pas-un-email' }));
    expect(e).toHaveProperty('whatsapp');
    expect(e).toHaveProperty('email');
  });
  it('signale toutes les erreurs ensemble (entreprise et contact manquants)', () => {
    const e = validerEtape(1, valide({ entreprise: '', contact: '' }));
    expect(Object.keys(e).sort()).toEqual(['contact', 'entreprise']);
  });
});

describe('Étape 2 – Lieu', () => {
  it('accepte « Autre ville » + « Autre quartier » en texte', () => {
    expect(validerEtape(2, valide({ villeId: null, villeAutre: 'Kribi', quartierId: null, quartierAutre: 'Centre' }))).toEqual({});
  });
  it('exige ville, quartier et secteur', () => {
    const e = validerEtape(2, valide({ villeId: null, villeAutre: ' ', quartierId: null, quartierAutre: '', secteur: '' }));
    expect(Object.keys(e).sort()).toEqual(['quartierId', 'secteur', 'villeId']);
  });
});

describe('Étape 3 – Postes', () => {
  it('Validation : un CDD sans durée → la durée est signalée, même si d’autres champs manquent', () => {
    const e = validerEtape(3, valide({ lignes: [ligne({ typeContrat: 'CDD', missions: '' })] }));
    expect(e['lignes.0.duree']).toMatch(/Durée obligatoire/);
    expect(e).toHaveProperty('lignes.0.missions');
    expect(validerEtape(3, valide({ lignes: [ligne({ typeContrat: 'CDD', duree: '6 mois' })] }))).toEqual({});
  });
  it('exige une date future ou « Dès que possible »', () => {
    expect(validerEtape(3, valide({ lignes: [ligne({ desQuePossible: false, datePriseFonction: '' })] }))).toHaveProperty('lignes.0.datePriseFonction');
    expect(validerEtape(3, valide({ lignes: [ligne({ desQuePossible: false, datePriseFonction: '2020-01-01' })] }))['lignes.0.datePriseFonction']).toMatch(/passée/);
    expect(validerEtape(3, valide({ lignes: [ligne({ desQuePossible: false, datePriseFonction: aujourdhuiDouala() })] }))).toEqual({});
  });
  it('limite : 1 à 100 personnes par poste, 10 postes au plus', () => {
    expect(validerEtape(3, valide({ lignes: [ligne({ nombre: '101' })] }))).toHaveProperty('lignes.0.nombre');
    expect(validerEtape(3, valide({ lignes: [ligne({ nombre: '0' })] }))).toHaveProperty('lignes.0.nombre');
    expect(validerEtape(3, valide({ lignes: Array.from({ length: 11 }, () => ligne()) }))).toHaveProperty('lignes');
    expect(validerEtape(3, valide({ lignes: [] }))).toHaveProperty('lignes');
  });
  it('salaire : entier ou fourchette en FCFA', () => {
    for (const s of ['80000', '80 000', '80 000 - 100 000', '80000 à 100000 FCFA']) expect(validerEtape(3, valide({ lignes: [ligne({ salaire: s })] }))).toEqual({});
    expect(validerEtape(3, valide({ lignes: [ligne({ salaire: 'à négocier' })] }))).toHaveProperty('lignes.0.salaire');
  });
});

describe('Étape 4 et validation complète', () => {
  it('exige le consentement', () => {
    expect(validerEtape(4, valide({ consentement: false }))).toHaveProperty('consentement');
  });
  it('normalise le téléphone et la date « dès que possible »', () => {
    const r = validerDemandePersonnel(valide());
    if (!r.ok) throw new Error(JSON.stringify(r.erreurs));
    expect(r.donnees.whatsapp).toBe('+237690000001');
    expect(r.donnees.lignes[0]!.nombre).toBe(3);
    expect(r.donnees.lignes[0]!.datePriseFonction).toBeNull();
  });
  it('refuse une entrée qui n’est pas un objet', () => {
    expect(validerDemandePersonnel(null).ok).toBe(false);
    expect(validerDemandePersonnel('x').ok).toBe(false);
  });
});

describe('Estimation (RG-04, RG-05)', () => {
  it('5 personnes × 5 000 = « Estimation indicative : 25 000 FCFA »', () => {
    const p = totalPersonnes(valide().lignes);
    expect(p).toBe(5);
    expect(texteEstimation(estimer(5000, p))).toBe('Estimation indicative : 25 000 FCFA (5 personnes × 5 000 FCFA).');
  });
  it('10 personnes → 50 000 FCFA ; une saisie invalide compte pour 0', () => {
    expect(formaterFCFA(estimer(5000, 10).montant)).toBe('50 000 FCFA');
    expect(totalPersonnes([{ nombre: 'abc' }, { nombre: '4' }])).toBe(4);
    expect(texteEstimation(estimer(5000, 1))).toContain('1 personne ×');
  });
});

describe('Récapitulatif WhatsApp (RG-08)', () => {
  it('contient numéro, total, postes et lien de suivi', () => {
    const t = recapitulatifWhatsApp({
      numero: 'REC-2026-00007',
      contact: 'Mme Essomba',
      entreprise: 'Hôtel Test',
      ville: 'Douala',
      quartier: 'Akwa',
      lignes: [{ intitule: 'Serveur', nombre: 3, typeContrat: 'CDI' }, { intitule: 'Cuisinier', nombre: '2' }],
      lienSuivi: 'https://nexclean.xyz/suivi/abc',
    });
    expect(t).toContain('n° REC-2026-00007');
    expect(t).toContain('Total : 5 personnes');
    expect(t).toContain('- 3 × Serveur (CDI)');
    expect(t).toContain('Lieu : Akwa, Douala');
    expect(t).toContain('Suivi : https://nexclean.xyz/suivi/abc');
  });
});
