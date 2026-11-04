// MVP2-04 lot B : modèles PDF (devis, facture, avoir, accusé de réception) — rendu valide, texte
// attendu, accents, mention TVA, police ≥ 10 pt, pagination et poids < 300 Ko (RG-16, RG-19, RG-20).
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { pdfAccuseReception, pdfDevis, pdfFacture, type DonneesDevisPdf, type DonneesFacturePdf } from '@/lib/documents/modeles';
import { genererAttestation } from '@/lib/propositions/pdf';

/** Flux de contenu décompressés d'un PDF produit par pdf-lib. */
async function flux(octets: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(octets);
  let brut = '';
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filtre = obj.dict.get(PDFName.of('Filter'));
    brut += (filtre === PDFName.of('FlateDecode') ? inflateSync(Buffer.from(obj.contents)) : Buffer.from(obj.contents)).toString('latin1');
  }
  return brut;
}

/** Texte affiché (chaînes hexadécimales WinAnsi des opérateurs Tj). */
async function texteDuPdf(octets: Uint8Array): Promise<string> {
  return [...(await flux(octets)).matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('\n');
}

/** Tailles de police utilisées (opérateurs Tf). */
async function taillesPolice(octets: Uint8Array): Promise<number[]> {
  return [...(await flux(octets)).matchAll(/\/\S+ ([\d.]+) Tf/g)].map((m) => Number(m[1]));
}

const MENTIONS = 'NEXCLEAN SARL — Akwa, Douala — RCCM : RC/DLA/2026/B/0001 — NIU : M0123456789 — Tél. +237 699 00 11 22';
const CLIENT = { nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237 699 00 11 22', email: 'contact@hotel-lac.cm', ville: 'Kribi' };

const devis = (o: Partial<DonneesDevisPdf> = {}): DonneesDevisPdf => ({
  type: 'devis',
  numero: 'DEV-2026-00001',
  version: 1,
  numeroDossier: 'REC-2026-0042',
  date: new Date('2026-11-04T10:00:00Z'),
  validiteJours: 15,
  expireLe: new Date('2026-11-19T10:00:00Z'),
  client: CLIENT,
  lignes: [{ intitule: 'Serveur (hôtellerie)', nombre: 10, commission: 5000, montantHt: 50000 }],
  tauxTva: 0,
  totalHt: 50000,
  montantTva: 0,
  totalTtc: 50000,
  tauxAcompte: 50,
  acompte: 25000,
  delaiRechercheJours: 30,
  garantieJours: 15,
  conditions: 'Le client règle l’acompte à l’acceptation.\nLe solde est dû à la clôture de la recherche.',
  conditionsParticulieres: 'Entretiens à l’hôtel, de préférence le matin.',
  mentionsLegales: MENTIONS,
  ...o,
});

const facture = (o: Partial<DonneesFacturePdf> = {}): DonneesFacturePdf => ({
  type: 'acompte',
  numero: 'FAC-2026-00001',
  emiseLe: new Date('2026-11-05T09:00:00Z'),
  numeroDossier: 'REC-2026-0042',
  libelle: 'Acompte de 50 % sur le devis DEV-2026-00001 (version 1)',
  devis: { numero: 'DEV-2026-00001', version: 1 },
  client: CLIENT,
  lignes: [{ libelle: 'Acompte 50 % — devis DEV-2026-00001 v1', quantite: 1, prixUnitaire: 25000, montantHt: 25000 }],
  tauxTva: 0,
  totalHt: 25000,
  montantTva: 0,
  totalTtc: 25000,
  mentionsLegales: MENTIONS,
  ...o,
});

async function verifierBase(octets: Uint8Array) {
  expect(octets.byteLength).toBeLessThan(300 * 1024);
  const doc = await PDFDocument.load(octets);
  for (const p of doc.getPages()) {
    expect(Math.round(p.getWidth())).toBe(595);
    expect(Math.round(p.getHeight())).toBe(842);
  }
  const tailles = await taillesPolice(octets);
  expect(tailles.length).toBeGreaterThan(0);
  expect(Math.min(...tailles)).toBeGreaterThanOrEqual(10);
  return doc;
}

describe('Devis PDF (RG-16, RG-19, RG-20)', () => {
  it('devis TVA 0 % : titre, client accentué, lignes, « TVA non applicable », acompte, modalités, conditions, bon pour accord, mentions légales', async () => {
    const octets = await pdfDevis(devis());
    await verifierBase(octets);
    const t = await texteDuPdf(octets);
    expect(t).toContain('NEXCLEAN');
    expect(t).toContain('Devis DEV-2026-00001 - version 1');
    expect(t).toContain('Hôtel du Lac');
    expect(t).toContain('Serveur (hôtellerie)');
    expect(t).toContain('5 000 FCFA');
    expect(t).toContain('50 000 FCFA');
    expect(t).toContain('TVA non applicable');
    expect(t).not.toContain('TTC');
    expect(t).toContain('Acompte à la commande (50 %)');
    expect(t).toContain('25 000 FCFA');
    expect(t).toContain('30 jours');
    expect(t).toContain('15 jours');
    expect(t).toContain('19 novembre 2026');
    expect(t).toContain("Le client règle l'acompte à l'acceptation.");
    expect(t).toContain('Conditions particulières');
    expect(t).toContain('Bon pour accord');
    expect(t).toContain('RCCM : RC/DLA/2026/B/0001');
    expect(t).toContain('Page 1 / 1');
  });

  it('devis TVA 19 % : HT / TVA / TTC', async () => {
    const t = await texteDuPdf(await pdfDevis(devis({ tauxTva: 19, montantTva: 9500, totalTtc: 59500, acompte: 29800 })));
    expect(t).toContain('Total HT');
    expect(t).toContain('TVA 19 %');
    expect(t).toContain('9 500 FCFA');
    expect(t).toContain('Total TTC');
    expect(t).toContain('59 500 FCFA');
    expect(t).not.toContain('TVA non applicable');
  });

  it('avenant : « Avenant n° … au devis … »', async () => {
    const t = await texteDuPdf(await pdfDevis(devis({ type: 'avenant', numero: 'DEV-2026-00007', devisInitial: { numero: 'DEV-2026-00001', version: 2 }, prolongationJours: 15 })));
    expect(t).toContain('AVENANT');
    expect(t.replaceAll('\n', ' ')).toContain('Avenant n° DEV-2026-00007 au devis DEV-2026-00001 - version 1');
    expect(t).toContain('15 jours supplémentaires');
  });

  it('pagination : 30 lignes → plusieurs pages, en-tête de tableau répété, « Page i / n », < 300 Ko', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({ intitule: `Poste n° ${i + 1} — agent polyvalent d’entretien et de maintenance des espaces communs`, nombre: 2, commission: 5000, montantHt: 10000 }));
    const octets = await pdfDevis(devis({ lignes, totalHt: 300000, totalTtc: 300000, acompte: 150000 }));
    const doc = await verifierBase(octets);
    const n = doc.getPageCount();
    expect(n).toBeGreaterThanOrEqual(2);
    const t = await texteDuPdf(octets);
    expect(t).toContain(`Page ${n} / ${n}`);
    expect(t).toContain('Poste n° 30');
    expect(t.split('Montant HT').length - 1).toBeGreaterThanOrEqual(2);
    // Mentions légales sur chaque page.
    expect(t.split('RCCM : RC/DLA/2026/B/0001').length - 1).toBe(n);
  });

  it('caractères hors WinAnsi remplacés sans erreur', async () => {
    const t = await texteDuPdf(await pdfDevis(devis({ client: { ...CLIENT, nom: 'Œuvre « Ndolè » 😀' } })));
    expect(t).toContain('OEuvre " Ndolè " ?');
  });
});

