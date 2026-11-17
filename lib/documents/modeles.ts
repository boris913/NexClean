// Modèles fixes des documents PDF (specs/MVP2-04 RG-16) : devis / avenant, facture d'acompte,
// de solde, avoir, accusé de réception, reçu d'encaissement (MVP2-05 RG-04). Fonctions pures (données → octets PDF), sans accès à la
// base : ./rendu.ts lit les valeurs figées et appelle ces modèles. Langue `fr`.
// POST-05 : textes et ordre des sections viennent du modèle de document (`modele`, version en
// vigueur à la date de référence) ; sans modèle, le modèle d'origine reproduit le rendu d'avant.
import { formaterMontant, mentionTva, TYPES_FACTURE, type LigneDevis, type TypeFacture } from '@/lib/devis/domaine';
import { dateLongue, DocumentPdf, type EnTete, type Ligne } from './mise-en-page';
import { gabarit, piedDePage, rendreSections, type ContenuModele, type Gabarit } from './personnalisation';

/** Modèle de document à appliquer (POST-05) ; absent = modèle d'origine. */
export type ModeleApplique = Partial<ContenuModele> | null | undefined;

/** Document avec le sous-titre d'en-tête et le complément de pied de page du modèle (RG-02). */
const creerDocument = (g: Gabarit, o: { titreMeta: string; mentionsLegales: string; enTete: EnTete }) =>
  DocumentPdf.creer({ titreMeta: o.titreMeta, mentionsLegales: piedDePage(o.mentionsLegales, g.texte('pied')), enTete: { ...o.enTete, sousTitre: g.texte('entete') } });

export interface ClientDocument {
  nom: string;
  contact?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  ville?: string | null;
}

const lignesClient = (c: ClientDocument) => [c.nom, c.contact ? `À l'attention de ${c.contact}` : null, c.ville, c.whatsapp ? `WhatsApp : ${c.whatsapp}` : null, c.email];

/** RG-19 : HT / TVA / TTC si taux > 0, sinon « TVA non applicable ». */
export function lignesTotaux(t: { tauxTva: number; totalHt: number; montantTva: number; totalTtc: number }, libelleTotal = 'Total'): Ligne[] {
  if (t.tauxTva > 0) {
    return [
      { libelle: 'Total HT', valeur: formaterMontant(t.totalHt) },
      { libelle: mentionTva(t.tauxTva), valeur: formaterMontant(t.montantTva) },
      { libelle: `${libelleTotal} TTC`, valeur: formaterMontant(t.totalTtc), gras: true },
    ];
  }
  return [
    { libelle: `${libelleTotal} HT`, valeur: formaterMontant(t.totalHt), gras: true },
    { libelle: mentionTva(0), valeur: '' },
  ];
}

// ─── Devis / avenant ─────────────────────────────────────────

export interface DonneesDevisPdf {
  type: 'devis' | 'avenant';
  numero: string;
  version: number;
  /** Avenant : devis initial modifié. */
  devisInitial?: { numero: string; version: number } | null;
  numeroDossier: string;
  /** Date du devis (envoi, ou validation / création à défaut). */
  date: Date;
  validiteJours: number;
  /** Date limite d'acceptation, si le devis est envoyé. */
  expireLe?: Date | null;
  client: ClientDocument;
  lignes: readonly Pick<LigneDevis, 'intitule' | 'nombre' | 'commission' | 'montantHt'>[];
  tauxTva: number;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
  tauxAcompte: number;
  acompte: number;
  delaiRechercheJours: number;
  prolongationJours?: number | null;
  garantieJours: number;
  conditions: string;
  conditionsParticulieres?: string | null;
  mentionsLegales: string;
  /** MVP2-05 RG-12 : déduction du crédit client conservée sur le devis (figée), imputée sur l'acompte. */
  deductionCredit?: number;
  /** POST-05 : modèle « devis » en vigueur à la date de référence. */
  modele?: ModeleApplique;
}

/**
 * MVP2-05 RG-12 : lignes « Déduction du crédit client » et reste à payer de l'acompte. La déduction
 * est un règlement (écriture `credit`) : l'acompte et la facture d'acompte gardent leur montant.
 */
