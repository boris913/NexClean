// Côté client des Propositions (specs/MVP2-03 RG-07, RG-09, RG-15) : cookie de vérification signé,
// comparaison des 4 chiffres, filigrane des CV, attestation PDF.
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from 'pdf-lib';
import { chiffresCorrects, DUREE_VERIFICATION_MS, signerVerification, verificationValide } from '@/lib/propositions/client';
import { filigranerPdf, genererAttestation, imageFiligranee, normaliserTexte } from '@/lib/propositions/pdf';

const SECRET = 'secret-de-test-uniquement-0123456789abcdef';
const JETON = 'jeton-de-suivi-abcdefghijklmnopqrstuvwxyz';

describe('Cookie de vérification (RG-07)', () => {
  const t0 = 1_800_000_000_000;
  const valeur = signerVerification({ portee: 'dossier:12', jeton: JETON, expireLe: t0 + DUREE_VERIFICATION_MS }, SECRET);

  it('valide pour la même portée, le même jeton, avant expiration', () => {
    expect(verificationValide(valeur, { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(true);
  });

  it('refusé : expiré, autre portée, jeton régénéré, autre secret, valeur altérée ou absente', () => {
    expect(verificationValide(valeur, { portee: 'dossier:12', jeton: JETON }, SECRET, t0 + DUREE_VERIFICATION_MS + 1)).toBe(false);
    expect(verificationValide(valeur, { portee: 'dossier:13', jeton: JETON }, SECRET, t0)).toBe(false);
    expect(verificationValide(valeur, { portee: 'acces:12', jeton: JETON }, SECRET, t0)).toBe(false);
    expect(verificationValide(valeur, { portee: 'dossier:12', jeton: `${JETON}x` }, SECRET, t0)).toBe(false);
    expect(verificationValide(valeur, { portee: 'dossier:12', jeton: JETON }, `${SECRET}x`, t0)).toBe(false);
    const [exp, sig] = valeur.split('.');
    expect(verificationValide(`${Number(exp) + 1000}.${sig}`, { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(false);
    expect(verificationValide(`${exp}.${sig!.slice(0, -1)}${sig!.endsWith('A') ? 'B' : 'A'}`, { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(false);
    expect(verificationValide(undefined, { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(false);
    expect(verificationValide('n’importe quoi', { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(false);
  });

  it('refusé : expiration au-delà de la durée maximale (cookie forgé à longue durée)', () => {
    const long = signerVerification({ portee: 'dossier:12', jeton: JETON, expireLe: t0 + 10 * DUREE_VERIFICATION_MS }, SECRET);
    expect(verificationValide(long, { portee: 'dossier:12', jeton: JETON }, SECRET, t0)).toBe(false);
  });

  it('4 derniers chiffres du WhatsApp', () => {
    expect(chiffresCorrects('1122', '+237699001122')).toBe(true);
    expect(chiffresCorrects(' 11-22 ', '+237699001122')).toBe(true);
    expect(chiffresCorrects('1123', '+237699001122')).toBe(false);
    expect(chiffresCorrects('122', '+237699001122')).toBe(false);
    expect(chiffresCorrects('', '+237699001122')).toBe(false);
  });
});

/** Texte affiché d'un PDF produit par pdf-lib (flux de contenu, chaînes hexadécimales WinAnsi). */
async function texteDuPdf(octets: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(octets);
  let brut = '';
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const filtre = obj.dict.get(PDFName.of('Filter'));
    const contenu = filtre === PDFName.of('FlateDecode') ? inflateSync(Buffer.from(obj.contents)) : Buffer.from(obj.contents);
    brut += contenu.toString('latin1');
  }
  return [...brut.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('\n');
}

async function pdfDeTest(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]).drawText(`CV page ${i + 1}`, { x: 50, y: 700, size: 14, font: police });
  return doc.save();
}

describe('Filigrane des CV (RG-09)', () => {
  const texte = 'Transmis par NEXCLEAN à Hôtel du Lac le 4 novembre 2026';

  it('chaque page porte le filigrane ; le PDF reste valide', async () => {
    const sortie = await filigranerPdf(await pdfDeTest(3), texte);
    const doc = await PDFDocument.load(sortie);
    expect(doc.getPageCount()).toBe(3);
    const contenu = await texteDuPdf(sortie);
    // Diagonale + pied de page, sur chacune des 3 pages.
    expect(contenu.split(texte).length - 1).toBe(6);
  });

  it('un fichier qui n’est pas un PDF est refusé', async () => {
    await expect(filigranerPdf(new TextEncoder().encode('pas un pdf'), texte)).rejects.toThrow();
  });

  it('CV image PNG → PDF d’une page filigranée ; autre format → null', async () => {
    // PNG 1×1 transparent.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const sortie = await imageFiligranee(png, 'image/png', texte);
    expect(sortie).not.toBeNull();
    expect((await PDFDocument.load(sortie!)).getPageCount()).toBe(1);
    expect(await texteDuPdf(sortie!)).toContain(texte);
    expect(await imageFiligranee(png, 'image/webp', texte)).toBeNull();
  });
});

describe('Attestation de prise de poste (RG-15)', () => {
  it('normalisation WinAnsi : apostrophes typographiques, espaces insécables, caractères hors jeu', () => {
    expect(normaliserTexte('L’équipe : « ça » — ok… 😀')).toBe('L\'équipe : " ça " - ok... ?');
  });

  it('PDF A4 valide avec caractères accentués, garantie et numéro de dossier', async () => {
    const octets = await genererAttestation({
      numeroDossier: 'REC-2026-0042',
      client: 'Hôtel du Lac – Kribi',
      contact: 'M. Kamga',
      candidatPrenom: 'Hélène',
      candidatNom: 'Ngo’o Bîlé',
      poste: 'Cuisinière (cuisine camerounaise)',
      datePrevue: '2026-11-10',
      garantieJours: 15,
      etablieLe: new Date('2026-11-04T10:00:00Z'),
    });
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    const texte = await texteDuPdf(octets);
    expect(texte).toContain('NEXCLEAN');
    expect(texte).toContain('Hélène Ngo\'o Bîlé');
    expect(texte).toContain('Cuisinière (cuisine camerounaise)');
    expect(texte).toContain('10 novembre 2026');
    expect(texte).toContain('REC-2026-0042');
    expect(texte).toContain('15 jours');
    expect(texte).toContain('Nom du signataire');
  });

  it('attestation confirmée en ligne : signataire pré-rempli', async () => {
    const octets = await genererAttestation({
      numeroDossier: 'REC-2026-0042',
      client: 'Hôtel du Lac',
      candidatPrenom: 'Awa',
      candidatNom: 'Ngo',
      poste: 'Serveuse',
      datePrevue: '2026-11-10',
      garantieJours: 30,
      confirmation: { datePriseDePoste: '2026-11-12', signataireNom: 'Paul Kamga', signataireFonction: 'Gérant', confirmeLe: new Date('2026-11-12T09:00:00Z') },
    });
    const texte = await texteDuPdf(octets);
    expect(texte).toContain('Paul Kamga');
    expect(texte).toContain('Gérant');
    expect(texte).toContain('12 novembre 2026');
  });
});