describe('Factures et avoirs PDF', () => {
  it('facture d’acompte : numéro, date d’émission, client figé, lignes, mention TVA', async () => {
    const octets = await pdfFacture(facture());
    await verifierBase(octets);
    const t = await texteDuPdf(octets);
    expect(t).toContain("FACTURE D'ACOMPTE");
    expect(t).toContain('FAC-2026-00001');
    expect(t).toContain('Émise le 5 novembre 2026');
    expect(t).toContain('Hôtel du Lac');
    expect(t).toContain('devis DEV-2026-00001 (version 1)');
    expect(t).toContain('TVA non applicable');
    expect(t).toContain('Net à payer : 25 000 FCFA.');
  });

  it('facture de solde TVA 19 % : HT / TVA / TTC, ligne de déduction négative', async () => {
    const t = await texteDuPdf(
      await pdfFacture(
        facture({
          type: 'solde',
          numero: 'FAC-2026-00002',
          tauxTva: 19,
          lignes: [
            { libelle: 'Serveur — 7 placements confirmés', quantite: 7, prixUnitaire: 5000, montantHt: 35000 },
            { libelle: 'Déduction de l’acompte facturé (FAC-2026-00001)', quantite: 1, prixUnitaire: -25000, montantHt: -25000 },
          ],
          totalHt: 10000,
          montantTva: 1900,
          totalTtc: 11900,
        }),
      ),
    );
    expect(t).toContain('FACTURE DE SOLDE');
    expect(t).toContain('TVA 19 %');
    expect(t).toContain('Total TTC');
    expect(t).toContain('11 900 FCFA');
    expect(t).toContain('-25 000 FCFA');
  });

  it('avoir : « AVOIR » et référence de la facture d’origine', async () => {
    const octets = await pdfFacture(facture({ type: 'avoir', numero: 'FAC-2026-00003', factureOrigine: { numero: 'FAC-2026-00001', emiseLe: new Date('2026-11-05T09:00:00Z') }, totalHt: 5000, totalTtc: 5000 }));
    await verifierBase(octets);
    const t = await texteDuPdf(octets);
    expect(t).toContain('AVOIR');
    expect(t).toContain('Sur la facture FAC-2026-00001');
    expect(t).toContain("Montant de l'avoir HT");
    expect(t).not.toContain('Net à payer');
  });
});