export function lignesDeductionCredit(acompte: number, deductionCredit: number | null | undefined): Ligne[] {
  if (!deductionCredit || deductionCredit <= 0) return [];
  return [
    { libelle: 'Déduction du crédit client', valeur: `- ${formaterMontant(deductionCredit)}` },
    { libelle: "Reste à payer sur l'acompte", valeur: formaterMontant(Math.max(0, acompte - deductionCredit)), gras: true },
  ];
}

export const titreDevis = (d: Pick<DonneesDevisPdf, 'type' | 'numero' | 'version' | 'devisInitial'>) =>
  d.type === 'avenant'
    ? `Avenant n° ${d.numero}${d.devisInitial ? ` au devis ${d.devisInitial.numero}` : ''} — version ${d.version}`
    : `Devis ${d.numero} — version ${d.version}`;

/** Valeurs des variables du modèle « devis » (POST-05 RG-06). */
export const variablesDevis = (d: DonneesDevisPdf): Record<string, string> => ({
  'dossier.numero': d.numeroDossier,
  'client.nom': d.client.nom,
  'devis.numero': d.numero,
  'devis.version': String(d.version),
  'devis.initial': d.devisInitial ? `${d.devisInitial.numero} (version ${d.devisInitial.version})` : '',
  'devis.date': dateLongue(d.date),
  'devis.validite': `${d.validiteJours} jours`,
  'devis.total': formaterMontant(d.totalTtc),
  'devis.acompte': formaterMontant(d.acompte),
});

