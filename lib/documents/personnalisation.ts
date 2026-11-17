// Modèles de documents personnalisables (specs/POST-05) : catalogue par type (blocs de texte,
// sections, variables, textes d'origine), validation et rendu des blocs. Module pur, partagé par
// les modèles PDF (./modeles.ts, lib/propositions/pdf.ts), le service des versions et l'éditeur.
// Les textes d'origine reproduisent exactement les textes d'avant POST-05 (RG-08).
import { remplacerVariables, variablesDe } from '@/lib/modeles/variables';

export const TYPES_DOCUMENT = {
  accuse_reception: 'Accusé de réception',
  devis: 'Devis et avenant',
  facture: 'Facture d’acompte et de solde',
  avoir: 'Avoir',
  recu: 'Reçu d’encaissement',
  attestation: 'Attestation de prise de poste',
} as const;

export type TypeDocument = keyof typeof TYPES_DOCUMENT;
export const TYPES_DOCUMENT_CODES = Object.keys(TYPES_DOCUMENT) as [TypeDocument, ...TypeDocument[]];
export const estTypeDocument = (v: unknown): v is TypeDocument => typeof v === 'string' && Object.hasOwn(TYPES_DOCUMENT, v);

/** Contenu d'un modèle : texte de chaque bloc et ordre des sections du corps (RG-01). */
export interface ContenuModele {
  blocs: Record<string, string>;
  ordre: string[];
}

export interface DefinitionBloc {
  libelle: string;
  /** Section où le bloc s'affiche dans l'éditeur (`page` : en-tête et pied de page). */
  section: string;
  defaut: string;
  max: number;
  /** RG-03 : bloc qui ne peut pas être vide. */
  obligatoire?: boolean;
  /** Texte sur plusieurs lignes (zone de saisie haute). */
  multiligne?: boolean;
  aide?: string;
}

export interface DefinitionSection {
  libelle: string;
  /** RG-05 : raison du verrouillage (position imposée) ; absent = section déplaçable. */
  verrou?: string;
  /** Section de données toujours présente, même si ses blocs sont vides. */
  donnees?: boolean;
}

export interface DefinitionDocument {
  libelle: string;
  variables: Record<string, string>;
  sections: Record<string, DefinitionSection>;
  /** Ordre d'origine des sections du corps (sans `page`). */
  ordre: string[];
  blocs: Record<string, DefinitionBloc>;
}

const SOUS_TITRE_ENTETE = 'Nettoyage, recrutement et services';
const SECTION_PAGE: DefinitionSection = { libelle: 'En-tête et pied de page', verrou: 'Présents sur chaque page.' };

/** RG-02 : blocs communs (sous-titre de l'en-tête, complément du pied de page). */
const blocsPage = (maxPied = 300): Record<string, DefinitionBloc> => ({
  entete: { libelle: 'Sous-titre de l’en-tête', section: 'page', defaut: SOUS_TITRE_ENTETE, max: 80, aide: 'Sous « NEXCLEAN ». Vide : pas de sous-titre.' },
  pied: { libelle: 'Complément du pied de page', section: 'page', defaut: '', max: maxPied, multiligne: true, aide: 'Ajouté sous les mentions légales (Paramètres), sur chaque page.' },
});

const complement = (max = 2000): DefinitionBloc => ({ libelle: 'Texte complémentaire', section: 'complement', defaut: '', max, multiligne: true, aide: 'Paragraphe libre. Vide : la section n’apparaît pas.' });
const SECTION_COMPLEMENT: DefinitionSection = { libelle: 'Texte complémentaire' };
const SECTION_DESTINATAIRE: DefinitionSection = { libelle: 'Destinataire', verrou: 'Le document s’ouvre sur son identification et celle du client.', donnees: true };
const SECTION_MONTANTS: DefinitionSection = { libelle: 'Montants', verrou: 'Tableau des montants, totaux et mention TVA : éléments réglementaires (MVP2-04 RG-19, ADR 0020 §3).', donnees: true };

