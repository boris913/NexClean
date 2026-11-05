// Mise en page commune des documents PDF (specs/MVP2-04 RG-16, RG-19, RG-20) : A4 portrait,
// Helvetica standard (aucune police embarquée : documents légers), police ≥ 10 pt, en-tête
// NEXCLEAN, pied de page avec les mentions légales figées du document et pagination « Page i / n ».
// Module sans dépendance serveur (pdf-lib seul), testable unitairement ; utilisé par les modèles
// (./modeles.ts) et par l'attestation de prise de poste (lib/propositions/pdf.ts).
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/** Format A4 portrait, en points. */
export const A4 = { largeur: 595.28, hauteur: 841.89 } as const;
/** RG-20 : taille minimale du texte (lisibilité sur smartphone). */
export const TAILLE_MIN = 10;
export const MARGE = 48;

export const COULEURS = {
  marque: rgb(0.071, 0.208, 0.357), // navy-light #12355B (charte « Institution claire »)
  encre: rgb(0.12, 0.14, 0.17),
  gris: rgb(0.4, 0.42, 0.45),
  filet: rgb(0.82, 0.84, 0.86),
  fond: rgb(0.95, 0.96, 0.96),
} as const;

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
  ' ': ' ',
  ' ': ' ',
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

/** Découpe un texte (déjà normalisé) en lignes tenant dans `largeur` points ; coupe les mots trop longs. */
export function couperLignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = '';
  const tient = (t: string) => police.widthOfTextAtSize(t, taille) <= largeur;
  for (let mot of texte.split(' ')) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (tient(essai)) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    // Mot plus large que la colonne : découpé caractère par caractère.
    while (!tient(mot) && mot.length > 1) {
      let n = mot.length - 1;
      while (n > 1 && !tient(mot.slice(0, n))) n--;
      lignes.push(mot.slice(0, n));
      mot = mot.slice(n);
    }
    courante = mot;
  }
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

/** Paragraphes d'un texte libre (retours à la ligne conservés). */
const paragraphesDe = (texte: string) =>
  texte
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim());

export const dateLongue = (d: Date, fuseau = 'Africa/Douala') => new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, dateStyle: 'long' }).format(d);

export interface Polices {
  normal: PDFFont;
  gras: PDFFont;
}

export interface EnTete {
  /** Intitulé du document (ex. « FACTURE D'ACOMPTE »). */
  titre: string;
  /** Lignes de référence sous le titre (numéro, date…), alignées à droite. */
  references: string[];
}

// Symbole du logo (tuile 96 × 96, public/images/brand/logo-symbole.svg), tracé en vectoriel.
const LOGO_TUILE = 'M26 0H70C84.36 0 96 11.64 96 26V70C96 84.36 84.36 96 70 96H26C11.64 96 0 84.36 0 70V26C0 11.64 11.64 0 26 0Z';
const LOGO_N = 'M25 74V28H39L60 58V28H74V74H60L39 44V74Z';
const LOGO_ECLAT = 'M76 8Q76 18 86 18Q76 18 76 28Q76 18 66 18Q76 18 76 8Z';

/** Symbole NEXCLEAN (tuile verte, N et éclat blancs), coin supérieur gauche en (x, yHaut), côté `cote`. */
export function dessinerSymbole(page: PDFPage, x: number, yHaut: number, cote: number): void {
  const o = { x, y: yHaut, scale: cote / 96 };
  page.drawSvgPath(LOGO_TUILE, { ...o, color: rgb(0.4, 0.702, 0.169) });
  page.drawSvgPath(LOGO_N, { ...o, color: rgb(1, 1, 1) });
  page.drawSvgPath(LOGO_ECLAT, { ...o, color: rgb(1, 1, 1) });
}

/** En-tête NEXCLEAN commun : marque à gauche, titre et références à droite, filet. Retourne le y sous l'en-tête. */
export function dessinerEnTete(page: PDFPage, p: Polices, e: EnTete, marge = MARGE): number {
  const { width, height } = page.getSize();
  const droite = width - marge;
  let y = height - marge - 16;
  dessinerSymbole(page, marge, y + 18, 32);
  page.drawText('NEXCLEAN', { x: marge + 40, y, size: 22, font: p.gras, color: COULEURS.marque });
  page.drawText(normaliserTexte('Nettoyage, recrutement et services', p.normal), { x: marge + 40, y: y - 15, size: TAILLE_MIN, font: p.normal, color: COULEURS.gris });
  const titre = normaliserTexte(e.titre, p.gras);
  const tailleTitre = Math.max(TAILLE_MIN, Math.min(15, (width / 2 - marge) / Math.max(1, p.gras.widthOfTextAtSize(titre, 1))));
  page.drawText(titre, { x: droite - p.gras.widthOfTextAtSize(titre, tailleTitre), y: y + 4, size: tailleTitre, font: p.gras, color: COULEURS.encre });
  let yRef = y - 12;
  for (const r of e.references) {
    for (const ligne of couperLignes(normaliserTexte(r, p.normal), p.normal, TAILLE_MIN, width / 2 - marge)) {
      page.drawText(ligne, { x: droite - p.normal.widthOfTextAtSize(ligne, TAILLE_MIN), y: yRef, size: TAILLE_MIN, font: p.normal, color: COULEURS.gris });
      yRef -= 13;
    }
  }
  y = Math.min(y - 26, yRef - 2);
  page.drawLine({ start: { x: marge, y }, end: { x: droite, y }, thickness: 1, color: COULEURS.marque });
  return y - 22;
}

