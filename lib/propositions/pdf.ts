// PDF côté client (specs/MVP2-03) : filigrane des CV transmis (RG-09) et attestation de prise de
// poste (RG-15). Module sans dépendance serveur (pdf-lib), testable unitairement.
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

/** Caractères typographiques courants remplacés par leur équivalent simple. */
const REMPLACEMENTS: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '′': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '«': '"',
  '»': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  '…': '...',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '​': '',
  'œ': 'oe',
  'Œ': 'OE',
};

/**
 * Rend un texte affichable avec une police standard (encodage WinAnsi) : guillemets et
 * apostrophes typographiques, espaces insécables, tirets → équivalents simples ; tout autre
 * caractère non encodable → « ? » (au lieu d'une exception de pdf-lib).
 */
export function normaliserTexte(texte: string, police?: PDFFont): string {
  const jeu = police ? new Set(police.getCharacterSet()) : null;
  let sortie = '';
  for (const car of texte.normalize('NFC').replace(/[\r\n\t]+/g, ' ')) {
    const r = REMPLACEMENTS[car] ?? car;
    for (const c of r) {
      const code = c.codePointAt(0)!;
      if (jeu ? jeu.has(code) : code >= 0x20 && code <= 0xff) sortie += c;
      else sortie += '?';
    }
  }
  return sortie;
}

/**
 * RG-09 : appose le filigrane « Transmis par NEXCLEAN à <client> le <date> » sur chaque page
 * (diagonale semi-transparente + mention en pied de page). Lève une erreur si le PDF est illisible.
 */
export async function filigranerPdf(octets: Uint8Array, texte: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(octets, { ignoreEncryption: true, updateMetadata: false });
  const police = await doc.embedFont(StandardFonts.HelveticaBold);
  const t = normaliserTexte(texte, police);
  for (const page of doc.getPages()) apposerFiligrane(page, police, t);
  return doc.save();
}

/** RG-09 : CV image (JPEG / PNG) converti en PDF d'une page filigranée ; null pour un autre format. */
export async function imageFiligranee(octets: Uint8Array, mime: string, texte: string): Promise<Uint8Array | null> {
  if (mime !== 'image/jpeg' && mime !== 'image/png') return null;
  const doc = await PDFDocument.create();
  const image = mime === 'image/png' ? await doc.embedPng(octets) : await doc.embedJpg(octets);
  // Page A4, image ajustée avec marges.
  const [L, H, marge] = [595.28, 841.89, 24];
  const echelle = Math.min((L - 2 * marge) / image.width, (H - 2 * marge) / image.height, 1);
  const [w, h] = [image.width * echelle, image.height * echelle];
  const page = doc.addPage([L, H]);
  page.drawImage(image, { x: (L - w) / 2, y: (H - h) / 2, width: w, height: h });
  const police = await doc.embedFont(StandardFonts.HelveticaBold);
  apposerFiligrane(page, police, normaliserTexte(texte, police));
  return doc.save();
}

function apposerFiligrane(page: PDFPage, police: PDFFont, texte: string) {
  const { width, height } = page.getSize();
  const diagonale = Math.sqrt(width * width + height * height);
  // Taille telle que le texte occupe ~80 % de la diagonale.
  const taille = Math.max(10, Math.min(36, (diagonale * 0.8) / Math.max(1, police.widthOfTextAtSize(texte, 1))));
  const angle = Math.atan2(height, width);
  const largeur = police.widthOfTextAtSize(texte, taille);
  const x = width / 2 - (Math.cos(angle) * largeur) / 2 + (Math.sin(angle) * taille) / 2;
  const y = height / 2 - (Math.sin(angle) * largeur) / 2 - (Math.cos(angle) * taille) / 2;
  page.drawText(texte, { x, y, size: taille, font: police, color: rgb(0.85, 0.1, 0.1), opacity: 0.22, rotate: degrees((angle * 180) / Math.PI) });
  const pied = Math.min(9, (width - 24) / Math.max(1, police.widthOfTextAtSize(texte, 1)));
  page.drawText(texte, { x: 12, y: 8, size: pied, font: police, color: rgb(0.45, 0.45, 0.45), opacity: 0.9 });
}

// ─── Attestation de prise de poste (RG-15) ──────────────────

export interface DonneesAttestation {
  numeroDossier: string;
  client: string;
  /** Interlocuteur du client (facultatif). */
  contact?: string | null;
  candidatPrenom: string;
  candidatNom: string;
  poste: string;
  /** Date de prise de poste prévue (AAAA-MM-JJ). */
  datePrevue: string;
  /** Garantie de remplacement (paramètre `garantie_jours`). */
  garantieJours: number;
  /** Si la prise de poste a été confirmée par le client en ligne (RG-16). */
  confirmation?: { datePriseDePoste: string; signataireNom: string | null; signataireFonction: string | null; confirmeLe: Date } | null;
  /** Date d'établissement (défaut : maintenant). */
  etablieLe?: Date;
  fuseau?: string;
}

const jourLong = (d: Date, fuseau: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, dateStyle: 'long' }).format(d);
/** « 2026-11-10 » → « 10 novembre 2026 » (sans décalage de fuseau). */
export const dateIsoLongue = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(Date.UTC(a!, m! - 1, j!)));
};