export async function pdfDevis(d: DonneesDevisPdf): Promise<Uint8Array> {
  const g = gabarit('devis', d.modele, variablesDevis(d));
  const titre = titreDevis(d);
  const doc = await creerDocument(g, {
    titreMeta: titre,
    mentionsLegales: d.mentionsLegales,
    enTete: { titre: d.type === 'avenant' ? 'AVENANT' : 'DEVIS', references: [`${d.numero} — v${d.version}`, `Dossier ${d.numeroDossier}`, `Date : ${dateLongue(d.date)}`] },
  });
  const avenant = d.type === 'avenant' && d.devisInitial ? g.texte('introduction_avenant') : '';
  const introduction = g.texte('introduction');

  rendreSections(g, {
    destinataire: () => doc.bloc('Client', lignesClient(d.client), { titre, lignes: [avenant, introduction].filter((l) => l.trim()) }),
    montants: () => {
      doc.tableau(
        [
          { titre: 'Poste', part: 46 },
          { titre: 'Personnes', part: 14, aligne: 'droite' },
          { titre: 'Commission unitaire HT', part: 20, aligne: 'droite' },
          { titre: 'Montant HT', part: 20, aligne: 'droite' },
        ],
        d.lignes.map((l) => [l.intitule, String(l.nombre), formaterMontant(l.commission), formaterMontant(l.montantHt)]),
      );
      doc.totaux([...lignesTotaux(d), { libelle: `Acompte à la commande (${d.tauxAcompte} %)`, valeur: formaterMontant(d.acompte), gras: true }, ...lignesDeductionCredit(d.acompte, d.deductionCredit)]);
    },
    modalites: () => {
      doc.titre(g.texte('modalites_titre'));
      doc.champs([
        ['Validité du devis', `${d.validiteJours} jours${d.expireLe ? ` (jusqu'au ${dateLongue(d.expireLe)})` : ''}`],
        ['Acompte', `${d.tauxAcompte} %, soit ${formaterMontant(d.acompte)}, payable à l'acceptation`],
        ['Délai de recherche', `${d.delaiRechercheJours} jours à compter de l'encaissement de l'acompte`],
        ['Prolongation', d.prolongationJours ? `${d.prolongationJours} jours supplémentaires` : null],
        ['Garantie', `Remplacement gratuit sous ${d.garantieJours} jours après la prise de poste`],
        ['Montant final', 'Commission × personnes placées ; solde facturé à la clôture'],
      ]);
    },
    conditions: () => {
      doc.titre(g.texte('conditions_titre'));
      doc.paragraphe(d.conditions, { taille: 10 });
      if (d.conditionsParticulieres?.trim()) {
        doc.titre(g.texte('conditions_particulieres_titre'));
        doc.paragraphe(d.conditionsParticulieres, { taille: 10 });
      }
    },
    complement: () => paragrapheComplement(doc, g),
    signature: () => {
      doc.espace(8);
      doc.signature(g.texte('signature_titre'), ['Nom du signataire', 'Fonction', 'Date'], g.texte('signature_legende'));
    },
  });
  return doc.enregistrer();
}

/** Section « Texte complémentaire » : paragraphe libre, absent si vide (POST-05 RG-03). */
function paragrapheComplement(doc: DocumentPdf, g: Gabarit) {
  const t = g.texte('complement');
  if (t.trim()) doc.paragraphe(t, { taille: 10, apres: 8 });
}

// ─── Factures et avoirs ──────────────────────────────────────

export interface DonneesFacturePdf {
  type: TypeFacture;
  numero: string;
  emiseLe: Date;
  numeroDossier: string;
  libelle: string;
  /** Devis d'origine (référence imprimée). */
  devis?: { numero: string; version: number } | null;
  /** Avoir : facture d'origine. */
  factureOrigine?: { numero: string; emiseLe: Date } | null;
  client: ClientDocument;
  lignes: readonly { libelle: string; quantite: number; prixUnitaire: number; montantHt: number }[];
  tauxTva: number;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
  mentionsLegales: string;
  /** Facture d'acompte : déduction du crédit client figée sur le devis (MVP2-05 RG-12). */
  deductionCredit?: number;
  /** POST-05 : modèle « facture » (ou « avoir ») en vigueur à la date d'émission (ADR 0020 §3). */
  modele?: ModeleApplique;
}

const TITRES_FACTURE: Record<TypeFacture, string> = { acompte: "FACTURE D'ACOMPTE", solde: 'FACTURE DE SOLDE', avoir: 'AVOIR' };

/** Valeurs des variables des modèles « facture » et « avoir » (POST-05 RG-06). */
export const variablesFacture = (f: DonneesFacturePdf): Record<string, string> =>
  f.type === 'avoir'
    ? {
        'dossier.numero': f.numeroDossier,
        'client.nom': f.client.nom,
        'avoir.numero': f.numero,
        'avoir.emis_le': dateLongue(f.emiseLe),
        'avoir.montant': formaterMontant(f.totalTtc),
        'facture_origine.numero': f.factureOrigine?.numero ?? '',
      }
    : {
        'dossier.numero': f.numeroDossier,
        'client.nom': f.client.nom,
        'facture.numero': f.numero,
        'facture.emise_le': dateLongue(f.emiseLe),
        'facture.net_a_payer': formaterMontant(f.totalTtc),
        'devis.numero': f.devis?.numero ?? '',
      };

export async function pdfFacture(f: DonneesFacturePdf): Promise<Uint8Array> {
  const avoir = f.type === 'avoir';
  const g = gabarit(avoir ? 'avoir' : 'facture', f.modele, variablesFacture(f));
  const references = [f.numero, `Émise le ${dateLongue(f.emiseLe)}`, `Dossier ${f.numeroDossier}`];
  if (f.factureOrigine) references.push(`Sur la facture ${f.factureOrigine.numero}`);
  const doc = await creerDocument(g, { titreMeta: `${TYPES_FACTURE[f.type]} ${f.numero}`, mentionsLegales: f.mentionsLegales, enTete: { titre: TITRES_FACTURE[f.type], references } });

  rendreSections(g, {
    destinataire: () => {
      doc.bloc(avoir ? 'Bénéficiaire' : 'Facturé à', lignesClient(f.client), { titre: `${TYPES_FACTURE[f.type]} n° ${f.numero}`, lignes: [`Dossier ${f.numeroDossier}`] });
      doc.paragraphe(f.libelle, { apres: 2 });
      if (f.factureOrigine) doc.paragraphe(`Avoir établi sur la facture ${f.factureOrigine.numero} du ${dateLongue(f.factureOrigine.emiseLe)}.`, { taille: 10, apres: 2 });
      if (f.devis) doc.paragraphe(`Référence : devis ${f.devis.numero} (version ${f.devis.version}).`, { taille: 10 });
      doc.espace(6);
    },
    montants: () => {
      doc.tableau(
        [
          { titre: 'Désignation', part: 52 },
          { titre: 'Qté', part: 10, aligne: 'droite' },
          { titre: 'Prix unitaire HT', part: 19, aligne: 'droite' },
          { titre: 'Montant HT', part: 19, aligne: 'droite' },
        ],
        f.lignes.map((l) => [l.libelle, String(l.quantite), formaterMontant(l.prixUnitaire), formaterMontant(l.montantHt)]),
      );
      doc.totaux(lignesTotaux(f, avoir ? "Montant de l'avoir" : 'Total'));
      if (avoir) return;
      doc.paragraphe(`Net à payer : ${formaterMontant(f.totalTtc)}.`, { gras: true, apres: 4 });
      if (f.type === 'acompte' && f.deductionCredit && f.deductionCredit > 0) {
        doc.paragraphe(`Déduction du crédit client : ${formaterMontant(f.deductionCredit)} (règlement par imputation de votre crédit).`, { apres: 2 });
        doc.paragraphe(`Reste à payer sur l'acompte : ${formaterMontant(Math.max(0, f.totalTtc - f.deductionCredit))}.`, { gras: true, apres: 4 });
      }
    },
    explication: () => paragrapheSiTexte(doc, g.texte('explication'), { taille: 10 }),
    paiement: () => paragrapheSiTexte(doc, g.texte('paiement'), { taille: 10 }),
    complement: () => paragrapheComplement(doc, g),
  });
  return doc.enregistrer();
}

function paragrapheSiTexte(doc: DocumentPdf, texte: string, o: Parameters<DocumentPdf['paragraphe']>[1] = {}) {
  if (texte.trim()) doc.paragraphe(texte, o);
}

// ─── Accusé de réception ─────────────────────────────────────

export interface DonneesAccuseReception {
  numeroDossier: string;
  creeLe: Date;
  client: ClientDocument;
  postes: readonly { intitule: string; nombre: number }[];
  mentionsLegales: string;
  /** POST-05 : modèle « accusé de réception » en vigueur à la date de réception. */
  modele?: ModeleApplique;
}

export async function pdfAccuseReception(a: DonneesAccuseReception): Promise<Uint8Array> {
  const total = a.postes.reduce((s, p) => s + p.nombre, 0);
  const g = gabarit('accuse_reception', a.modele, {
    'dossier.numero': a.numeroDossier,
    'dossier.recu_le': dateLongue(a.creeLe),
    'client.nom': a.client.nom,
    'client.contact': a.client.contact ?? a.client.nom,
    'postes.total': String(total),
  });
  const doc = await creerDocument(g, {
    titreMeta: `Accusé de réception - ${a.numeroDossier}`,
    mentionsLegales: a.mentionsLegales,
    enTete: { titre: 'ACCUSÉ DE RÉCEPTION', references: [`Dossier ${a.numeroDossier}`, `Reçu le ${dateLongue(a.creeLe)}`] },
  });
  rendreSections(g, {
    destinataire: () => doc.bloc('Client', lignesClient(a.client), { titre: g.texte('titre'), lignes: [] }),
    introduction: () => paragrapheSiTexte(doc, g.texte('introduction'), { apres: 10 }),
    postes: () => {
      doc.titre(g.texte('postes_titre'));
      doc.tableau(
        [
          { titre: 'Poste', part: 75 },
          { titre: 'Personnes', part: 25, aligne: 'droite' },
        ],
        [...a.postes.map((p) => [p.intitule, String(p.nombre)]), ['Total', String(total)]],
      );
    },
    etapes: () => {
      const etapes = g
        .texte('etapes')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const titre = g.texte('etapes_titre');
      if (titre.trim() && etapes.length) doc.titre(titre);
      for (const [i, etape] of etapes.entries()) doc.paragraphe(`${i + 1}. ${etape}`, { retrait: 8, apres: 2 });
    },
    conclusion: () => {
      const t = g.texte('conclusion');
      if (!t.trim()) return;
      doc.espace(8);
      doc.paragraphe(t, { gras: true });
    },
    complement: () => paragrapheComplement(doc, g),
  });
  return doc.enregistrer();
}

// ─── Reçu d'encaissement (MVP2-05 RG-04) ─────────────────────

export interface DonneesRecuPdf {
  /** REÇ-AAAA-NNNNN. */
  numero: string;
  /** Date de réception du paiement (AAAA-MM-JJ). */
  recuLe: string;
  /** Date d'émission du reçu (enregistrement de l'Encaissement). */
  emisLe: Date;
  numeroDossier: string;
  client: ClientDocument;
  /** Libellés (« Acompte », « Orange Money »…). */
  nature: string;
  moyen: string;
  /** Référence de la transaction (absente pour les espèces). */
  reference?: string | null;
  montant: number;
  devis?: { numero: string; version: number } | null;
  /** Situation à la date du reçu (facultatif) : base (montant du devis ou montant final) et total réglé. */
  situation?: { libelleBase: string; base: number; totalRegle: number } | null;
  mentionsLegales: string;
  /** POST-05 : modèle « reçu » en vigueur à la date d'enregistrement de l'Encaissement. */
  modele?: ModeleApplique;
}

/** Date AAAA-MM-JJ → date longue, sans décalage de fuseau. */
const jourLong = (jour: string) => dateLongue(new Date(`${jour}T12:00:00+01:00`));

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function moinsDeCent(n: number): string {
  if (n < 17) return UNITES[n]!;
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10);
  let u = n % 10;
  if (d === 7 || d === 9) u += 10;
  const base = DIZAINES[d]!;
  if (u === 0) return d === 8 ? 'quatre-vingts' : base;
  if ((u === 1 || u === 11) && d !== 8 && d !== 9) return `${base} et ${moinsDeCent(u)}`;
  return `${base}-${moinsDeCent(u)}`;
}

function moinsDeMille(n: number, final = true): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  const centaines = c === 0 ? '' : c === 1 ? 'cent' : `${UNITES[c]} cent${r === 0 && final ? 's' : ''}`;
  if (r === 0) return centaines || 'zéro';
  const dizaines = r === 80 && !final ? 'quatre-vingt' : moinsDeCent(r);
  return centaines ? `${centaines} ${dizaines}` : dizaines;
}

