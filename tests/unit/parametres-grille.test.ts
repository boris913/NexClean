// Écran Paramètres — grille tarifaire (specs/MVP2-04 RG-01, cas limite QO-3) : validation des
// saisies et mise en forme de l'historique.
import { describe, expect, it } from 'vitest';
import { commissionsDepuisPaires, formaterValeurParametre, verifierAcompte } from '@/app/(backoffice)/admin/(prive)/parametres/grille';
import { commissionPour } from '@/lib/devis/domaine';

describe('commissions par catégorie (RG-01)', () => {
  it('convertit les paires en objet, ignore les lignes vides, normalise les espaces et les montants', () => {
    const r = commissionsDepuisPaires([
      { intitule: '  Cuisinier(ère) ', montant: '7 500' },
      { intitule: '', montant: '' },
      { intitule: 'Gardien   /  vigile', montant: 6000 },
    ]);
    expect(r).toEqual({ 'Cuisinier(ère)': 7500, 'Gardien / vigile': 6000 });
    // Utilisable tel quel par le calcul du devis.
    expect(commissionPour('cuisinier(ere)', { commission: 5000, commissionsParCategorie: r })).toBe(7500);
    expect(commissionsDepuisPaires([])).toEqual({});
  });

  it('refuse un intitulé trop court, un montant non entier ou négatif, et deux intitulés équivalents', () => {
    expect(() => commissionsDepuisPaires([{ intitule: 'A', montant: 1000 }])).toThrow('Intitulé');
    expect(() => commissionsDepuisPaires([{ intitule: 'Serveur', montant: '12.5' }])).toThrow('Montant invalide');
    expect(() => commissionsDepuisPaires([{ intitule: 'Serveur', montant: -1 }])).toThrow('Montant invalide');
    expect(() => commissionsDepuisPaires([{ intitule: 'Serveur', montant: '' }])).toThrow('Montant invalide');
    expect(() => commissionsDepuisPaires([{ intitule: 'Serveur', montant: 2_000_000 }])).toThrow('Montant invalide');
    expect(() =>
      commissionsDepuisPaires([
        { intitule: 'Réceptionniste', montant: 6000 },
        { intitule: 'receptionniste', montant: 7000 },
      ]),
    ).toThrow('même catégorie');
  });
});

describe('acompte (RG-01, RG-06)', () => {
  it('exige des pourcentages entiers, min ≤ max et un taux par défaut dans les bornes', () => {
    expect(verifierAcompte(50, 30, 100)).toEqual({ defaut: 50, bornes: { min: 30, max: 100 } });
    expect(() => verifierAcompte(50, 60, 40)).toThrow('borne minimale');
    expect(() => verifierAcompte(20, 30, 100)).toThrow('compris entre les bornes');
    expect(() => verifierAcompte(50.5, 30, 100)).toThrow('pourcentage entier');
    expect(() => verifierAcompte(50, 30, 101)).toThrow('pourcentage entier');
  });
});

describe('historique : valeurs lisibles', () => {
  it('met en forme chaque type de paramètre', () => {
    expect(formaterValeurParametre('commission_par_personne', 5000)).toBe('5 000 FCFA HT / personne');
    expect(formaterValeurParametre('tva_taux', 0)).toBe('0 % (TVA non applicable)');
    expect(formaterValeurParametre('acompte_bornes', { min: 30, max: 100 })).toBe('30 % – 100 %');
    expect(formaterValeurParametre('garantie_jours', 15)).toBe('15 jours');
    expect(formaterValeurParametre('validite_devis_jours', 1)).toBe('1 jour');
    expect(formaterValeurParametre('commissions_par_categorie', {})).toBe('Aucune');
    expect(formaterValeurParametre('commissions_par_categorie', { Nounou: 4000 })).toBe('Nounou : 4 000 FCFA');
    expect(formaterValeurParametre('minimum_facturation', null)).toBe('Désactivé');
    expect(formaterValeurParametre('conditions_devis', 'Ligne 1\nLigne 2')).toBe('Ligne 1 / Ligne 2');
    expect(formaterValeurParametre('mentions_legales', 'x'.repeat(300))).toHaveLength(140);
  });
});