/** Découpe un texte en lignes tenant dans `largeur` points. */
function couperLignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = '';
  for (const mot of texte.split(' ')) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) courante = essai;
    else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** RG-15 : attestation de prise de poste pré-remplie (A4, polices standard). */
export async function genererAttestation(d: DonneesAttestation): Promise<Uint8Array> {
  const fuseau = d.fuseau ?? 'Africa/Douala';
  const doc = await PDFDocument.create();
  doc.setTitle(normaliserTexte(`Attestation de prise de poste - ${d.numeroDossier}`));
  doc.setAuthor('NEXCLEAN');
  doc.setCreator('NEXCLEAN');
  const page = doc.addPage([595.28, 841.89]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const [marge, largeur] = [56, 595.28 - 112];
  const encre = rgb(0.12, 0.14, 0.17);
  const gris = rgb(0.4, 0.42, 0.45);
  let y = 841.89 - 64;

  const ecrire = (texte: string, o: { taille?: number; police?: PDFFont; couleur?: ReturnType<typeof rgb>; apres?: number } = {}) => {
    const police = o.police ?? normal;
    const taille = o.taille ?? 11;
    for (const ligne of couperLignes(normaliserTexte(texte, police), police, taille, largeur)) {
      page.drawText(ligne, { x: marge, y, size: taille, font: police, color: o.couleur ?? encre });
      y -= taille * 1.45;
    }
    y -= o.apres ?? 6;
  };
  const champ = (libelle: string, valeur: string | null) => {
    const l = normaliserTexte(`${libelle} : `, gras);
    page.drawText(l, { x: marge, y, size: 11, font: gras, color: encre });
    const x = marge + gras.widthOfTextAtSize(l, 11);
    if (valeur) page.drawText(normaliserTexte(valeur, normal), { x, y, size: 11, font: normal, color: encre });
    else page.drawLine({ start: { x, y: y - 2 }, end: { x: marge + largeur, y: y - 2 }, thickness: 0.6, color: gris });
    y -= 26;
  };

  // En-tête
  page.drawText('NEXCLEAN', { x: marge, y, size: 22, font: gras, color: rgb(0.05, 0.45, 0.35) });
  const ref = normaliserTexte(`Dossier n° ${d.numeroDossier}`, normal);
  page.drawText(ref, { x: marge + largeur - normal.widthOfTextAtSize(ref, 10), y: y + 6, size: 10, font: normal, color: gris });
  y -= 18;
  page.drawLine({ start: { x: marge, y }, end: { x: marge + largeur, y }, thickness: 1, color: rgb(0.05, 0.45, 0.35) });
  y -= 40;
  ecrire('Attestation de prise de poste', { taille: 18, police: gras, apres: 18 });

  const datePrevue = dateIsoLongue(d.datePrevue);
  const nomComplet = `${d.candidatPrenom.trim()} ${d.candidatNom.trim()}`.trim();
  ecrire(`Je soussigné(e), représentant(e) de ${d.client}${d.contact?.trim() ? ` (interlocuteur : ${d.contact.trim()})` : ''}, atteste que :`, { apres: 12 });
  champ('Candidat(e)', nomComplet);
  champ('Poste', d.poste);
  champ('Date de prise de poste prévue', datePrevue);
  champ('Date effective de prise de poste', d.confirmation ? dateIsoLongue(d.confirmation.datePriseDePoste) : null);
  y -= 4;
  ecrire(`a bien pris son poste au sein de ${d.client}, dans le cadre du recrutement réalisé par NEXCLEAN (dossier n° ${d.numeroDossier}).`, { apres: 14 });
  ecrire(
    `Garantie de remplacement : si la personne placée quitte son poste dans les ${d.garantieJours} jours suivant la date effective de prise de poste, NEXCLEAN propose un remplacement sans commission supplémentaire.`,
    { taille: 10, couleur: gris, apres: 26 },
  );

  ecrire('Le client', { police: gras, taille: 12, apres: 10 });
  champ('Nom du signataire', d.confirmation?.signataireNom ?? null);
  champ('Fonction', d.confirmation?.signataireFonction ?? null);
  champ('Date', d.confirmation ? jourLong(d.confirmation.confirmeLe, fuseau) : null);
  if (d.confirmation) {
    ecrire(`Prise de poste confirmée en ligne sur la page de suivi NEXCLEAN le ${jourLong(d.confirmation.confirmeLe, fuseau)}.`, { taille: 10, couleur: gris });
  } else {
    page.drawText(normaliserTexte('Signature et cachet :', gras), { x: marge, y, size: 11, font: gras, color: encre });
    y -= 12;
    page.drawRectangle({ x: marge, y: y - 90, width: 260, height: 90, borderColor: gris, borderWidth: 0.6 });
  }

  const pied = normaliserTexte(`NEXCLEAN - attestation établie le ${jourLong(d.etablieLe ?? new Date(), fuseau)} - dossier n° ${d.numeroDossier}`, normal);
  page.drawText(pied, { x: marge, y: 36, size: 8, font: normal, color: gris });
  return doc.save();
}