export const DOCUMENTS: Record<TypeDocument, DefinitionDocument> = {
  accuse_reception: {
    libelle: TYPES_DOCUMENT.accuse_reception,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'dossier.recu_le': 'Date de réception de la demande',
      'client.nom': 'Nom du client',
      'client.contact': 'Nom du contact (ou du client)',
      'postes.total': 'Nombre total de personnes demandées',
    },
    sections: {
      page: SECTION_PAGE,
      destinataire: SECTION_DESTINATAIRE,
      introduction: { libelle: 'Introduction' },
      postes: { libelle: 'Postes demandés', donnees: true },
      etapes: { libelle: 'Prochaines étapes' },
      conclusion: { libelle: 'Conclusion' },
      complement: SECTION_COMPLEMENT,
    },
    ordre: ['destinataire', 'introduction', 'postes', 'etapes', 'conclusion', 'complement'],
    blocs: {
      ...blocsPage(),
      titre: { libelle: 'Titre du document', section: 'destinataire', defaut: 'Accusé de réception de votre demande n° {{dossier.numero}}', max: 120, obligatoire: true },
      introduction: {
        libelle: 'Introduction',
        section: 'introduction',
        defaut: 'Nous avons bien reçu le {{dossier.recu_le}} votre demande de recrutement de personnel. Elle est enregistrée sous le numéro {{dossier.numero}}, à rappeler dans vos échanges avec NEXCLEAN.',
        max: 1000,
        multiligne: true,
      },
      postes_titre: { libelle: 'Titre de la section', section: 'postes', defaut: 'Postes demandés', max: 80, obligatoire: true },
      etapes_titre: { libelle: 'Titre de la section', section: 'etapes', defaut: 'Prochaines étapes', max: 80 },
      etapes: {
        libelle: 'Étapes (une par ligne, numérotées automatiquement)',
        section: 'etapes',
        defaut: [
          'Un référent NEXCLEAN étudie votre demande et vous contacte sur WhatsApp pour préciser le besoin.',
          'Vous recevez un devis détaillé (commission par personne placée, acompte, délai de recherche).',
          "Après acceptation du devis et réception de l'acompte, la recherche de candidats commence.",
          'Les profils sélectionnés vous sont transmis ; vous ne payez que les personnes effectivement placées.',
        ].join('\n'),
        max: 2000,
        multiligne: true,
      },
      conclusion: { libelle: 'Conclusion (en gras)', section: 'conclusion', defaut: 'Suivez votre demande via le lien reçu par WhatsApp.', max: 500, multiligne: true },
      complement: complement(),
    },
  },

  devis: {
    libelle: TYPES_DOCUMENT.devis,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'client.nom': 'Nom du client',
      'devis.numero': 'Numéro du devis (ou de l’avenant)',
      'devis.version': 'Version du devis',
      'devis.initial': 'Avenant : devis initial et sa version',
      'devis.date': 'Date du devis',
      'devis.validite': 'Durée de validité (ex. « 15 jours »)',
      'devis.total': 'Total (TTC si TVA, sinon HT)',
      'devis.acompte': 'Montant de l’acompte',
    },
    sections: {
      page: SECTION_PAGE,
      destinataire: SECTION_DESTINATAIRE,
      montants: { ...SECTION_MONTANTS, verrou: 'Lignes, totaux, mention TVA et acompte fondent l’engagement : juste après le destinataire (MVP2-04 RG-19).' },
      modalites: { libelle: 'Modalités', donnees: true },
      conditions: { libelle: 'Conditions', donnees: true },
      complement: SECTION_COMPLEMENT,
      signature: { libelle: 'Signature (bon pour accord)', verrou: 'Le « Bon pour accord » clôt le devis : rien ne doit suivre la signature.', donnees: true },
    },
    ordre: ['destinataire', 'montants', 'modalites', 'conditions', 'complement', 'signature'],
    blocs: {
      ...blocsPage(),
      introduction: { libelle: 'Introduction (sous le titre)', section: 'destinataire', defaut: 'Recrutement de personnel : commission de placement par personne placée (dossier {{dossier.numero}}).', max: 300, multiligne: true },
      introduction_avenant: {
        libelle: 'Phrase de l’avenant (avenants seulement)',
        section: 'destinataire',
        defaut: 'Avenant au devis {{devis.initial}} accepté ; les autres conditions du devis initial restent inchangées.',
        max: 300,
        multiligne: true,
      },
      modalites_titre: { libelle: 'Titre de la section', section: 'modalites', defaut: 'Modalités', max: 80, obligatoire: true, aide: 'Les valeurs (validité, acompte, délai, garantie) sont celles figées sur le devis.' },
      conditions_titre: { libelle: 'Titre des conditions générales', section: 'conditions', defaut: 'Conditions générales', max: 80, obligatoire: true, aide: 'Le texte des conditions générales se modifie dans les Paramètres ; il est figé sur chaque devis.' },
      conditions_particulieres_titre: { libelle: 'Titre des conditions particulières', section: 'conditions', defaut: 'Conditions particulières', max: 80, obligatoire: true },
      complement: complement(),
      signature_titre: { libelle: 'Titre de la zone de signature', section: 'signature', defaut: 'Bon pour accord', max: 80, obligatoire: true },
      signature_legende: { libelle: 'Légende du cadre', section: 'signature', defaut: 'Signature et cachet', max: 60, obligatoire: true },
    },
  },

  facture: {
    libelle: TYPES_DOCUMENT.facture,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'client.nom': 'Nom du client (figé sur la facture)',
      'facture.numero': 'Numéro de la facture',
      'facture.emise_le': 'Date d’émission',
      'facture.net_a_payer': 'Net à payer',
      'devis.numero': 'Numéro du devis d’origine',
    },
    sections: { page: SECTION_PAGE, destinataire: SECTION_DESTINATAIRE, montants: SECTION_MONTANTS, paiement: { libelle: 'Consignes de paiement' }, complement: SECTION_COMPLEMENT },
    ordre: ['destinataire', 'montants', 'paiement', 'complement'],
    blocs: {
      ...blocsPage(),
      paiement: { libelle: 'Consignes de paiement', section: 'paiement', defaut: "Merci d'indiquer la référence {{facture.numero}} lors de votre règlement.", max: 1000, multiligne: true },
      complement: complement(),
    },
  },

  avoir: {
    libelle: TYPES_DOCUMENT.avoir,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'client.nom': 'Nom du client (figé sur l’avoir)',
      'avoir.numero': 'Numéro de l’avoir',
      'avoir.emis_le': 'Date d’émission',
      'avoir.montant': 'Montant de l’avoir',
      'facture_origine.numero': 'Numéro de la facture d’origine',
    },
    sections: { page: SECTION_PAGE, destinataire: SECTION_DESTINATAIRE, montants: SECTION_MONTANTS, explication: { libelle: 'Explication' }, complement: SECTION_COMPLEMENT },
    ordre: ['destinataire', 'montants', 'explication', 'complement'],
    blocs: {
      ...blocsPage(),
      explication: {
        libelle: 'Explication',
        section: 'explication',
        defaut: 'Cet avoir vient en déduction des sommes dues. Le trop-perçu éventuel est remboursé ou imputé sur un prochain dossier, au choix du client.',
        max: 1000,
        multiligne: true,
      },
      complement: complement(),
    },
  },

  recu: {
    libelle: TYPES_DOCUMENT.recu,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'client.nom': 'Nom du client',
      'recu.numero': 'Numéro du reçu',
      'recu.montant': 'Montant reçu',
      'recu.montant_lettres': 'Montant en toutes lettres',
      'recu.recu_le': 'Date de réception du paiement',
      'recu.nature': 'Nature du paiement',
      'recu.moyen': 'Moyen de paiement',
    },
    sections: {
      page: SECTION_PAGE,
      destinataire: SECTION_DESTINATAIRE,
      declaration: { libelle: 'Déclaration de réception' },
      details: { libelle: 'Détail du paiement', verrou: 'Montant, date, moyen, référence et situation chiffrée : place fixe.', donnees: true },
      avertissement: { libelle: 'Avertissement' },
      complement: SECTION_COMPLEMENT,
    },
    ordre: ['destinataire', 'declaration', 'details', 'avertissement', 'complement'],
    blocs: {
      ...blocsPage(),
      declaration: {
        libelle: 'Déclaration de réception',
        section: 'declaration',
        defaut: 'NEXCLEAN atteste avoir reçu la somme de {{recu.montant}} ({{recu.montant_lettres}} francs CFA) le {{recu.recu_le}}.',
        max: 1000,
        obligatoire: true,
        multiligne: true,
      },
      avertissement: {
        libelle: 'Avertissement',
        section: 'avertissement',
        defaut: 'Ce reçu ne constitue pas une facture. Conservez-le : il justifie votre paiement.',
        max: 500,
        obligatoire: true,
        multiligne: true,
        aide: 'Doit rappeler que le reçu n’est pas une facture (ADR 0020 : facturé et encaissé restent distincts).',
      },
      complement: complement(),
    },
  },

  attestation: {
    libelle: TYPES_DOCUMENT.attestation,
    variables: {
      'dossier.numero': 'Numéro du dossier',
      'client.nom': 'Nom du client',
      'client.designation': 'Nom du client et interlocuteur entre parenthèses',
      'candidat.nom_complet': 'Prénom et nom du candidat',
      'poste.intitule': 'Poste',
      'poste.date_prevue': 'Date de prise de poste prévue',
      'garantie.jours': 'Durée de la garantie, en jours',
    },
    sections: {
      page: SECTION_PAGE,
      corps: { libelle: 'Corps de l’attestation', verrou: 'Déclaration, champs et constat forment une seule phrase.', donnees: true },
      garantie: { libelle: 'Garantie de remplacement' },
      complement: SECTION_COMPLEMENT,
      signature: { libelle: 'Signature du client', verrou: 'La signature clôt l’attestation.', donnees: true },
    },
    ordre: ['corps', 'garantie', 'complement', 'signature'],
    blocs: {
      ...blocsPage(200),
      titre: { libelle: 'Titre', section: 'corps', defaut: 'Attestation de prise de poste', max: 80, obligatoire: true },
      declaration: { libelle: 'Déclaration (avant les champs)', section: 'corps', defaut: 'Je soussigné(e), représentant(e) de {{client.designation}}, atteste que :', max: 400, obligatoire: true, multiligne: true },
      constat: {
        libelle: 'Constat (après les champs)',
        section: 'corps',
        defaut: 'a bien pris son poste au sein de {{client.nom}}, dans le cadre du recrutement réalisé par NEXCLEAN (dossier n° {{dossier.numero}}).',
        max: 400,
        obligatoire: true,
        multiligne: true,
      },
      garantie: {
        libelle: 'Garantie de remplacement',
        section: 'garantie',
        defaut: 'Garantie de remplacement : si la personne placée quitte son poste dans les {{garantie.jours}} jours suivant la date effective de prise de poste, NEXCLEAN propose un remplacement sans commission supplémentaire.',
        max: 600,
        multiligne: true,
      },
      complement: complement(600),
      signature_titre: { libelle: 'Titre de la zone client', section: 'signature', defaut: 'Le client', max: 60, obligatoire: true },
    },
  },
};

