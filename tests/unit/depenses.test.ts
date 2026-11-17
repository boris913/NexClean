// POST-03 (ADR 0020) : règles pures des dépenses et du tableau de bord direction.
import { describe, expect, it } from 'vitest';
import { peut } from '@/lib/authz/permissions';
import {
  calculerIndicateurs,
  CATEGORIES_INITIALES,
  erreurDateDepense,
  joursEntre,
  libellePeriode,
  marge,
  moisDe,
  moisPrecedent,
  MOYENS_DEPENSE,
  motifAnnulationValide,
  nomFichierExport,
  periodeDepuis,
  restantsParFacture,
  schemaCategorie,
  schemaDepense,
  serviceRattache,
  tauxMarge,
  trancheAnciennete,
  ventilerImpayes,
  versCsvComptable,
  type EntreeDepense,
  type LigneComptable,
} from '@/lib/depenses/domaine';

const base: EntreeDepense = {
  depenseLe: '2026-11-10',
  categorieId: 2,
  libelle: '  Taxi Akwa – Bonamoussadi  ',
  montant: 3500,
  moyen: 'especes',
  reference: '',
  villeId: null,
  dossierNumero: ' rec-2026-00012 ',
  service: null,
  commentaire: '',
};

describe('Dépenses — saisie (RG-01)', () => {
  it('normalise libellé, références vides et numéro de dossier', () => {
    const d = schemaDepense.parse(base);
    expect(d).toMatchObject({ libelle: 'Taxi Akwa – Bonamoussadi', reference: null, commentaire: null, dossierNumero: 'REC-2026-00012', service: null, villeId: null });
  });

  it('refuse un montant nul, négatif, décimal ou absent', () => {
    for (const montant of [0, -500, 12.5, Number.NaN]) expect(schemaDepense.safeParse({ ...base, montant }).success).toBe(false);
    const r = schemaDepense.safeParse({ ...base, montant: 0 });
    expect(r.success ? '' : r.error.issues[0]!.message).toMatch(/entier de FCFA supérieur à 0/);
  });

  it('refuse le moyen « Crédit client » (écriture interne) et une catégorie absente', () => {
    expect(MOYENS_DEPENSE).not.toContain('credit_client');
    expect(schemaDepense.safeParse({ ...base, moyen: 'credit_client' as never }).success).toBe(false);
    expect(schemaDepense.safeParse({ ...base, categorieId: null as never }).success).toBe(false);
  });

  it('refuse une date future ou mal formée', () => {
    expect(erreurDateDepense('2026-11-17', '2026-11-17')).toBeNull();
    expect(erreurDateDepense('2026-11-18', '2026-11-17')).toMatch(/futur/);
    expect(erreurDateDepense('17/11/2026', '2026-11-17')).toMatch(/date/);
  });

  it('RG-04 : le type du Dossier prime sur le service choisi', () => {
    expect(serviceRattache('REC', 'NET')).toBe('REC');
    expect(serviceRattache(null, 'NET')).toBe('NET');
    expect(serviceRattache(null, null)).toBeNull();
  });

  it('RG-06 : motif d’annulation obligatoire', () => {
    expect(motifAnnulationValide('  ')).toBeNull();
    expect(motifAnnulationValide(null)).toBeNull();
    expect(motifAnnulationValide(' Saisie en double ')).toBe('Saisie en double');
  });
});

describe('Catégories (RG-02)', () => {
  it('liste initiale de 10 catégories, « Autre » comprise', () => {
    expect(CATEGORIES_INITIALES).toHaveLength(10);
    expect(CATEGORIES_INITIALES).toContain('Frais bancaires et mobile money');
    expect(CATEGORIES_INITIALES.at(-1)).toBe('Autre');
  });

  it('valide le libellé et l’ordre', () => {
    expect(schemaCategorie.parse({ libelle: ' Formation ' })).toEqual({ libelle: 'Formation', ordre: 100 });
    expect(schemaCategorie.safeParse({ libelle: 'x' }).success).toBe(false);
  });
});