/** Lignes du pied de page (mentions légales figées), à la taille minimale. */
export function lignesPied(p: Polices, mentionsLegales: string, largeur: number): string[] {
  return paragraphesDe(mentionsLegales)
    .filter(Boolean)
    .flatMap((l) => couperLignes(normaliserTexte(l, p.normal), p.normal, TAILLE_MIN, largeur));
}

export const INTERLIGNE_PIED = 12.5;

/** Hauteur réservée au pied de page (mentions + pagination). */
export const hauteurPied = (lignes: number) => 28 + (lignes + 1) * INTERLIGNE_PIED;

/** Pied de page commun : filet, mentions légales et pagination. */
export function dessinerPied(page: PDFPage, p: Polices, lignes: string[], pagination: string | null, marge = MARGE): void {
  const { width } = page.getSize();
  let y = marge - 12 + (lignes.length + (pagination ? 1 : 0)) * INTERLIGNE_PIED;
  page.drawLine({ start: { x: marge, y: y + 4 }, end: { x: width - marge, y: y + 4 }, thickness: 0.5, color: COULEURS.filet });
  y -= INTERLIGNE_PIED;
  for (const l of lignes) {
    page.drawText(l, { x: marge, y, size: TAILLE_MIN, font: p.normal, color: COULEURS.gris });
    y -= INTERLIGNE_PIED;
  }
  if (pagination) {
    const t = normaliserTexte(pagination, p.normal);
    page.drawText(t, { x: width - marge - p.normal.widthOfTextAtSize(t, TAILLE_MIN), y, size: TAILLE_MIN, font: p.normal, color: COULEURS.gris });
  }
}

// ─── Document à pagination automatique ──────────────────────

export interface Colonne {
  titre: string;
  /** Part de la largeur utile (les parts sont normalisées). */
  part: number;
  aligne?: 'gauche' | 'droite';
}

export interface Ligne {
  libelle: string;
  valeur: string;
  gras?: boolean;
}

export interface OptionsDocument {
  /** Titre des métadonnées du PDF. */
  titreMeta: string;
  enTete: EnTete;
  /** Mentions légales figées du document (pied de page de chaque page). */
  mentionsLegales: string;
}

/**
 * Document PDF à flux vertical : chaque bloc vérifie la place restante et ouvre une nouvelle page
 * (en-tête et en-tête de tableau répétés) si nécessaire. `enregistrer()` dessine les pieds de page
 * avec la pagination définitive.
 */
export class DocumentPdf {
  private pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = 0;
  readonly largeurUtile = A4.largeur - 2 * MARGE;
  private readonly piedLignes: string[];
  private readonly basContenu: number;

  private constructor(
    readonly doc: PDFDocument,
    readonly polices: Polices,
    private readonly o: OptionsDocument,
  ) {
    this.piedLignes = lignesPied(polices, o.mentionsLegales, this.largeurUtile);
    this.basContenu = MARGE - 12 + hauteurPied(this.piedLignes.length);
    this.nouvellePage();
  }

  static async creer(o: OptionsDocument): Promise<DocumentPdf> {
    const doc = await PDFDocument.create();
    doc.setTitle(normaliserTexte(o.titreMeta));
    doc.setAuthor('NEXCLEAN');
    doc.setCreator('NEXCLEAN');
    doc.setProducer('NEXCLEAN');
    doc.setLanguage('fr-FR');
    const polices = { normal: await doc.embedFont(StandardFonts.Helvetica), gras: await doc.embedFont(StandardFonts.HelveticaBold) };
    return new DocumentPdf(doc, polices, o);
  }

  get nombrePages() {
    return this.pages.length;
  }

  private nouvellePage() {
    this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
    this.pages.push(this.page);
    this.y = dessinerEnTete(this.page, this.polices, this.o.enTete);
  }

  /** Garantit `hauteur` points disponibles ; sinon nouvelle page. Retourne true si une page a été ajoutée. */
  assurer(hauteur: number): boolean {
    if (this.y - hauteur >= this.basContenu) return false;
    this.nouvellePage();
    return true;
  }

