// Modèles fixes des documents PDF (specs/MVP2-04 RG-16) : devis / avenant, facture d'acompte,
// de solde, avoir, accusé de réception, reçu d'encaissement (MVP2-05 RG-04). Fonctions pures (données → octets PDF), sans accès à la
// base : ./rendu.ts lit les valeurs figées et appelle ces modèles. Langue `fr`.
import { formaterMontant, mentionTva, TYPES_FACTURE, type LigneDevis, type TypeFacture } from '@/lib/devis/domaine';
import { dateLongue, DocumentPdf, type Ligne } from './mise-en-page';

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

export async function pdfDevis(d: DonneesDevisPdf): Promise<Uint8Array> {
  const titre = titreDevis(d);
  const doc = await DocumentPdf.creer({
    titreMeta: titre,
    mentionsLegales: d.mentionsLegales,
    enTete: { titre: d.type === 'avenant' ? 'AVENANT' : 'DEVIS', references: [`${d.numero} — v${d.version}`, `Dossier ${d.numeroDossier}`, `Date : ${dateLongue(d.date)}`] },
  });
  doc.bloc('Client', lignesClient(d.client), {
    titre,
    lignes: [
      ...(d.type === 'avenant' && d.devisInitial ? [`Avenant au devis ${d.devisInitial.numero} (version ${d.devisInitial.version}) accepté ; les autres conditions du devis initial restent inchangées.`] : []),
      `Recrutement de personnel : commission de placement par personne placée (dossier ${d.numeroDossier}).`,
    ],
  });

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

  doc.titre('Modalités');
  doc.champs([
    ['Validité du devis', `${d.validiteJours} jours${d.expireLe ? ` (jusqu'au ${dateLongue(d.expireLe)})` : ''}`],
    ['Acompte', `${d.tauxAcompte} %, soit ${formaterMontant(d.acompte)}, payable à l'acceptation`],
    ['Délai de recherche', `${d.delaiRechercheJours} jours à compter de l'encaissement de l'acompte`],
    ['Prolongation', d.prolongationJours ? `${d.prolongationJours} jours supplémentaires` : null],
    ['Garantie', `Remplacement gratuit sous ${d.garantieJours} jours après la prise de poste`],
    ['Montant final', 'Commission × personnes placées ; solde facturé à la clôture'],
  ]);

  doc.titre('Conditions générales');
  doc.paragraphe(d.conditions, { taille: 10 });
  if (d.conditionsParticulieres?.trim()) {
    doc.titre('Conditions particulières');
    doc.paragraphe(d.conditionsParticulieres, { taille: 10 });
  }
  doc.espace(8);
  doc.signature('Bon pour accord', ['Nom du signataire', 'Fonction', 'Date'], 'Signature et cachet');
  return doc.enregistrer();
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
}

const TITRES_FACTURE: Record<TypeFacture, string> = { acompte: "FACTURE D'ACOMPTE", solde: 'FACTURE DE SOLDE', avoir: 'AVOIR' };

export async function pdfFacture(f: DonneesFacturePdf): Promise<Uint8Array> {
  const references = [f.numero, `Émise le ${dateLongue(f.emiseLe)}`, `Dossier ${f.numeroDossier}`];
  if (f.factureOrigine) references.push(`Sur la facture ${f.factureOrigine.numero}`);
  const doc = await DocumentPdf.creer({ titreMeta: `${TYPES_FACTURE[f.type]} ${f.numero}`, mentionsLegales: f.mentionsLegales, enTete: { titre: TITRES_FACTURE[f.type], references } });
  doc.bloc(f.type === 'avoir' ? 'Bénéficiaire' : 'Facturé à', lignesClient(f.client), { titre: `${TYPES_FACTURE[f.type]} n° ${f.numero}`, lignes: [`Dossier ${f.numeroDossier}`] });
  doc.paragraphe(f.libelle, { apres: 2 });
  if (f.factureOrigine) doc.paragraphe(`Avoir établi sur la facture ${f.factureOrigine.numero} du ${dateLongue(f.factureOrigine.emiseLe)}.`, { taille: 10, apres: 2 });
  if (f.devis) doc.paragraphe(`Référence : devis ${f.devis.numero} (version ${f.devis.version}).`, { taille: 10 });
  doc.espace(6);
  doc.tableau(
    [
      { titre: 'Désignation', part: 52 },
      { titre: 'Qté', part: 10, aligne: 'droite' },
      { titre: 'Prix unitaire HT', part: 19, aligne: 'droite' },
      { titre: 'Montant HT', part: 19, aligne: 'droite' },
    ],
    f.lignes.map((l) => [l.libelle, String(l.quantite), formaterMontant(l.prixUnitaire), formaterMontant(l.montantHt)]),
  );
  doc.totaux(lignesTotaux(f, f.type === 'avoir' ? "Montant de l'avoir" : 'Total'));
  if (f.type === 'avoir') {
    doc.paragraphe("Cet avoir vient en déduction des sommes dues. Le trop-perçu éventuel est remboursé ou imputé sur un prochain dossier, au choix du client.", { taille: 10 });
  } else {
    doc.paragraphe(`Net à payer : ${formaterMontant(f.totalTtc)}.`, { gras: true, apres: 4 });
    if (f.type === 'acompte' && f.deductionCredit && f.deductionCredit > 0) {
      doc.paragraphe(`Déduction du crédit client : ${formaterMontant(f.deductionCredit)} (règlement par imputation de votre crédit).`, { apres: 2 });
      doc.paragraphe(`Reste à payer sur l'acompte : ${formaterMontant(Math.max(0, f.totalTtc - f.deductionCredit))}.`, { gras: true, apres: 4 });
    }
    doc.paragraphe(`Merci d'indiquer la référence ${f.numero} lors de votre règlement.`, { taille: 10 });
  }
  return doc.enregistrer();
}

// ─── Accusé de réception ─────────────────────────────────────

export interface DonneesAccuseReception {
  numeroDossier: string;
  creeLe: Date;
  client: ClientDocument;
  postes: readonly { intitule: string; nombre: number }[];
  mentionsLegales: string;
}

export async function pdfAccuseReception(a: DonneesAccuseReception): Promise<Uint8Array> {
  const doc = await DocumentPdf.creer({
    titreMeta: `Accusé de réception - ${a.numeroDossier}`,
    mentionsLegales: a.mentionsLegales,
    enTete: { titre: 'ACCUSÉ DE RÉCEPTION', references: [`Dossier ${a.numeroDossier}`, `Reçu le ${dateLongue(a.creeLe)}`] },
  });
  doc.bloc('Client', lignesClient(a.client), { titre: `Accusé de réception de votre demande n° ${a.numeroDossier}`, lignes: [] });
  doc.paragraphe(`Nous avons bien reçu le ${dateLongue(a.creeLe)} votre demande de recrutement de personnel. Elle est enregistrée sous le numéro ${a.numeroDossier}, à rappeler dans vos échanges avec NEXCLEAN.`, { apres: 10 });
  doc.titre('Postes demandés');
  const total = a.postes.reduce((s, p) => s + p.nombre, 0);
  doc.tableau(
    [
      { titre: 'Poste', part: 75 },
      { titre: 'Personnes', part: 25, aligne: 'droite' },
    ],
    [...a.postes.map((p) => [p.intitule, String(p.nombre)]), ['Total', String(total)]],
  );
  doc.titre('Prochaines étapes');
  for (const [i, etape] of [
    'Un référent NEXCLEAN étudie votre demande et vous contacte sur WhatsApp pour préciser le besoin.',
    'Vous recevez un devis détaillé (commission par personne placée, acompte, délai de recherche).',
    "Après acceptation du devis et réception de l'acompte, la recherche de candidats commence.",
    'Les profils sélectionnés vous sont transmis ; vous ne payez que les personnes effectivement placées.',
  ].entries()) {
    doc.paragraphe(`${i + 1}. ${etape}`, { retrait: 8, apres: 2 });
  }
  doc.espace(8);
  doc.paragraphe('Suivez votre demande via le lien reçu par WhatsApp.', { gras: true });
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
  const doc = await DocumentPdf.creer({
    titreMeta: `Reçu ${r.numero}`,
    mentionsLegales: r.mentionsLegales,
    enTete: { titre: 'REÇU', references: [r.numero, `Émis le ${dateLongue(r.emisLe)}`, `Dossier ${r.numeroDossier}`] },
  });
  doc.bloc('Reçu de', lignesClient(r.client), { titre: `Reçu n° ${r.numero}`, lignes: [`Dossier ${r.numeroDossier}`] });
  doc.paragraphe(`NEXCLEAN atteste avoir reçu la somme de ${formaterMontant(r.montant)} (${montantEnLettres(r.montant)} francs CFA) le ${jourLong(r.recuLe)}.`, { apres: 8 });
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
  doc.espace(6);
  doc.paragraphe('Ce reçu ne constitue pas une facture. Conservez-le : il justifie votre paiement.', { taille: 10 });
  return doc.enregistrer();
}
