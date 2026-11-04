// Domaine des Encaissements (specs/MVP2-05), module pur.
import { describe, expect, it } from 'vitest';
import {
  deductionProposee,
  encaissementsNets,
  erreursSaisie,
  etatAcompte,
  issueCloture,
  normaliserReference,
  relanceSoldeDue,
  repartirAcompte,
  verifierClotureDossier,
  acompteEncaisse,
  idsAnnules,
  MOYENS_SAISIE,
  type Ecriture,
} from '@/lib/encaissements/domaine';
import { transitionsProposees, verifierTransition, MESSAGE_ENCAISSEMENTS } from '@/lib/dossiers/statuts';

const base = { nature: 'acompte' as const, montant: 15000, moyen: 'mtn_momo' as const, reference: 'MP2611.1234.A', recuLe: '2026-11-03', aUnJustificatif: true };

describe('Saisie d’un Encaissement (RG-01, RG-03)', () => {
  it('référence et justificatif obligatoires sauf espèces ; date ≤ aujourd’hui ; montant entier > 0', () => {
    expect(erreursSaisie(base, '2026-11-04')).toEqual([]);
    expect(erreursSaisie({ ...base, moyen: 'especes', reference: null, aUnJustificatif: false }, '2026-11-04')).toEqual([]);
    expect(erreursSaisie({ ...base, reference: ' ', aUnJustificatif: false }, '2026-11-04')).toHaveLength(2);
    expect(erreursSaisie({ ...base, recuLe: '2026-11-05' }, '2026-11-04')).toEqual(['La date de réception ne peut pas être dans le futur.']);
    expect(erreursSaisie({ ...base, montant: 0 }, '2026-11-04')).toHaveLength(1);
    expect(erreursSaisie({ ...base, montant: 10.5 }, '2026-11-04')).toHaveLength(1);
  });

  it('moyen « autre » : commentaire obligatoire ; « crédit client » jamais saisissable', () => {
    expect(erreursSaisie({ ...base, moyen: 'autre' }, '2026-11-04')).toHaveLength(1);
    expect(erreursSaisie({ ...base, moyen: 'autre', commentaire: 'Numéro personnel de Rita' }, '2026-11-04')).toEqual([]);
    expect(erreursSaisie({ ...base, moyen: 'credit_client' }, '2026-11-04')).toContain('Moyen de paiement invalide.');
    expect(MOYENS_SAISIE).not.toContain('credit_client');
  });

  it('RG-03 : la référence est comparée sans casse ni espaces', () => {
    expect(normaliserReference(' mp2611.1234.a ')).toBe('MP2611.1234.A');
    expect(normaliserReference('MP 2611 1234')).toBe('MP26111234');
  });
});

describe('Acompte (RG-05) et cas limite « tout payé au départ »', () => {
  it('25 000 dû : 15 000 → partiel « 15 000 / 25 000 » ; 25 000 → complet', () => {
    expect(etatAcompte(25000, 15000)).toEqual({ etat: 'partiel', encaisse: 15000, du: 25000, libelle: 'acompte partiel : 15 000 / 25 000' });
    expect(etatAcompte(25000, 25000)).toMatchObject({ etat: 'complet' });
    expect(etatAcompte(25000, 0)).toEqual({ etat: 'non_paye', du: 25000 });
    expect(etatAcompte(null, 0)).toEqual({ etat: 'aucun_devis' });
  });

  it('acompte plafonné : l’excédent passe en « autre »', () => {
    expect(repartirAcompte(50000, 25000, 0)).toEqual({ acompte: 25000, excedent: 25000 });
    expect(repartirAcompte(10000, 25000, 15000)).toEqual({ acompte: 10000, excedent: 0 });
    expect(repartirAcompte(10000, 25000, 25000)).toEqual({ acompte: 0, excedent: 10000 });
  });

  it('écritures : annulation et remboursement comptent dans les nets, pas le remboursement dans l’acompte', () => {
    const e: Ecriture[] = [
      { id: 1, type: 'encaissement', nature: 'acompte', montant: 15000 },
      { id: 2, type: 'encaissement', nature: 'acompte', montant: 12000 },
      { id: 3, type: 'annulation', nature: 'acompte', montant: -12000, annuleEncaissementId: 2 },
      { id: 4, type: 'remboursement', nature: 'autre', montant: -1000 },
    ];
    expect(encaissementsNets(e)).toBe(14000);
    expect(acompteEncaisse(e)).toBe(15000);
    expect([...idsAnnules(e)]).toEqual([2]);
  });
});