/** Modèle d'origine (version 0, RG-08) : textes et ordre définis dans le code. */
export function modeleOrigine(type: TypeDocument): ContenuModele {
  const def = DOCUMENTS[type];
  return { blocs: Object.fromEntries(Object.entries(def.blocs).map(([k, b]) => [k, b.defaut])), ordre: [...def.ordre] };
}

/** Sections déplaçables vs verrouillées : un ordre est valide s'il permute les sections d'origine sans bouger les verrouillées (RG-05). */
export function erreurOrdre(type: TypeDocument, ordre: readonly string[]): string | null {
  const def = DOCUMENTS[type];
  if (ordre.length !== def.ordre.length || new Set(ordre).size !== ordre.length || ordre.some((s) => !def.ordre.includes(s))) return 'Ordre des sections invalide.';
  for (const [i, s] of def.ordre.entries()) {
    if (def.sections[s]?.verrou && ordre[i] !== s) return `La section « ${def.sections[s].libelle} » est verrouillée : elle reste à sa place.`;
  }
  return null;
}

/**
 * Complète un contenu lu en base avec le code courant (cas limites de la spec) : bloc manquant →
 * texte d'origine, bloc inconnu → ignoré, ordre devenu invalide → ordre d'origine.
 */
export function normaliserModele(type: TypeDocument, contenu: Partial<ContenuModele> | null | undefined): ContenuModele {
  const origine = modeleOrigine(type);
  if (!contenu) return origine;
  const blocs = { ...origine.blocs };
  for (const k of Object.keys(blocs)) {
    const v = contenu.blocs?.[k];
    if (typeof v === 'string') blocs[k] = v;
  }
  const ordre = Array.isArray(contenu.ordre) && erreurOrdre(type, contenu.ordre) === null ? [...contenu.ordre] : origine.ordre;
  return { blocs, ordre };
}