describe('Droits (RG-01, RG-02, RG-08, RG-15)', () => {
  it('Finances et Direction saisissent ; ni le Référent ni l’Administrateur', () => {
    expect(peut(['finances'], 'depense.saisir')).toBe(true);
    expect(peut(['direction'], 'depense.saisir')).toBe(true);
    expect(peut(['referent'], 'depense.saisir')).toBe(false);
    expect(peut(['admin'], 'depense.saisir')).toBe(false);
  });

  it('catégories : Direction et Administrateur ; tableau de bord : Finances et Direction', () => {
    expect(peut(['direction'], 'depense.categories')).toBe(true);
    expect(peut(['admin'], 'depense.categories')).toBe(true);
    expect(peut(['finances'], 'depense.categories')).toBe(false);
    expect(peut(['finances'], 'finances.tableau_de_bord')).toBe(true);
    expect(peut(['referent'], 'finances.tableau_de_bord')).toBe(false);
  });
});

describe('Période (RG-08)', () => {
  it('mois en cours par défaut, février bissextile ou non', () => {
    expect(periodeDepuis({}, '2026-11-17')).toEqual({ du: '2026-11-01', au: '2026-11-30' });
    expect(moisDe('2028-02-10')).toEqual({ du: '2028-02-01', au: '2028-02-29' });
    expect(moisDe('2026-02-10')).toEqual({ du: '2026-02-01', au: '2026-02-28' });
  });

  it('mois précédent, y compris en janvier', () => {
    expect(moisPrecedent('2026-11-17')).toEqual({ du: '2026-10-01', au: '2026-10-31' });
    expect(moisPrecedent('2027-01-05')).toEqual({ du: '2026-12-01', au: '2026-12-31' });
  });

  it('mois=AAAA-MM, bornes inversées, borne seule, valeurs invalides ignorées', () => {
    expect(periodeDepuis({ mois: '2026-09' }, '2026-11-17')).toEqual({ du: '2026-09-01', au: '2026-09-30' });
    expect(periodeDepuis({ du: '2026-10-20', au: '2026-10-05' }, '2026-11-17')).toEqual({ du: '2026-10-05', au: '2026-10-20' });
    expect(periodeDepuis({ du: '2026-10-20' }, '2026-11-17')).toEqual({ du: '2026-10-20', au: '2026-10-31' });
    expect(periodeDepuis({ du: '2026-02-30', au: 'n’importe quoi', mois: '2026-13' }, '2026-11-17')).toEqual({ du: '2026-11-01', au: '2026-11-30' });
  });

  it('libellés lisibles', () => {
    expect(libellePeriode({ du: '2026-11-01', au: '2026-11-30' })).toBe('novembre 2026');
    expect(libellePeriode({ du: '2026-11-01', au: '2026-11-15' })).toBe('du 1er novembre 2026 au 15 novembre 2026');
    expect(libellePeriode({ du: '2026-11-03', au: '2026-11-03' })).toBe('le 3 novembre 2026');
    expect(joursEntre('2026-10-31', '2026-11-30')).toBe(30);
  });
});

describe('Indicateurs (ADR 0020 §2)', () => {
  it('facturé = factures − avoirs ; résultat = facturé HT − dépenses ; trésorerie = encaissé − dépenses', () => {
    const i = calculerIndicateurs({ facturesHt: 100_000, facturesTtc: 119_250, avoirsHt: 10_000, avoirsTtc: 11_925, encaisse: 80_000, depenses: 30_000 });
    expect(i).toEqual({ factureHt: 90_000, factureTtc: 107_325, encaisse: 80_000, depenses: 30_000, resultatEstime: 60_000, tresorerie: 50_000 });
  });

  it('résultat et trésorerie négatifs possibles', () => {
    const i = calculerIndicateurs({ facturesHt: 0, facturesTtc: 0, avoirsHt: 5_000, avoirsTtc: 5_000, encaisse: -5_000, depenses: 12_000 });
    expect(i.factureTtc).toBe(-5_000);
    expect(i.resultatEstime).toBe(-17_000);
    expect(i.tresorerie).toBe(-17_000);
  });

  it('marge et taux de marge (RG-14)', () => {
    expect(marge(50_000, 12_000)).toBe(38_000);
    expect(tauxMarge(50_000, 12_000)).toBe(76);
    expect(tauxMarge(0, 12_000)).toBeNull();
    expect(tauxMarge(10_000, 15_000)).toBe(-50);
  });
});