/** Montant entier en toutes lettres (français, orthographe traditionnelle) : 25 000 → « vingt-cinq mille ». */
export function montantEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n);
  if (n === 0) return 'zéro';
  const parties: string[] = [];
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1000);
  const reste = n % 1000;
  if (milliards) parties.push(`${moinsDeMille(milliards)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions) parties.push(`${moinsDeMille(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers) parties.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`);
  if (reste) parties.push(moinsDeMille(reste));
  return parties.join(' ');
}

export async function pdfRecu(r: DonneesRecuPdf): Promise<Uint8Array> {
  const g = gabarit('recu', r.modele, {
    'dossier.numero': r.numeroDossier,
    'client.nom': r.client.nom,
    'recu.numero': r.numero,
    'recu.montant': formaterMontant(r.montant),
    'recu.montant_lettres': montantEnLettres(r.montant),
    'recu.recu_le': jourLong(r.recuLe),
    'recu.nature': r.nature,
    'recu.moyen': r.moyen,
  });
  const doc = await creerDocument(g, {
    titreMeta: `Reçu ${r.numero}`,
    mentionsLegales: r.mentionsLegales,
    enTete: { titre: 'REÇU', references: [r.numero, `Émis le ${dateLongue(r.emisLe)}`, `Dossier ${r.numeroDossier}`] },
  });
  rendreSections(g, {
    destinataire: () => doc.bloc('Reçu de', lignesClient(r.client), { titre: `Reçu n° ${r.numero}`, lignes: [`Dossier ${r.numeroDossier}`] }),
    declaration: () => paragrapheSiTexte(doc, g.texte('declaration'), { apres: 8 }),
    details: () => {
      doc.champs([
        ['Montant reçu', formaterMontant(r.montant)],
        ['Date de réception', jourLong(r.recuLe)],
        ['Nature du paiement', r.nature],
        ['Moyen de paiement', r.moyen],
        ['Référence de la transaction', r.reference?.trim() || null],
        ['Devis', r.devis ? `${r.devis.numero} (version ${r.devis.version})` : null],
      ]);
      if (r.situation) {
        doc.espace(6);
        doc.totaux([
          { libelle: r.situation.libelleBase, valeur: formaterMontant(r.situation.base) },
          { libelle: 'Total réglé à cette date', valeur: formaterMontant(r.situation.totalRegle) },
          { libelle: 'Reste à payer à cette date', valeur: formaterMontant(Math.max(0, r.situation.base - r.situation.totalRegle)), gras: true },
        ]);
      }
    },
    avertissement: () => {
      const t = g.texte('avertissement');
      if (!t.trim()) return;
      doc.espace(6);
      doc.paragraphe(t, { taille: 10 });
    },
    complement: () => paragrapheComplement(doc, g),
  });
  return doc.enregistrer();
}
