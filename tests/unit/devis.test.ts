// Domaine des devis et factures (specs/MVP2-04), module pur.
import { describe, expect, it } from 'vitest';
import {
  arrondiCentaineSuperieure,
  calculerDevis,
  commissionPour,
  decomposerTtc,
  donneesManquantes,
  formaterMontant,
  formaterNumeroDocument,
  mentionTva,
  montantFinal,
  regularisation,
  totauxFiges,
  verifierTauxAcompte,
} from '@/lib/devis/domaine';

const tarifs = { commission: 5000, commissionsParCategorie: {}, tauxTva: 0 };

describe('Calcul du devis (RG-04)', () => {
  it('10 personnes, TVA 0 %, acompte 50 % → 50 000, TVA non applicable, acompte 25 000', () => {
    const t = calculerDevis([{ lignePosteId: 1, intitule: 'Serveur', nombre: 6 }, { lignePosteId: 2, intitule: 'Cuisinier', nombre: 4 }], tarifs, 50);
    expect(t).toMatchObject({ totalHt: 50000, montantTva: 0, totalTtc: 50000, acompte: 25000 });
    expect(t.lignes.map((l) => l.montantHt)).toEqual([30000, 20000]);
    expect(mentionTva(0)).toBe('TVA non applicable');
    expect(formaterMontant(25000)).toBe('25 000 FCFA');
  });

  it('arrondi de l’acompte à la centaine supérieure : 59 625 × 50 % → 29 900', () => {
    expect(arrondiCentaineSuperieure(29812.5)).toBe(29900);
    expect(arrondiCentaineSuperieure(25000)).toBe(25000);
    expect(totauxFiges([{ lignePosteId: 1, intitule: 'X', nombre: 1, commission: 59625, montantHt: 59625 }], 0, 50).acompte).toBe(29900);
  });

  it('TVA > 0 et commission par catégorie (intitulé normalisé)', () => {
    const t = calculerDevis([{ lignePosteId: 1, intitule: 'Cuisinier(ère)', nombre: 2 }, { lignePosteId: 2, intitule: 'Serveur', nombre: 1 }], { commission: 5000, commissionsParCategorie: { 'cuisinier ère': 8000 }, tauxTva: 19 }, 50);
    expect(commissionPour('CUISINIER (ÈRE)', { commission: 5000, commissionsParCategorie: { 'Cuisinier(ère)': 8000 } })).toBe(8000);
    expect(t).toMatchObject({ totalHt: 21000, montantTva: 3990, totalTtc: 24990, acompte: 12500 });
    expect(mentionTva(19)).toBe('TVA 19 %');
  });
});

describe('Taux d’acompte (RG-06)', () => {
  const bornes = { min: 30, max: 100 };
  it('défaut sans justification ; autre taux justifié ; hors bornes → validation Direction', () => {
    expect(verifierTauxAcompte(50, 50, bornes)).toEqual({ ok: true, validationDirection: false });
    expect(verifierTauxAcompte(40, 50, bornes)).toMatchObject({ ok: false });
    expect(verifierTauxAcompte(40, 50, bornes, 'Client fidèle')).toEqual({ ok: true, validationDirection: false });
    expect(verifierTauxAcompte(20, 50, bornes, 'Petit budget')).toEqual({ ok: true, validationDirection: true });
    expect(verifierTauxAcompte(120, 50, bornes, 'x')).toMatchObject({ ok: false });
  });
});

describe('Contrôle « À compléter » (RG-05)', () => {
  it('liste les données manquantes', () => {
    expect(donneesManquantes({ statut: 'en_qualification', clientNom: 'Hôtel', whatsapp: '+237690000000', villeId: 1, villeAutre: null, lignes: [{ intitule: 'Serveur', nombre: 2 }] })).toEqual([]);
    expect(donneesManquantes({ statut: 'en_qualification', clientNom: ' ', whatsapp: null, villeId: null, villeAutre: null, lignes: [] })).toEqual([
      'raison sociale ou nom du client',
      'numéro WhatsApp du client',
      'au moins un poste avec un nombre de personnes',
      'ville',
    ]);
  });
});

describe('Montant final, solde et avoir (ADR 0010, RG-18)', () => {
  it('exemples de l’ADR 0010 (devis 10 × 5 000, acompte 25 000)', () => {
    const final = (n: number) => montantFinal([{ lignePosteId: 1, commission: 5000, placementsRetenus: n }], 0).totalTtc;
    expect(regularisation(final(10), 25000)).toEqual({ type: 'solde', montantTtc: 25000 });
    expect(regularisation(final(7), 25000)).toEqual({ type: 'solde', montantTtc: 10000 });
    expect(regularisation(final(4), 25000)).toEqual({ type: 'avoir', montantTtc: 5000 });
    expect(regularisation(final(0), 25000)).toEqual({ type: 'avoir', montantTtc: 25000 });
    expect(regularisation(final(5), 25000)).toEqual({ type: 'aucune' });
  });

  it('décomposition TTC → HT + TVA et numérotation', () => {
    expect(decomposerTtc(11900, 19)).toEqual({ totalHt: 10000, montantTva: 1900, totalTtc: 11900 });
    expect(decomposerTtc(5000, 0)).toEqual({ totalHt: 5000, montantTva: 0, totalTtc: 5000 });
    expect(formaterNumeroDocument('facture', 2026, 7)).toBe('FAC-2026-00007');
    expect(formaterNumeroDocument('devis', 2026, 123)).toBe('DEV-2026-00123');
  });
});

describe('Migration 0012 — modèle WhatsApp « Envoi du devis »', () => {
  it('insère le modèle avec le texte exact du code, sans écraser l’existant', async () => {
    const { readFileSync } = await import('node:fs');
    const { MODELE_ENVOI_DEVIS, NOM_MODELE_ENVOI_DEVIS } = await import('@/lib/devis/service');
    const migration = readFileSync('lib/db/migrations/0012_modele_envoi_devis.sql', 'utf8').replace(/\r\n/g, '\n');
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    expect(migration).toContain(`(${q(NOM_MODELE_ENVOI_DEVIS)}, '{REC}', ${q(MODELE_ENVOI_DEVIS)})`);
    expect(migration).toContain('ON CONFLICT ("nom") DO NOTHING');
  });
});
