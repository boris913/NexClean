// Règles pures des réponses WhatsApp (specs/COM2-02 RG-02, RG-06..10).
import type { HeuresOuvrees } from '@/lib/parametres';
import { ajouterHeuresOuvrees } from '@/lib/dossiers/heures-ouvrees';

const HEURE_MS = 60 * 60 * 1000;
/** RG-02 : fenêtre de service ouverte par le dernier message du client. */
export const FENETRE_SERVICE_MS = 24 * HEURE_MS;
/** RG-06 : un nouvel accusé part après 7 jours de silence du client. */
export const SILENCE_ACCUSE_MS = 7 * 24 * HEURE_MS;

const normaliser = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/** RG-02 : texte libre permis si le dernier message du client a moins de 24 h. */
export const fenetreOuverte = (dernierEntrantLe: Date | null, maintenant: Date) => !!dernierEntrantLe && maintenant.getTime() - dernierEntrantLe.getTime() < FENETRE_SERVICE_MS;

/** RG-09 : « STOP », « ARRÊT », « stop pub »… (message court, pour ne pas confondre avec une phrase). */
export function estStop(texte: string): boolean {
  const t = normaliser(texte).trim();
  return /^(stop|arret|arreter|stop pub|stop publicite|desinscription|desabonner|unsubscribe)$/.test(t);
}

/** RG-06 : premier message de la conversation, ou premier après 7 jours de silence. */
export const doitAccuser = (entrantPrecedentLe: Date | null, maintenant: Date) => !entrantPrecedentLe || maintenant.getTime() - entrantPrecedentLe.getTime() >= SILENCE_ACCUSE_MS;

/**
 * RG-08 : réponses automatiques suspendues si la conversation est en reprise manuelle, ou si un
 * humain a répondu (Back-Office ou téléphone) depuis moins de `heures` heures.
 */
export function automateSuspendu(c: { automate: 'actif' | 'manuel'; dernierSortantLe: Date | null }, maintenant: Date, heures: number): boolean {
  if (c.automate === 'manuel') return true;
  return !!c.dernierSortantLe && maintenant.getTime() - c.dernierSortantLe.getTime() < heures * HEURE_MS;
}

export interface RegleReponse {
  mots: string[];
  reponse: string;
}

/** RG-07 : première règle dont un mot-clé apparaît dans le message. */
export function reponseRapide(texte: string, regles: RegleReponse[]): RegleReponse | null {
  const t = normaliser(texte);
  return regles.find((r) => r.mots.some((m) => t.includes(normaliser(m)))) ?? null;
}

/** Variables {x} des textes automatiques ; une variable sans valeur est retirée. */
export const remplir = (texte: string, valeurs: Record<string, string | null | undefined>) =>
  texte
    .replace(/\{(\w+)\}/g, (_, k: string) => valeurs[k] ?? '')
    .replace(/[ \t]+([.,])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/** RG-07 : une réponse automatique n'annonce jamais de prix (montant en FCFA). */
export const contientPrix = (texte: string) => /\d[\d\s.]*\s?(f\s?cfa|fcfa|xaf|francs?)\b/i.test(texte);

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const h = (hhmm: string) => {
  const [hh, mm] = hhmm.split(':');
  return `${Number(hh)} h${mm && mm !== '00' ? ` ${mm}` : ''}`;
};

/** « du lundi au vendredi de 7 h à 19 h, le samedi de 8 h à 17 h ». */
export function libelleHoraires(horaires: HeuresOuvrees): string {
  const groupes: { jours: number[]; debut: string; fin: string }[] = [];
  for (const j of [1, 2, 3, 4, 5, 6, 0]) {
    const p = horaires[j];
    if (!p) continue;
    const dernier = groupes.at(-1);
    if (dernier && dernier.debut === p.debut && dernier.fin === p.fin && (dernier.jours.at(-1)! + 1) % 7 === j) dernier.jours.push(j);
    else groupes.push({ jours: [j], debut: p.debut, fin: p.fin });
  }
  return groupes
    .map((g) => `${g.jours.length > 1 ? `du ${JOURS[g.jours[0]!]} au ${JOURS[g.jours.at(-1)!]}` : `le ${JOURS[g.jours[0]!]}`} de ${h(g.debut)} à ${h(g.fin)}`)
    .join(', ');
}

/** Ouvert maintenant, sinon instant de la prochaine ouverture. */
export function ouverture(maintenant: Date, horaires: HeuresOuvrees): { ouvert: boolean; prochaine: Date } {
  const prochaine = ajouterHeuresOuvrees(maintenant, 0, horaires);
  return { ouvert: prochaine.getTime() === maintenant.getTime(), prochaine };
}

const FORMAT_OUVERTURE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', hour: '2-digit', minute: '2-digit' });
/** « lundi à 07:00 », « demain à 07:00 ». */
export function libelleOuverture(prochaine: Date, maintenant: Date): string {
  const jour = (d: Date) => new Date(d.getTime() + HEURE_MS).toISOString().slice(0, 10);
  const demain = new Date(maintenant.getTime() + 24 * HEURE_MS);
  const [j, heure] = FORMAT_OUVERTURE.format(prochaine).split(' ');
  if (jour(prochaine) === jour(maintenant)) return `aujourd’hui à ${heure}`;
  if (jour(prochaine) === jour(demain)) return `demain à ${heure}`;
  return `${j} à ${heure}`;
}

/** RG-10 : envoi marketing permis ? (accord explicite, pas de STOP, plafond, note de qualité). */
export function marketingAutorise(p: { accordLe: Date | null; retireLe: Date | null; envoisSemaine: number; plafond: number; qualite: string | null }): { ok: true } | { ok: false; raison: string } {
  if (p.retireLe && (!p.accordLe || p.retireLe >= p.accordLe)) return { ok: false, raison: 'Le client a demandé à ne plus recevoir de messages promotionnels (STOP).' };
  if (!p.accordLe) return { ok: false, raison: 'Aucun accord explicite du client pour les messages promotionnels.' };
  if (p.envoisSemaine >= p.plafond) return { ok: false, raison: `Plafond atteint : ${p.plafond} message(s) promotionnel(s) par semaine.` };
  if (p.qualite === 'RED') return { ok: false, raison: 'Envois promotionnels suspendus : note de qualité du numéro basse.' };
  return { ok: true };
}
