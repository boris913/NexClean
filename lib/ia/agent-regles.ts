// Règles de l'agent conversationnel, appliquées dans le code et non dans le prompt
// (specs/COM3-02 RG-02, RG-04, RG-05 ; ADR 0026 §4). Module pur.
import type { HeuresOuvrees } from '@/lib/parametres';
import { ajouterHeuresOuvrees } from '@/lib/dossiers/heures-ouvrees';

const HEURE_MS = 3600_000;
/** RG-05 : plafond de messages de l'agent par conversation et par jour. */
export const PLAFOND_MESSAGES_JOUR = 15;
export const PRESENTATION = 'Bonjour, je suis l’assistant virtuel de NEXCLEAN. Un conseiller peut prendre le relais à tout moment.';

export type MotifPassage = 'humain' | 'negociation' | 'reclamation' | 'hors_perimetre' | 'incertitude' | 'qualification_complete' | 'plafond' | 'controle' | 'devis' | 'paiement';
export const MOTIFS_PASSAGE: Record<MotifPassage, string> = {
  humain: 'Le client demande un conseiller',
  negociation: 'Négociation ou demande de remise',
  reclamation: 'Réclamation ou mécontentement',
  hors_perimetre: 'Sujet hors périmètre',
  incertitude: 'Réponses de faible confiance',
  qualification_complete: 'Qualification complète',
  plafond: 'Plafond de messages atteint',
  controle: 'Message bloqué par le contrôle',
  devis: 'Demande de devis ferme',
  paiement: 'Question de paiement',
};

const normaliser = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()} `;

const DECLENCHEURS: [MotifPassage, RegExp][] = [
  ['humain', / (parler|discuter|joindre|appeler) (a|avec) (un|une|quelqu) | (un|une) (humain|conseiller|conseillere|agent humain|vraie personne|personne reelle) | real person | human /],
  ['negociation', / remise | reduction | rabais | ristourne | moins cher | baisser (le|votre) prix | negoci| geste commercial | \d+ ?% | discount /],
  ['reclamation', / reclamation | plainte | pas satisfait | mecontent | inadmissible | arnaque | rembours| scandale | nul | complain /],
  ['devis', / devis (ferme|definitif|signe)| je signe | bon de commande | contrat (a|pour) signer /],
  ['paiement', / payer | paiement | orange money | momo | mobile money | virement | facture | acompte /],
];

/** RG-05 : déclencheur de passage détecté dans le message du client, avant tout appel à l'IA. */
export function declencheurPassage(texte: string): MotifPassage | null {
  const t = normaliser(texte);
  return DECLENCHEURS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Montants en FCFA cités dans un texte (« 60 000 FCFA », « 8000 F CFA », « 15 000 francs »). */
export function montantsCites(texte: string): number[] {
  return [...texte.matchAll(/(\d{1,3}(?:[\s.]\d{3})+|\d+)\s?(?:f\s?cfa|fcfa|xaf|francs?|f)\b/gi)].map((m) => Number(m[1]!.replace(/[\s.]/g, '')));
}

export interface Autorisations {
  /** Montants renvoyés par `donner_estimation` pendant ce tour. */
  montants: number[];
  /** Liens que le serveur a fournis (lien de suivi, site). */
  liens: string[];
  /** Numéros autorisés (standard NEXCLEAN). */
  telephones: string[];
}

/**
 * RG-02 : contrôle de tout message avant envoi. Bloqué si un montant, un lien ou un numéro n'a pas
 * été fourni par le serveur, ou si le message promet une remise, une date ou un candidat.
 */
export function controlerMessage(texte: string, a: Autorisations): { ok: true } | { ok: false; raison: string } {
  const montantInconnu = montantsCites(texte).find((m) => !a.montants.includes(m));
  if (montantInconnu !== undefined) return { ok: false, raison: `montant non fourni par l’estimation : ${montantInconnu}` };
  const lienInconnu = (texte.match(/https?:\/\/[^\s)]+/gi) ?? []).find((l) => !a.liens.some((x) => l.replace(/[.,;!?]+$/, '') === x));
  if (lienInconnu) return { ok: false, raison: `lien non autorisé : ${lienInconnu}` };
  const chiffres = (s: string) => s.replace(/\D/g, '');
  // Numéros camerounais : 9 chiffres commençant par 6 ou 2, éventuellement précédés de 237.
  const estTelephone = (n: string) => /^(237)?[26]\d{8}$/.test(n);
  const local = (n: string) => n.slice(-9);
  const numeroInconnu = (texte.match(/\+?\d[\d\s.-]{7,}\d/g) ?? []).map(chiffres).filter(estTelephone).find((n) => !a.telephones.some((t) => local(chiffres(t)) === local(n)));
  if (numeroInconnu) return { ok: false, raison: `numéro non autorisé : ${numeroInconnu}` };
  const t = normaliser(texte);
  if (/ (je vous (accorde|fais|offre)|nous vous (accordons|faisons|offrons)) (une |un )?(remise|reduction|rabais|geste)/.test(t) || / \d+ ?% de (remise|reduction)/.test(t)) return { ok: false, raison: 'promesse de remise' };
  if (/ (nous|on) (serons|sera|passerons|interviendrons|viendrons) (la |chez vous )?(demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|le \d)/.test(t)) return { ok: false, raison: 'promesse de date d’intervention' };
  return { ok: true };
}

/** RG-04 : présentation au premier message de l'agent dans la conversation. */
export function avecPresentation(texte: string, premierMessage: boolean): string {
  if (!premierMessage || /assistant virtuel/i.test(texte)) return texte;
  return `${PRESENTATION}\n\n${texte}`;
}

/**
 * RG-01 `proposer_creneau_rappel` : prochains créneaux d'une heure pendant les heures ouvrées, au
 * moins 2 h après maintenant, sans chevaucher un rendez-vous existant du référent.
 */
export function creneauxRappel(maintenant: Date, horaires: HeuresOuvrees, occupes: Date[], n = 3): Date[] {
  const out: Date[] = [];
  let t = ajouterHeuresOuvrees(new Date(maintenant.getTime() + 2 * HEURE_MS), 0, horaires);
  for (let garde = 0; out.length < n && garde < 200; garde++) {
    // Créneaux à l'heure pile.
    const pile = new Date(Math.ceil(t.getTime() / HEURE_MS) * HEURE_MS);
    const debut = ajouterHeuresOuvrees(pile, 0, horaires);
    const fin = ajouterHeuresOuvrees(debut, 1, horaires);
    const libre = fin.getTime() - debut.getTime() === HEURE_MS && !occupes.some((o) => Math.abs(o.getTime() - debut.getTime()) < HEURE_MS);
    if (libre && debut.getTime() === pile.getTime()) out.push(debut);
    t = new Date(debut.getTime() + HEURE_MS);
  }
  return out;
}