describe('Solde et clôture (RG-08, RG-13)', () => {
  it('7/10 → solde 10 000 ; 4/10 → trop-perçu 5 000 ; 5/10 → solde nul', () => {
    expect(issueCloture(35000, 25000)).toEqual({ issue: 'solde_a_payer', montant: 10000 });
    expect(issueCloture(20000, 25000)).toEqual({ issue: 'trop_percu', montant: 5000 });
    expect(issueCloture(25000, 25000)).toEqual({ issue: 'solde_nul' });
  });

  it('clôture du Dossier : solde nul, pas de remboursement en attente, documents émis', () => {
    const ok = { montantFinalTtc: 35000, nets: 35000, remboursementEnAttente: false, ajustementAPreparer: false, documentsManquants: [] };
    expect(verifierClotureDossier(ok)).toEqual({ ok: true });
    expect(verifierClotureDossier({ ...ok, nets: 25000 })).toMatchObject({ ok: false, erreur: 'Il reste 10 000 FCFA à encaisser.' });
    expect(verifierClotureDossier({ ...ok, remboursementEnAttente: true })).toMatchObject({ ok: false });
    expect(verifierClotureDossier({ ...ok, montantFinalTtc: null })).toMatchObject({ ok: false });
    expect(verifierClotureDossier({ ...ok, documentsManquants: ['reçu REÇ-2026-00001'] })).toMatchObject({ ok: false });
  });
});

describe('Impayés (RG-09) et crédit client (RG-12)', () => {
  const j = (n: number) => new Date(Date.UTC(2026, 10, 1 + n));
  it('alerte 15 jours après l’émission, puis tous les 7 jours', () => {
    const o = { emiseLe: j(0), delaiJours: 15, periodeJours: 7 };
    expect(relanceSoldeDue({ ...o, derniereRelanceLe: null, maintenant: j(14) })).toBe(false);
    expect(relanceSoldeDue({ ...o, derniereRelanceLe: null, maintenant: j(15) })).toBe(true);
    expect(relanceSoldeDue({ ...o, derniereRelanceLe: j(15), maintenant: j(21) })).toBe(false);
    expect(relanceSoldeDue({ ...o, derniereRelanceLe: j(15), maintenant: j(22) })).toBe(true);
  });

  it('déduction proposée : crédit disponible, plafonné au devis', () => {
    expect(deductionProposee(5000, 50000)).toBe(5000);
    expect(deductionProposee(80000, 50000)).toBe(50000);
    expect(deductionProposee(0, 50000)).toBe(0);
  });
});

describe('Statuts fixés par les Encaissements (RG-05, RG-08, RG-13)', () => {
  const ctx = { type: 'REC' as const, direction: false, aUnDevisExterne: false, aUnJustificatif: true, commentaire: 'x' };
  it('avec devis accepté : « Acompte reçu » / « Solde reçu » ne se posent pas à la main', () => {
    expect(verifierTransition({ ...ctx, de: 'accepte', vers: 'acompte_recu', encaissementsIntegres: true })).toEqual({ ok: false, erreur: MESSAGE_ENCAISSEMENTS });
    expect(verifierTransition({ ...ctx, de: 'accepte', vers: 'acompte_recu', encaissementsIntegres: false })).toEqual({ ok: true, retourArriere: false });
    expect(transitionsProposees('REC', 'accepte', false, { encaissementsIntegres: true })).not.toContain('acompte_recu');
    // Retour en arrière avec motif : toujours possible.
    expect(verifierTransition({ ...ctx, de: 'recherche_en_cours', vers: 'acompte_recu', encaissementsIntegres: true })).toEqual({ ok: true, retourArriere: true });
  });

  it('clôture refusée si les conditions financières ne sont pas réunies', () => {
    expect(verifierTransition({ ...ctx, de: 'solde_recu', vers: 'cloture', clotureFinanciere: { ok: false, erreur: 'Il reste 10 000 FCFA à encaisser.' } })).toEqual({ ok: false, erreur: 'Il reste 10 000 FCFA à encaisser.' });
    expect(verifierTransition({ ...ctx, de: 'solde_recu', vers: 'cloture', clotureFinanciere: { ok: true } })).toEqual({ ok: true, retourArriere: false });
  });
});

describe('Migration 0013 — modèle WhatsApp « Relance solde »', () => {
  it('insère le modèle avec le texte exact du code, sans écraser l’existant', async () => {
    const { readFileSync } = await import('node:fs');
    const { MODELE_RELANCE_SOLDE, NOM_MODELE_RELANCE_SOLDE } = await import('@/lib/encaissements/modeles');
    const migration = readFileSync('lib/db/migrations/0013_encaissements.sql', 'utf8').replace(/\r\n/g, '\n');
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    expect(migration).toContain(`(${q(NOM_MODELE_RELANCE_SOLDE)}, '{REC}', ${q(MODELE_RELANCE_SOLDE)})`);
  });
});