/** Normalise les fins de ligne et retire les espaces superflus en début et fin de bloc. */
export const nettoyerTexte = (t: string) => t.replace(/\r\n?/g, '\n').trim();

/**
 * Erreurs d'un contenu saisi (RG-03, RG-05, RG-07), dans l'ordre d'affichage ; tableau vide si
 * valide. Les blocs sont comparés après nettoyage (espaces de début et de fin retirés).
 */
export function erreursModele(type: TypeDocument, contenu: ContenuModele): string[] {
  const def = DOCUMENTS[type];
  const erreurs: string[] = [];
  for (const k of Object.keys(contenu.blocs)) if (!Object.hasOwn(def.blocs, k)) erreurs.push(`Bloc inconnu : ${k}`);
  for (const [k, b] of Object.entries(def.blocs)) {
    const brut = contenu.blocs[k];
    if (typeof brut !== 'string') {
      erreurs.push(`Bloc manquant : ${b.libelle}`);
      continue;
    }
    const t = nettoyerTexte(brut);
    if (b.obligatoire && !t) erreurs.push(`« ${b.libelle} » (${def.sections[b.section]?.libelle ?? b.section}) ne peut pas être vide.`);
    if (t.length > b.max) erreurs.push(`« ${b.libelle} » : ${b.max} caractères maximum.`);
    const inconnue = variablesDe(t).find((v) => !Object.hasOwn(def.variables, v));
    if (inconnue !== undefined) erreurs.push(`Variable inconnue dans « ${b.libelle} » : ${inconnue}`);
  }
  const o = erreurOrdre(type, contenu.ordre);
  if (o) erreurs.push(o);
  return erreurs;
}

