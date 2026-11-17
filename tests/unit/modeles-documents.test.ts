// POST-05 : modèles de documents personnalisables — catalogue, validation (blocs obligatoires,
// variables inconnues, sections verrouillées), rendu des blocs et de l'ordre, rendu d'origine inchangé.
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { pdfAccuseReception, pdfDevis, pdfFacture, pdfRecu, type DonneesDevisPdf, type DonneesFacturePdf } from '@/lib/documents/modeles';
import { genererAttestation, type DonneesAttestation } from '@/lib/propositions/pdf';
import { apercuPdf } from '@/lib/documents/apercu';
import { SOUS_TITRE_PAR_DEFAUT } from '@/lib/documents/mise-en-page';
import {
  DOCUMENTS,
  erreurOrdre,
  erreursModele,
  gabarit,
  memeContenu,
  modeleOrigine,
  nettoyerModele,
  normaliserModele,
  TYPES_DOCUMENT_CODES,
  type ContenuModele,
  type TypeDocument,
} from '@/lib/documents/personnalisation';
import { remplacerVariables, variablesDe } from '@/lib/modeles/variables';
import { peut } from '@/lib/authz/permissions';

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
const empreinte = async (o: Uint8Array) => createHash('sha256').update(await flux(o)).digest('hex');
const texteDuPdf = async (o: Uint8Array) => [...(await flux(o)).matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1]!, 'hex').toString('latin1')).join('\n');

const MENTIONS = 'NEXCLEAN SARL — Akwa, Douala — RCCM : RC/DLA/2026/B/0001';
const CLIENT = { nom: 'Hôtel du Lac', contact: 'M. Kamga', whatsapp: '+237 699 00 11 22', email: 'contact@hotel-lac.cm', ville: 'Kribi' };

const DEVIS: DonneesDevisPdf = {
  type: 'devis',
  numero: 'DEV-2026-00001',
  version: 1,
  numeroDossier: 'REC-2026-0042',
  date: new Date('2026-11-04T10:00:00Z'),
  validiteJours: 15,
  expireLe: new Date('2026-11-19T10:00:00Z'),
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
  conditions: 'Le client règle l’acompte.',
  conditionsParticulieres: 'Entretiens le matin.',
  mentionsLegales: MENTIONS,
  deductionCredit: 5000,
};
const FACTURE: DonneesFacturePdf = {
  type: 'acompte',
  numero: 'FAC-2026-00001',
  emiseLe: new Date('2026-11-05T09:00:00Z'),
  numeroDossier: 'REC-2026-0042',
  libelle: 'Acompte de 50 %',
  devis: { numero: 'DEV-2026-00001', version: 1 },
  client: CLIENT,
  lignes: [{ libelle: 'Acompte', quantite: 1, prixUnitaire: 25000, montantHt: 25000 }],
  tauxTva: 0,
  totalHt: 25000,
  montantTva: 0,
  totalTtc: 25000,
  mentionsLegales: MENTIONS,
  deductionCredit: 5000,
};
const ACCUSE = { numeroDossier: 'REC-2026-0042', creeLe: new Date('2026-11-03T08:00:00Z'), client: CLIENT, postes: [{ intitule: 'Cuisinière', nombre: 2 }], mentionsLegales: MENTIONS };
const RECU = {
  numero: 'REÇ-2026-00001',
  recuLe: '2026-11-06',
  emisLe: new Date('2026-11-06T10:00:00Z'),
  numeroDossier: 'REC-2026-0042',
  client: CLIENT,
  nature: 'Acompte',
  moyen: 'Orange Money',
  reference: 'OM123',
  montant: 25000,
  devis: { numero: 'DEV-2026-00001', version: 1 },
  situation: { libelleBase: 'Montant du devis', base: 50000, totalRegle: 25000 },
  mentionsLegales: MENTIONS,
};
const ATTESTATION: DonneesAttestation = {
  numeroDossier: 'REC-2026-0042',
  client: 'Hôtel du Lac',
  contact: 'M. Kamga',
  candidatPrenom: 'Awa',
  candidatNom: 'Ngo',
  poste: 'Serveuse',
  datePrevue: '2026-11-10',
  garantieJours: 15,
  etablieLe: new Date('2026-11-11T10:00:00Z'),
  mentionsLegales: MENTIONS,
};

/** Modèle d'origine modifié. */
const avec = (type: TypeDocument, blocs: Record<string, string> = {}, ordre?: string[]): ContenuModele => {
  const o = modeleOrigine(type);
  return { blocs: { ...o.blocs, ...blocs }, ordre: ordre ?? o.ordre };
};