describe('Accusé de réception et attestation', () => {
  it('accusé de réception : numéro de dossier, date, client, postes, prochaines étapes, renvoi au lien WhatsApp', async () => {
    const octets = await pdfAccuseReception({ numeroDossier: 'REC-2026-0042', creeLe: new Date('2026-11-03T08:00:00Z'), client: CLIENT, postes: [{ intitule: 'Cuisinière', nombre: 2 }, { intitule: 'Serveur', nombre: 3 }], mentionsLegales: MENTIONS });
    await verifierBase(octets);
    const t = await texteDuPdf(octets);
    expect(t).toContain('ACCUSÉ DE RÉCEPTION');
    expect(t).toContain('REC-2026-0042');
    expect(t).toContain('3 novembre 2026');
    expect(t).toContain('Cuisinière');
    expect(t).toContain('Prochaines étapes');
    expect(t).toContain('Suivez votre demande via le lien reçu par WhatsApp.');
    expect(t).not.toContain('/suivi/');
  });

  it('attestation : en-tête et mentions légales communs, police ≥ 10 pt', async () => {
    const octets = await genererAttestation({ numeroDossier: 'REC-2026-0042', client: 'Hôtel du Lac', candidatPrenom: 'Awa', candidatNom: 'Ngo', poste: 'Serveuse', datePrevue: '2026-11-10', garantieJours: 15, mentionsLegales: MENTIONS });
    await verifierBase(octets);
    const t = await texteDuPdf(octets);
    expect(t).toContain('ATTESTATION');
    expect(t).toContain('RCCM : RC/DLA/2026/B/0001');
  });
});
