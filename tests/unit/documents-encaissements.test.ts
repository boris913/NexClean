// MVP2-05 lot C : reçu d'encaissement (RG-04) et mention de déduction du crédit client sur le
// devis et la facture d'acompte (RG-12) — rendu valide, texte attendu, police ≥ 10 pt, < 300 Ko.
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { lignesDeductionCredit, montantEnLettres, pdfDevis, pdfFacture, pdfRecu, type DonneesDevisPdf, type DonneesFacturePdf, type DonneesRecuPdf } from '@/lib/documents/modeles';

async function texteDuPdf(octets: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(octets);
  let brut = '';
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filtre = obj.dict.get(PDFName.of('Filter'));
    brut += (filtre === PDFName.of('FlateDecode') ? inflateSync(Buffer.from(obj.contents)) : Buffer.from(obj.contents)).toString('latin1');
  }
  const texte = [...brut.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('\n');
  const tailles = [...brut.matchAll(/\/\S+ ([\d.]+) Tf/g)].map((m) => Number(m[1]));
  expect(Math.min(...tailles)).toBeGreaterThanOrEqual(10);
  return texte;
}

const MENTIONS = 'NEXCLEAN SARL — Akwa, Douala — RCCM : RC/DLA/2026/B/0001 — NIU : M0123456789';
const CLIENT = { nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237 699 00 11 22', email: null, ville: 'Kribi' };

const recu = (o: Partial<DonneesRecuPdf> = {}): DonneesRecuPdf => ({
  numero: 'REÇ-2026-00001',
  recuLe: '2026-11-03',
  emisLe: new Date('2026-11-04T09:00:00Z'),
  numeroDossier: 'REC-2026-0042',
  client: CLIENT,
  nature: 'Acompte',
  moyen: 'MTN MoMo',
  reference: 'MP2611.1234.A',
  montant: 15000,
  devis: { numero: 'DEV-2026-00001', version: 1 },
  situation: { libelleBase: 'Montant du devis', base: 50000, totalRegle: 15000 },
  mentionsLegales: MENTIONS,
  ...o,
});

describe('Reçu PDF (MVP2-05 RG-04)', () => {
  it('numéro, date de réception, client, Dossier, nature, moyen, référence, montant en chiffres et en lettres, devis, reste à payer, mentions légales', async () => {
    const octets = await pdfRecu(recu());
    expect(octets.byteLength).toBeLessThan(300 * 1024);
    const doc = await PDFDocument.load(octets);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    const t = await texteDuPdf(octets);
    expect(t).toContain('REÇU');
    expect(t).toContain('REÇ-2026-00001');
    expect(t).toContain('3 novembre 2026');
    expect(t).toContain('Hôtel du Lac');
    expect(t).toContain('Dossier REC-2026-0042');
    expect(t).toContain('Acompte');
    expect(t).toContain('MTN MoMo');
    expect(t).toContain('MP2611.1234.A');
    expect(t).toContain('15 000 FCFA');
    expect(t).toContain('quinze mille francs CFA');
    expect(t).toContain('DEV-2026-00001 (version 1)');
    expect(t).toContain('Reste à payer à cette date');
    expect(t).toContain('35 000 FCFA');
    expect(t).toContain('RCCM : RC/DLA/2026/B/0001');
    expect(t).toContain('Page 1 / 1');
  });

  it('espèces sans référence ni devis ni situation : champs omis', async () => {
    const t = await texteDuPdf(await pdfRecu(recu({ moyen: 'Espèces', reference: null, devis: null, situation: null })));
    expect(t).toContain('Espèces');
    expect(t).not.toContain('Référence de la transaction');
    expect(t).not.toContain('Reste à payer');
  });

  it('montant en lettres', () => {
    expect(montantEnLettres(0)).toBe('zéro');
    expect(montantEnLettres(21)).toBe('vingt et un');
    expect(montantEnLettres(71)).toBe('soixante et onze');
    expect(montantEnLettres(80)).toBe('quatre-vingts');
    expect(montantEnLettres(95)).toBe('quatre-vingt-quinze');
    expect(montantEnLettres(200)).toBe('deux cents');
    expect(montantEnLettres(1000)).toBe('mille');
    expect(montantEnLettres(25000)).toBe('vingt-cinq mille');
    expect(montantEnLettres(200000)).toBe('deux cent mille');
    expect(montantEnLettres(80000)).toBe('quatre-vingt mille');
    expect(montantEnLettres(1250500)).toBe('un million deux cent cinquante mille cinq cents');
  });
});

const devis = (o: Partial<DonneesDevisPdf> = {}): DonneesDevisPdf => ({
  type: 'devis',
  numero: 'DEV-2026-00002',
  version: 1,
  numeroDossier: 'REC-2026-0050',
  date: new Date('2026-11-04T10:00:00Z'),
  validiteJours: 15,
  client: CLIENT,
  lignes: [{ intitule: 'Serveur', nombre: 10, commission: 5000, montantHt: 50000 }],
  tauxTva: 0,
  totalHt: 50000,
  montantTva: 0,
  totalTtc: 50000,
  tauxAcompte: 50,
  acompte: 25000,
  delaiRechercheJours: 30,
  garantieJours: 15,
  conditions: 'Conditions.',
  mentionsLegales: MENTIONS,
  ...o,
});

const factureAcompte = (o: Partial<DonneesFacturePdf> = {}): DonneesFacturePdf => ({
  type: 'acompte',
  numero: 'FAC-2026-00010',
  emiseLe: new Date('2026-11-05T09:00:00Z'),
  numeroDossier: 'REC-2026-0050',
  libelle: 'Acompte de 50 % sur le devis DEV-2026-00002 (version 1)',
  devis: { numero: 'DEV-2026-00002', version: 1 },
  client: CLIENT,
  lignes: [{ libelle: 'Acompte 50 %', quantite: 1, prixUnitaire: 25000, montantHt: 25000 }],
  tauxTva: 0,
  totalHt: 25000,
  montantTva: 0,
  totalTtc: 25000,
  mentionsLegales: MENTIONS,
  ...o,
});

describe('Déduction du crédit client (MVP2-05 RG-12)', () => {
  it('lignes de déduction : aucune sans crédit ; reste à payer de l’acompte jamais négatif', () => {
    expect(lignesDeductionCredit(25000, 0)).toEqual([]);
    expect(lignesDeductionCredit(25000, null)).toEqual([]);
    expect(lignesDeductionCredit(25000, 5000).map((l) => l.valeur)).toEqual(['- 5 000 FCFA', '20 000 FCFA']);
    expect(lignesDeductionCredit(25000, 30000)[1]!.valeur).toBe('0 FCFA');
  });

  it('devis : « Déduction du crédit client » et reste à payer de l’acompte ; absent sans crédit', async () => {
    const octets = await pdfDevis(devis({ deductionCredit: 5000 }));
    expect(octets.byteLength).toBeLessThan(300 * 1024);
    const t = await texteDuPdf(octets);
    expect(t).toContain('Déduction du crédit client');
    expect(t).toContain('- 5 000 FCFA');
    expect(t).toContain("Reste à payer sur l'acompte");
    expect(t).toContain('20 000 FCFA');
    expect(await texteDuPdf(await pdfDevis(devis()))).not.toContain('crédit client');
  });

  it('facture d’acompte : montant de l’acompte inchangé, déduction et reste à payer ; facture de solde : pas de mention', async () => {
    const octets = await pdfFacture(factureAcompte({ deductionCredit: 5000 }));
    expect(octets.byteLength).toBeLessThan(300 * 1024);
    const t = await texteDuPdf(octets);
    expect(t).toContain('Net à payer : 25 000 FCFA.');
    expect(t).toContain('Déduction du crédit client : 5 000 FCFA');
    expect(t).toContain("Reste à payer sur l'acompte : 20 000 FCFA.");
    expect(await texteDuPdf(await pdfFacture(factureAcompte({ type: 'solde', deductionCredit: 5000 })))).not.toContain('crédit client');
  });
});