describe('RG-08 : sans personnalisation, rendu identique à celui d’avant POST-05', () => {
  // Empreintes SHA-256 des flux de contenu, relevées sur le code d'avant POST-05 (mêmes données).
  const AVANT = {
    devis: '6c2112cde88a2788b4d54801a69b976fb8065fb0995ec36c1bb9ba281138966e',
    avenant: 'd09cada120a5a9ea022046f71a6ea46af6ada041439bfc9507a44aabf4a77df0',
    facture: 'bc5491052311a0cb5d20d004e50f00724d70133d8ea194a3b9b2dff9f8843b72',
    avoir: '866aaae0f14294af02d6e03d8ffda044c83d96f064a6caad8e68e98169ce693e',
    accuse: '600eb0aaf20a95583d1166c520530680a428e04f071f2352653310607b465658',
    recu: 'd16a5ce64b46715c252757c4cae6f56af8d370fe3cd65d1cf71df2c5537b5c54',
    attestation: '0f11113fa13ee5eba7942155bb19744cb772ebd9e3920c2027ebbea99385dc28',
    attestationConfirmee: '7ebebbfaab3f2709770f8f912873073db0416e844a350b630595c4f479cc18bc',
  };
  const AVENANT: DonneesDevisPdf = { ...DEVIS, type: 'avenant', devisInitial: { numero: 'DEV-2026-00000', version: 2 }, prolongationJours: 10, deductionCredit: 0 };
  const AVOIR: DonneesFacturePdf = { ...FACTURE, type: 'avoir', factureOrigine: { numero: 'FAC-2026-00000', emiseLe: new Date('2026-11-01T09:00:00Z') }, deductionCredit: 0 };
  const CONFIRMEE: DonneesAttestation = { ...ATTESTATION, contact: undefined, confirmation: { datePriseDePoste: '2026-11-10', signataireNom: 'Jean', signataireFonction: 'DRH', confirmeLe: new Date('2026-11-11T09:00:00Z') } };

  it('sans modèle', async () => {
    expect(await empreinte(await pdfDevis(DEVIS))).toBe(AVANT.devis);
    expect(await empreinte(await pdfDevis(AVENANT))).toBe(AVANT.avenant);
    expect(await empreinte(await pdfFacture(FACTURE))).toBe(AVANT.facture);
    expect(await empreinte(await pdfFacture(AVOIR))).toBe(AVANT.avoir);
    expect(await empreinte(await pdfAccuseReception(ACCUSE))).toBe(AVANT.accuse);
    expect(await empreinte(await pdfRecu(RECU))).toBe(AVANT.recu);
    expect(await empreinte(await genererAttestation(ATTESTATION))).toBe(AVANT.attestation);
    expect(await empreinte(await genererAttestation(CONFIRMEE))).toBe(AVANT.attestationConfirmee);
  });

  it('avec le modèle d’origine explicite (version 0)', async () => {
    expect(await empreinte(await pdfDevis({ ...DEVIS, modele: modeleOrigine('devis') }))).toBe(AVANT.devis);
    expect(await empreinte(await pdfFacture({ ...AVOIR, modele: modeleOrigine('avoir') }))).toBe(AVANT.avoir);
    expect(await empreinte(await pdfAccuseReception({ ...ACCUSE, modele: modeleOrigine('accuse_reception') }))).toBe(AVANT.accuse);
    expect(await empreinte(await pdfRecu({ ...RECU, modele: modeleOrigine('recu') }))).toBe(AVANT.recu);
    expect(await empreinte(await genererAttestation({ ...CONFIRMEE, modele: modeleOrigine('attestation') }))).toBe(AVANT.attestationConfirmee);
  });

  it('sous-titre d’en-tête par défaut identique dans le catalogue et la mise en page', () => {
    for (const t of TYPES_DOCUMENT_CODES) expect(DOCUMENTS[t].blocs.entete!.defaut).toBe(SOUS_TITRE_PAR_DEFAUT);
  });
});

describe('RG-14 : accès réservé au droit modeles.gerer', () => {
  it('Direction et Administrateur seulement', () => {
    expect(peut(['direction'], 'modeles.gerer')).toBe(true);
    expect(peut(['admin'], 'modeles.gerer')).toBe(true);
    expect(peut(['referent'], 'modeles.gerer')).toBe(false);
    expect(peut(['finances'], 'modeles.gerer')).toBe(false);
  });
});

