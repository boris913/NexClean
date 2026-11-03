// Calculs en heures ouvrées (MVP1-05 RG-06, RG-07). Module pur.
// Africa/Douala est en UTC+1 toute l'année (pas d'heure d'été) : on raisonne en « heure locale »
// en décalant d'une heure, sans dépendre du fuseau de la machine.
import type { HeuresOuvrees } from '@/lib/parametres';

const DECALAGE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

/** Date locale (Douala) du jour : minuit local, exprimé en instant UTC. */
function minuitLocal(t: number): number {
  const local = t + DECALAGE_MS;
  return local - (local % JOUR_MS) - DECALAGE_MS;
}
const jourSemaine = (t: number) => new Date(t + DECALAGE_MS).getUTCDay();

/** Plage ouvrée du jour contenant t, en instants UTC ; null si jour non ouvré. */
function plageDuJour(t: number, horaires: HeuresOuvrees): [number, number] | null {
  const p = horaires[jourSemaine(t)];
  if (!p) return null;
  const m0 = minuitLocal(t);
  return [m0 + minutes(p.debut) * 60_000, m0 + minutes(p.fin) * 60_000];
}

/** Instant situé `heures` heures ouvrées après `debut`. */
export function ajouterHeuresOuvrees(debut: Date, heures: number, horaires: HeuresOuvrees): Date {
  if (!horaires.some(Boolean)) throw new Error('Aucun jour ouvré configuré');
  let restant = heures * 60 * 60 * 1000;
  let t = debut.getTime();
  for (let garde = 0; garde < 400; garde++) {
    const plage = plageDuJour(t, horaires);
    if (plage) {
      const [d, f] = plage;
      const depart = Math.max(t, d);
      if (depart < f) {
        const dispo = f - depart;
        if (restant <= dispo) return new Date(depart + restant);
        restant -= dispo;
      }
    }
    t = minuitLocal(t) + JOUR_MS;
  }
  throw new Error('Calcul d’heures ouvrées interrompu');
}

/** Prochain début de journée ouvrée à 8 h (heure locale) strictement après `apres`. */
export function prochainHuitHeuresOuvre(apres: Date, horaires: HeuresOuvrees): Date {
  let m0 = minuitLocal(apres.getTime());
  for (let i = 0; i < 15; i++) {
    const huit = m0 + 8 * 60 * 60 * 1000;
    if (horaires[jourSemaine(m0)] && huit > apres.getTime()) return new Date(huit);
    m0 += JOUR_MS;
  }
  throw new Error('Aucun jour ouvré configuré');
}

/**
 * RG-06 : échéance de la prochaine relance d'un dossier non attribué.
 * Première relance après le délai en heures ouvrées, puis chaque jour ouvré à 8 h.
 */
export function prochaineEscalade(enFileDepuis: Date, derniereRelanceLe: Date | null, delaiHeures: number, horaires: HeuresOuvrees): Date {
  return derniereRelanceLe ? prochainHuitHeuresOuvre(derniereRelanceLe, horaires) : ajouterHeuresOuvrees(enFileDepuis, delaiHeures, horaires);
}

/** Jour ouvré et au moins 8 h (heure locale) : moment des envois quotidiens. */
export function estApresHuitHeuresUnJourOuvre(t: Date, horaires: HeuresOuvrees): boolean {
  return !!horaires[jourSemaine(t.getTime())] && t.getTime() - minuitLocal(t.getTime()) >= 8 * 60 * 60 * 1000;
}

/** Date locale AAAA-MM-JJ (Douala). */
export const dateLocale = (t: Date) => new Date(t.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