  espace(h = 10) {
    this.y -= h;
  }

  private texteLigne(texte: string, x: number, o: { taille?: number; police?: PDFFont; couleur?: RGB } = {}) {
    this.page.drawText(texte, { x, y: this.y, size: o.taille ?? 11, font: o.police ?? this.polices.normal, color: o.couleur ?? COULEURS.encre });
  }

  /** Paragraphe (retours à la ligne conservés), coupé à la largeur utile. */
  paragraphe(texte: string, o: { taille?: number; gras?: boolean; couleur?: RGB; apres?: number; retrait?: number } = {}) {
    const police = o.gras ? this.polices.gras : this.polices.normal;
    const taille = Math.max(TAILLE_MIN, o.taille ?? 11);
    const retrait = o.retrait ?? 0;
    for (const p of paragraphesDe(texte)) {
      if (!p) {
        this.y -= taille * 0.6;
        continue;
      }
      for (const ligne of couperLignes(normaliserTexte(p, police), police, taille, this.largeurUtile - retrait)) {
        this.assurer(taille * 1.45);
        this.texteLigne(ligne, MARGE + retrait, { taille, police, couleur: o.couleur });
        this.y -= taille * 1.45;
      }
    }
    this.y -= o.apres ?? 6;
  }

  /** Titre de section. */
  titre(texte: string) {
    this.assurer(40);
    this.y -= 4;
    this.paragraphe(texte, { taille: 12, gras: true, couleur: COULEURS.marque, apres: 4 });
  }

  /** Paires « libellé : valeur » sur deux colonnes. */
  champs(lignes: readonly (readonly [string, string | null | undefined])[], largeurLibelle = 150) {
    const { normal, gras } = this.polices;
    for (const [libelle, valeur] of lignes) {
      if (valeur == null || valeur === '') continue;
      const v = couperLignes(normaliserTexte(valeur, normal), normal, 11, this.largeurUtile - largeurLibelle);
      this.assurer(v.length * 15 + 2);
      this.texteLigne(normaliserTexte(libelle, gras), MARGE, { police: gras, taille: TAILLE_MIN, couleur: COULEURS.gris });
      for (const l of v) {
        this.texteLigne(l, MARGE + largeurLibelle);
        this.y -= 15;
      }
      this.y -= 2;
    }
    this.y -= 4;
  }

  /**
   * Bloc encadré à droite (client, destinataire…) : titre et lignes. En regard, à gauche, un titre
   * de document (gras, 14 pt) et ses lignes d'introduction (10 pt), facultatifs.
   */
  bloc(titre: string, lignes: readonly (string | null | undefined)[], gauche?: { titre: string; lignes: readonly string[] }) {
    const { normal, gras } = this.polices;
    const demi = this.largeurUtile / 2;
    const contenu = lignes.filter((l): l is string => !!l?.trim()).flatMap((l, i) => couperLignes(normaliserTexte(l, i === 0 ? gras : normal), i === 0 ? gras : normal, 11, demi - 24).map((t) => ({ t, gras: i === 0 })));
    const colonne = gauche
      ? [
          ...couperLignes(normaliserTexte(gauche.titre, gras), gras, 14, demi - 20).map((t) => ({ t, police: gras, taille: 14, h: 19 })),
          ...gauche.lignes.flatMap((l) => couperLignes(normaliserTexte(l, normal), normal, TAILLE_MIN, demi - 20).map((t) => ({ t, police: normal, taille: TAILLE_MIN, h: 14 }))),
        ]
      : [];
    const h = 26 + contenu.length * 15;
    this.assurer(Math.max(h, colonne.reduce((s, l) => s + l.h, 0)) + 8);
    const haut = this.y;
    const x = MARGE + demi;
    this.page.drawRectangle({ x, y: this.y - h + 12, width: demi, height: h, color: COULEURS.fond, borderColor: COULEURS.filet, borderWidth: 0.6 });
    this.texteLigne(normaliserTexte(titre.toUpperCase(), gras), x + 12, { police: gras, taille: TAILLE_MIN, couleur: COULEURS.gris });
    this.y -= 16;
    for (const l of contenu) {
      this.texteLigne(l.t, x + 12, { police: l.gras ? gras : normal });
      this.y -= 15;
    }
    const basBloc = this.y - 16;
    this.y = haut - 2;
    for (const l of colonne) {
      this.texteLigne(l.t, MARGE, { police: l.police, taille: l.taille });
      this.y -= l.h;
    }
    this.y = Math.min(basBloc, this.y - 10);
  }