/** Contenu nettoyé (blocs connus seulement, textes nettoyés), prêt à être enregistré. */
export function nettoyerModele(type: TypeDocument, contenu: ContenuModele): ContenuModele {
  const def = DOCUMENTS[type];
  return { blocs: Object.fromEntries(Object.keys(def.blocs).map((k) => [k, nettoyerTexte(contenu.blocs[k] ?? '')])), ordre: [...contenu.ordre] };
}

export const memeContenu = (a: ContenuModele, b: ContenuModele) =>
  a.ordre.join('|') === b.ordre.join('|') && Object.keys({ ...a.blocs, ...b.blocs }).every((k) => (a.blocs[k] ?? '') === (b.blocs[k] ?? ''));

/** Gabarit prêt au rendu : texte d'un bloc (variables remplacées) et ordre des sections. */
export interface Gabarit {
  texte(bloc: string): string;
  ordre: readonly string[];
}

/** Gabarit d'un document : modèle fourni (normalisé) ou modèle d'origine, avec les valeurs des variables. */
export function gabarit(type: TypeDocument, modele: Partial<ContenuModele> | null | undefined, valeurs: Readonly<Record<string, string | null | undefined>>): Gabarit {
  const m = normaliserModele(type, modele);
  return { texte: (bloc) => remplacerVariables(m.blocs[bloc] ?? '', valeurs), ordre: m.ordre };
}

/** Exécute les sections dans l'ordre du gabarit (chaque section sait se rendre, ou rien si vide). */
export function rendreSections(g: Gabarit, sections: Record<string, () => void>): void {
  for (const s of g.ordre) sections[s]?.();
}

/** Pied de page : mentions légales puis complément du modèle (RG-02), identique sans complément. */
export const piedDePage = (mentionsLegales: string, complementPied: string) => (complementPied.trim() ? `${mentionsLegales}\n${complementPied}` : mentionsLegales);