describe('Catalogue (RG-01, RG-02, RG-05, RG-06)', () => {
  it.each(TYPES_DOCUMENT_CODES)('%s : modèle d’origine valide, blocs rattachés à des sections connues, variables déclarées', (t) => {
    const def = DOCUMENTS[t];
    expect(erreursModele(t, modeleOrigine(t))).toEqual([]);
    for (const b of Object.values(def.blocs)) {
      expect(def.sections[b.section], b.libelle).toBeDefined();
      expect(b.defaut.length).toBeLessThanOrEqual(b.max);
    }
    expect(def.ordre).not.toContain('page');
    for (const s of def.ordre) expect(def.sections[s]).toBeDefined();
    expect(def.blocs.entete?.section).toBe('page');
    expect(def.blocs.pied?.section).toBe('page');
    expect(def.blocs.complement).toBeDefined();
  });

  it('montants et destinataire verrouillés partout où ils existent ; signature du devis en dernier', () => {
    for (const t of TYPES_DOCUMENT_CODES) {
      for (const s of ['destinataire', 'montants']) if (DOCUMENTS[t].sections[s]) expect(DOCUMENTS[t].sections[s]!.verrou, `${t}/${s}`).toBeTruthy();
    }
    expect(DOCUMENTS.devis.ordre.at(-1)).toBe('signature');
    expect(DOCUMENTS.devis.sections.signature!.verrou).toBeTruthy();
    expect(DOCUMENTS.recu.sections.details!.verrou).toBeTruthy();
  });

  it('chaque type a au moins une section déplaçable', () => {
    for (const t of TYPES_DOCUMENT_CODES) expect(DOCUMENTS[t].ordre.filter((s) => !DOCUMENTS[t].sections[s]!.verrou).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Validation (RG-03, RG-05, RG-07)', () => {
  it('bloc obligatoire vide refusé ; bloc facultatif vide accepté', () => {
    expect(erreursModele('devis', avec('devis', { modalites_titre: '   ' }))).toEqual(['« Titre de la section » (Modalités) ne peut pas être vide.']);
    expect(erreursModele('accuse_reception', avec('accuse_reception', { conclusion: '' }))).toEqual([]);
  });

  it('variable inconnue refusée avec le nom du bloc ; variable d’un autre type refusée', () => {
    expect(erreursModele('devis', avec('devis', { introduction: 'Bonjour {{client.telephone}}' }))).toEqual(['Variable inconnue dans « Introduction (sous le titre) » : client.telephone']);
    expect(erreursModele('facture', avec('facture', { paiement: '{{ recu.montant }}' }))).toEqual(['Variable inconnue dans « Consignes de paiement » : recu.montant']);
    expect(erreursModele('facture', avec('facture', { paiement: '{{constructor}}' }))).toEqual(['Variable inconnue dans « Consignes de paiement » : constructor']);
    expect(erreursModele('facture', avec('facture', { paiement: 'Réf. {{ facture.numero }}' }))).toEqual([]);
  });

  it('longueur maximale, bloc inconnu, bloc manquant', () => {
    expect(erreursModele('attestation', avec('attestation', { complement: 'x'.repeat(601) }))).toEqual(['« Texte complémentaire » : 600 caractères maximum.']);
    expect(erreursModele('avoir', avec('avoir', { inconnu: 'x' }))).toEqual(['Bloc inconnu : inconnu']);
    const sans = Object.fromEntries(Object.entries(modeleOrigine('avoir').blocs).filter(([k]) => k !== 'explication'));
    expect(erreursModele('avoir', { blocs: sans, ordre: modeleOrigine('avoir').ordre })).toEqual(['Bloc manquant : Explication']);
  });

  it('ordre : permutation des sections déplaçables seulement', () => {
    expect(erreurOrdre('devis', ['destinataire', 'montants', 'conditions', 'complement', 'modalites', 'signature'])).toBeNull();
    expect(erreurOrdre('devis', ['destinataire', 'modalites', 'montants', 'conditions', 'complement', 'signature'])).toBe('La section « Montants » est verrouillée : elle reste à sa place.');
    expect(erreurOrdre('devis', ['destinataire', 'montants', 'modalites', 'conditions', 'signature', 'complement'])).toBe('La section « Signature (bon pour accord) » est verrouillée : elle reste à sa place.');
    expect(erreurOrdre('devis', ['destinataire', 'montants', 'modalites', 'modalites', 'complement', 'signature'])).toBe('Ordre des sections invalide.');
    expect(erreurOrdre('devis', ['destinataire', 'montants', 'modalites', 'conditions', 'signature'])).toBe('Ordre des sections invalide.');
    expect(erreurOrdre('recu', ['destinataire', 'avertissement', 'details', 'declaration', 'complement'])).toBeNull();
  });

  it('nettoyage : fins de ligne et espaces de bord ; comparaison de contenus', () => {
    const n = nettoyerModele('avoir', avec('avoir', { explication: '  Ligne 1\r\nLigne 2  ' }));
    expect(n.blocs.explication).toBe('Ligne 1\nLigne 2');
    expect(memeContenu(n, modeleOrigine('avoir'))).toBe(false);
    expect(memeContenu(nettoyerModele('avoir', modeleOrigine('avoir')), modeleOrigine('avoir'))).toBe(true);
  });
});

describe('Normalisation d’une version lue en base (cas limites)', () => {
  it('bloc manquant → texte d’origine ; bloc inconnu ignoré ; ordre devenu invalide → ordre d’origine', () => {
    const m = normaliserModele('devis', { blocs: { introduction: 'Intro', ancien: 'x' }, ordre: ['destinataire', 'montants', 'modalites'] });
    expect(m.blocs.introduction).toBe('Intro');
    expect(m.blocs.modalites_titre).toBe('Modalités');
    expect(m.blocs).not.toHaveProperty('ancien');
    expect(m.ordre).toEqual(DOCUMENTS.devis.ordre);
    expect(normaliserModele('recu', null)).toEqual(modeleOrigine('recu'));
  });
});

describe('Rendu des blocs et variables (RG-02, RG-06)', () => {
  it('remplacement des variables ; valeur absente → chaîne vide', () => {
    expect(remplacerVariables('A {{ x }} B {{y}} C {{toString}}', { x: '1' })).toBe('A 1 B  C ');
    const g = gabarit('devis', avec('devis', { introduction: 'Offre pour {{client.nom}} ({{devis.initial}})' }), { 'client.nom': 'Hôtel du Lac', 'devis.initial': '' });
    expect(g.texte('introduction')).toBe('Offre pour Hôtel du Lac ()');
    expect(variablesDe(DOCUMENTS.recu.blocs.declaration!.defaut)).toEqual(['recu.montant', 'recu.montant_lettres', 'recu.recu_le']);
  });

  it('devis : introduction personnalisée, titres, légende de signature, texte complémentaire', async () => {
    const t = await texteDuPdf(
      await pdfDevis({
        ...DEVIS,
        modele: avec('devis', { introduction: 'Offre préparée pour {{client.nom}}, valable {{devis.validite}}.', modalites_titre: 'Nos modalités', signature_legende: 'Cachet', complement: 'Texte libre {{devis.acompte}}' }),
      }),
    );
    expect(t).toContain('Offre préparée pour Hôtel du Lac, valable 15 jours.');
    expect(t).not.toContain('Recrutement de personnel');
    expect(t).toContain('Nos modalités');
    expect(t).toContain('Cachet');
    expect(t).toContain('Texte libre 25 000 FCFA');
    // Les montants restent présents (section verrouillée).
    expect(t).toContain('TVA non applicable');
  });

  it('accusé de réception : conclusion vidée → absente ; étapes personnalisées numérotées', async () => {
    const t = await texteDuPdf(await pdfAccuseReception({ ...ACCUSE, modele: avec('accuse_reception', { conclusion: '', etapes: 'Premier appel\n\nDevis sous 48 h' }) }));
    expect(t).not.toContain('Suivez votre demande');
    expect(t).toContain('1. Premier appel');
    expect(t).toContain('2. Devis sous 48 h');
    expect(t).not.toContain('3.');
  });

  it('facture : consignes vidées, complément de pied de page sur chaque page, sous-titre supprimé', async () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ({ libelle: `Ligne ${i + 1}`, quantite: 1, prixUnitaire: 1000, montantHt: 1000 }));
    const octets = await pdfFacture({ ...FACTURE, lignes, modele: avec('facture', { paiement: '', pied: 'IBAN : CM00 0000 {{facture.numero}}', entete: '' }) });
    const t = await texteDuPdf(octets);
    const pages = (await PDFDocument.load(octets)).getPageCount();
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(t).not.toContain("Merci d'indiquer");
    expect(t.split('IBAN : CM00 0000 FAC-2026-00001').length - 1).toBe(pages);
    expect(t).not.toContain(SOUS_TITRE_PAR_DEFAUT);
    expect(t).toContain('Net à payer : 25 000 FCFA.');
  });

  it('avoir : explication et variables propres à l’avoir', async () => {
    const t = await texteDuPdf(
      await pdfFacture({ ...FACTURE, type: 'avoir', factureOrigine: { numero: 'FAC-2026-00000', emiseLe: new Date('2026-11-01T09:00:00Z') }, modele: avec('avoir', { explication: 'Avoir {{avoir.numero}} sur {{facture_origine.numero}} : {{avoir.montant}}.' }) }),
    );
    expect(t).toContain('Avoir FAC-2026-00001 sur FAC-2026-00000 : 25 000 FCFA.');
  });

  it('reçu : déclaration personnalisée avec le montant en lettres', async () => {
    const t = await texteDuPdf(await pdfRecu({ ...RECU, modele: avec('recu', { declaration: 'Reçu {{recu.montant_lettres}} francs par {{recu.moyen}}.' }) }));
    expect(t).toContain('Reçu vingt-cinq mille francs par Orange Money.');
  });

  it('attestation : textes personnalisés, retours à la ligne conservés, garantie vidée', async () => {
    const t = await texteDuPdf(
      await genererAttestation({ ...ATTESTATION, modele: avec('attestation', { titre: 'Attestation d’embauche', constat: 'a pris son poste chez {{client.nom}}.\nDossier {{dossier.numero}}.', garantie: '', signature_titre: 'Pour le client' }) }),
    );
    expect(t).toContain("Attestation d'embauche");
    expect(t).toContain('a pris son poste chez Hôtel du Lac.');
    expect(t).toContain('Dossier REC-2026-0042.');
    expect(t).not.toContain('Garantie de remplacement');
    expect(t).toContain('Pour le client');
  });
});

describe('Ordre des sections (RG-05)', () => {
  it('devis : « Conditions » avant « Modalités » quand l’ordre est inversé', async () => {
    const position = async (ordre?: string[]) => {
      const t = await texteDuPdf(await pdfDevis({ ...DEVIS, modele: avec('devis', {}, ordre) }));
      return { conditions: t.indexOf('Conditions générales'), modalites: t.indexOf('Modalités'), signature: t.indexOf('Bon pour accord') };
    };
    const origine = await position();
    expect(origine.modalites).toBeLessThan(origine.conditions);
    const inverse = await position(['destinataire', 'montants', 'conditions', 'modalites', 'complement', 'signature']);
    expect(inverse.conditions).toBeLessThan(inverse.modalites);
    expect(inverse.modalites).toBeLessThan(inverse.signature);
  });

  it('accusé de réception : introduction déplacée après les postes', async () => {
    const t = await texteDuPdf(await pdfAccuseReception({ ...ACCUSE, modele: avec('accuse_reception', { introduction: 'INTRO-MARQUEUR' }, ['destinataire', 'postes', 'introduction', 'etapes', 'conclusion', 'complement']) }));
    expect(t.indexOf('Postes demandés')).toBeLessThan(t.indexOf('INTRO-MARQUEUR'));
  });

  it('un ordre invalide reçu par le rendu retombe sur l’ordre d’origine (sections verrouillées jamais déplacées)', async () => {
    const t = await texteDuPdf(await pdfDevis({ ...DEVIS, modele: { blocs: modeleOrigine('devis').blocs, ordre: ['signature', 'montants', 'modalites', 'conditions', 'complement', 'destinataire'] } }));
    expect(t.indexOf('Modalités')).toBeLessThan(t.indexOf('Bon pour accord'));
  });
});

describe('Aperçu avec données d’exemple (RG-13)', () => {
  it.each(TYPES_DOCUMENT_CODES)('%s : PDF valide < 300 Ko avec un marqueur dans chaque bloc modifiable', async (t) => {
    const def = DOCUMENTS[t];
    const blocs = Object.fromEntries(Object.keys(def.blocs).map((k) => [k, `M-${k}`]));
    const octets = await apercuPdf(t, { blocs, ordre: def.ordre }, MENTIONS);
    expect(octets.byteLength).toBeLessThan(300 * 1024);
    const texte = (await texteDuPdf(octets)).replaceAll('\n', ' ');
    expect(texte).toMatch(/exemple/i);
    for (const k of Object.keys(def.blocs)) {
      // Phrase de l'avenant : seulement sur un avenant (l'exemple est un devis).
      if (t === 'devis' && k === 'introduction_avenant') continue;
      expect(texte, `${t}/${k}`).toContain(`M-${k}`);
    }
  });
});