  /** Tableau : en-tête grisé (répété à chaque page), cellules coupées en plusieurs lignes au besoin. */
  tableau(colonnes: readonly Colonne[], lignes: readonly (readonly string[])[]) {
    const { normal, gras } = this.polices;
    const total = colonnes.reduce((s, c) => s + c.part, 0);
    const largeurs = colonnes.map((c) => (c.part / total) * this.largeurUtile);
    const xs = largeurs.map((_, i) => MARGE + largeurs.slice(0, i).reduce((s, w) => s + w, 0));
    const pad = 6;
    const taille = TAILLE_MIN;
    const interligne = 13;

    const cellules = (valeurs: readonly string[], police: PDFFont) => valeurs.map((v, i) => couperLignes(normaliserTexte(v, police), police, taille, largeurs[i]! - 2 * pad));
    const dessinerLigne = (cel: string[][], police: PDFFont, fond: boolean) => {
      const n = Math.max(...cel.map((c) => c.length));
      const h = n * interligne + 8;
      if (fond) this.page.drawRectangle({ x: MARGE, y: this.y - h, width: this.largeurUtile, height: h, color: COULEURS.fond });
      cel.forEach((lignesCellule, i) => {
        lignesCellule.forEach((t, k) => {
          const w = police.widthOfTextAtSize(t, taille);
          const x = colonnes[i]!.aligne === 'droite' ? xs[i]! + largeurs[i]! - pad - w : xs[i]! + pad;
          this.page.drawText(t, { x, y: this.y - 5 - taille - k * interligne + 2, size: taille, font: police, color: COULEURS.encre });
        });
      });
      this.y -= h;
      this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: MARGE + this.largeurUtile, y: this.y }, thickness: 0.5, color: COULEURS.filet });
    };
    const entete = cellules(colonnes.map((c) => c.titre), gras);
    const hEntete = Math.max(...entete.map((c) => c.length)) * interligne + 8;
    this.assurer(hEntete + interligne + 8);
    dessinerLigne(entete, gras, true);
    for (const valeurs of lignes) {
      const cel = cellules(valeurs, normal);
      const h = Math.max(...cel.map((c) => c.length)) * interligne + 8;
      if (this.assurer(h)) dessinerLigne(entete, gras, true);
      dessinerLigne(cel, normal, false);
    }
    this.y -= 10;
  }

  /** Totaux alignés à droite (libellé, montant). */
  totaux(lignes: readonly Ligne[]) {
    const { normal, gras } = this.polices;
    const xLibelle = MARGE + this.largeurUtile * 0.45;
    const droite = MARGE + this.largeurUtile;
    this.assurer(lignes.length * 17 + 6);
    for (const l of lignes) {
      const police = l.gras ? gras : normal;
      const taille = l.gras ? 12 : 11;
      this.texteLigne(normaliserTexte(l.libelle, police), xLibelle, { police, taille });
      const v = normaliserTexte(l.valeur, police);
      this.texteLigne(v, droite - police.widthOfTextAtSize(v, taille), { police, taille });
      this.y -= 17;
    }
    this.y -= 8;
  }

  /** Zone de signature : champs à remplir à gauche, cadre « signature et cachet » à droite. */
  signature(titre: string, champs: readonly string[], legendeCadre = 'Signature et cachet', hauteurCadre = 66) {
    const { normal, gras } = this.polices;
    const hauteur = Math.max(champs.length * 22, hauteurCadre) + 24;
    this.assurer(hauteur);
    this.texteLigne(normaliserTexte(titre, gras), MARGE, { police: gras, taille: 12 });
    this.y -= 22;
    const haut = this.y;
    const xCadre = MARGE + this.largeurUtile * 0.55;
    for (const c of champs) {
      const l = normaliserTexte(`${c} :`, normal);
      this.texteLigne(l, MARGE);
      const x = MARGE + normal.widthOfTextAtSize(l, 11) + 6;
      this.page.drawLine({ start: { x, y: this.y - 2 }, end: { x: xCadre - 16, y: this.y - 2 }, thickness: 0.6, color: COULEURS.gris });
      this.y -= 22;
    }
    this.page.drawRectangle({ x: xCadre, y: haut - hauteurCadre + 10, width: MARGE + this.largeurUtile - xCadre, height: hauteurCadre, borderColor: COULEURS.gris, borderWidth: 0.6 });
    this.page.drawText(normaliserTexte(legendeCadre, normal), { x: xCadre + 6, y: haut - 4, size: TAILLE_MIN, font: normal, color: COULEURS.gris });
    this.y = Math.min(this.y, haut - hauteurCadre) - 4;
  }

  async enregistrer(): Promise<Uint8Array> {
    const n = this.pages.length;
    this.pages.forEach((p, i) => dessinerPied(p, this.polices, this.piedLignes, `Page ${i + 1} / ${n}`));
    return this.doc.save();
  }
}