describe('Impayés par ancienneté (RG-11)', () => {
  it('tranches 0–30, 31–60, 61–90, plus de 90 jours', () => {
    expect([0, 30, 31, 60, 61, 90, 91, -2].map(trancheAnciennete)).toEqual(['0_30', '0_30', '31_60', '31_60', '61_90', '61_90', 'plus_90', '0_30']);
  });

  it('ventile montants et nombres, ignore les factures soldées', () => {
    const v = ventilerImpayes([
      { restant: 10_000, ancienneteJours: 5 },
      { restant: 4_000, ancienneteJours: 45 },
      { restant: 6_000, ancienneteJours: 120 },
      { restant: 0, ancienneteJours: 200 },
    ]);
    expect(v.total).toBe(20_000);
    expect(v.tranches.map((t) => [t.code, t.montant, t.nombre])).toEqual([
      ['0_30', 10_000, 1],
      ['31_60', 4_000, 1],
      ['61_90', 0, 0],
      ['plus_90', 6_000, 1],
    ]);
  });

  it('le réglé couvre d’abord les factures les plus anciennes', () => {
    const factures = [
      { id: 1, emiseLe: '2026-09-01', totalTtc: 25_000 },
      { id: 2, emiseLe: '2026-10-15', totalTtc: 10_000 },
    ];
    expect(restantsParFacture(factures, 25_000)).toEqual([0, 10_000]);
    expect(restantsParFacture(factures, 20_000)).toEqual([5_000, 10_000]);
    expect(restantsParFacture(factures, 0)).toEqual([25_000, 10_000]);
    expect(restantsParFacture(factures, 40_000)).toEqual([0, 0]); // trop-perçu : rien d'impayé
  });
});

describe('Export comptable (RG-15)', () => {
  const lignes: LigneComptable[] = [
    { nature: 'facture', date: '2026-11-02', piece: 'FAC-2026-00001', libelle: 'Acompte ; recrutement', categorie: null, tiers: 'Hôtel "Le Ndé"', dossier: 'REC-2026-00001', service: 'REC', ville: 'Douala', moyen: null, reference: null, ht: 25_000, tva: 4_813, ttc: 29_813, justificatif: null },
    { nature: 'avoir', date: '2026-11-05', piece: 'FAC-2026-00002', libelle: 'Avoir', categorie: null, tiers: 'Hôtel', dossier: 'REC-2026-00001', service: 'REC', ville: null, moyen: null, reference: null, ht: 5_000, tva: 963, ttc: 5_963, justificatif: null },
    { nature: 'depense', date: '2026-11-06', piece: 'DEP-00007', libelle: '=SOMME(A1)', categorie: 'Transport', tiers: null, dossier: null, service: null, ville: 'Douala', moyen: 'orange_money', reference: 'OM-1', ht: null, tva: null, ttc: 3_500, justificatif: true },
  ];
  const csv = versCsvComptable(lignes);
  const rangees = csv.slice(1).split('\r\n');

  it('BOM UTF-8, séparateur « ; », CRLF, en-tête', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(rangees[0]).toBe('Nature;Date;Pièce;Libellé;Catégorie;Client;Dossier;Service;Ville;Moyen de paiement;Référence;Montant HT;TVA;Montant TTC;Justificatif');
  });

  it('montants entiers sans séparateur, avoirs négatifs, dépenses positives', () => {
    expect(rangees[1]).toBe('Facture;2026-11-02;FAC-2026-00001;"Acompte ; recrutement";;"Hôtel ""Le Ndé""";REC-2026-00001;Recrutement / placement;Douala;;;25000;4813;29813;');
    expect(rangees[2]!.endsWith(';-5000;-963;-5963;')).toBe(true);
    expect(rangees[3]).toBe("Dépense;2026-11-06;DEP-00007;'=SOMME(A1);Transport;;;;Douala;Orange Money;OM-1;;;3500;oui");
  });

  it('nom du fichier', () => {
    expect(nomFichierExport({ du: '2026-11-01', au: '2026-11-30' })).toBe('nexclean-comptable-2026-11-01_2026-11-30.csv');
  });
});
