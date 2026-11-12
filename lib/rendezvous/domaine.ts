// Règles pures des rendez-vous (specs/COM1-02 RG-01..03) : libellés, rappels, agenda.
// Heure légale du Cameroun : Africa/Douala = UTC+1 toute l'année (pas d'heure d'été).

export const RDV_TYPES = { visite_site: 'Visite sur site', appel: 'Appel', entretien: 'Entretien', reunion: 'Réunion' } as const;
export const RDV_STATUTS = { prevu: 'Prévu', fait: 'Fait', annule: 'Annulé', non_honore: 'Non honoré' } as const;
export type RdvType = keyof typeof RDV_TYPES;
export type RdvStatut = keyof typeof RDV_STATUTS;
export const RDV_TYPE_CODES = Object.keys(RDV_TYPES) as [RdvType, ...RdvType[]];
export const RDV_STATUT_CODES = Object.keys(RDV_STATUTS) as [RdvStatut, ...RdvStatut[]];

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;
const DECALAGE_MS = HEURE_MS; // UTC+1

/** Heure de la veille où part le premier rappel (RG-02). */
export const HEURE_RAPPEL_VEILLE = 18;
/** Un rendez-vous resté « prévu » ce délai après sa fin remonte dans « À relancer » (RG-02). */
export const DELAI_A_CLOTURER_MS = 24 * HEURE_MS;

/** Minuit (heure de Douala) du jour contenant `t`, en instant UTC. */
export function debutJourDouala(t: Date): Date {
  const local = t.getTime() + DECALAGE_MS;
  return new Date(local - (local % JOUR_MS) - DECALAGE_MS);
}

/** « 2026-11-12 » + « 10:30 » saisis en heure de Douala → instant UTC ; null si invalide. */
export function instantDouala(jour: string, heure: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}$/.test(heure)) return null;
  const t = new Date(`${jour}T${heure}:00+01:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Instant UTC → { jour: « 2026-11-12 », heure: « 10:30 » } en heure de Douala. */
export function partiesDouala(t: Date): { jour: string; heure: string } {
  const iso = new Date(t.getTime() + DECALAGE_MS).toISOString();
  return { jour: iso.slice(0, 10), heure: iso.slice(11, 16) };
}

export type CleRappel = 'veille' | 'h-1';

/** Heures des deux rappels : la veille à 18 h et 1 h avant. */
export function echeancesRappel(debut: Date): { cle: CleRappel; quand: Date }[] {
  const veille = new Date(debutJourDouala(debut).getTime() - JOUR_MS + HEURE_RAPPEL_VEILLE * HEURE_MS);
  return [
    { cle: 'veille', quand: veille },
    { cle: 'h-1', quand: new Date(debut.getTime() - HEURE_MS) },
  ];
}

/**
 * Rappels à envoyer maintenant. Un rappel part si son heure est arrivée, si le rendez-vous n'a pas
 * commencé, et s'il était déjà planifié à cette heure-là (pas de « rappel de la veille » pour un
 * rendez-vous pris le jour même). Celui de la veille cède la place à celui d'1 h avant quand ils se
 * chevauchent. L'envoi effectif est dédoublonné par la clé de notification.
 */
export function rappelsDus(rdv: { statut: RdvStatut; debut: Date; planifieLe: Date }, maintenant: Date): CleRappel[] {
  if (rdv.statut !== 'prevu' || maintenant >= rdv.debut) return [];
  const [veille, h1] = echeancesRappel(rdv.debut);
  const du = (e: { quand: Date }) => rdv.planifieLe < e.quand && e.quand <= maintenant;
  const dus: CleRappel[] = [];
  if (du(veille!) && maintenant < h1!.quand) dus.push('veille');
  if (du(h1!)) dus.push('h-1');
  return dus;
}

/** RG-02 : rendez-vous passé, toujours « prévu » 24 h après sa fin. */
export function estACloturer(rdv: { statut: RdvStatut; debut: Date; dureeMinutes: number }, maintenant: Date): boolean {
  return rdv.statut === 'prevu' && rdv.debut.getTime() + rdv.dureeMinutes * 60_000 + DELAI_A_CLOTURER_MS <= maintenant.getTime();
}

export type VueAgenda = 'jour' | 'semaine';

/** RG-03 : bornes [du, au[ de la vue, en instants UTC ; la semaine commence le lundi. */
export function bornesAgenda(vue: VueAgenda, jour: string): { du: Date; au: Date; jours: string[] } {
  const ref = instantDouala(jour, '12:00') ?? new Date();
  let du = debutJourDouala(ref);
  if (vue === 'semaine') {
    const jourSemaine = (new Date(du.getTime() + DECALAGE_MS).getUTCDay() + 6) % 7; // lundi = 0
    du = new Date(du.getTime() - jourSemaine * JOUR_MS);
  }
  const n = vue === 'semaine' ? 7 : 1;
  const jours = Array.from({ length: n }, (_, i) => partiesDouala(new Date(du.getTime() + i * JOUR_MS)).jour);
  return { du, au: new Date(du.getTime() + n * JOUR_MS), jours };
}

/** Décale un jour « AAAA-MM-JJ » de n jours. */
export function decalerJour(jour: string, n: number): string {
  const t = instantDouala(jour, '12:00') ?? new Date();
  return partiesDouala(new Date(t.getTime() + n * JOUR_MS)).jour;
}

const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' });
const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long' });

/** « jeudi 12 novembre à 10:00 ». */
export const libelleDebut = (t: Date) => `${FORMAT_DATE.format(t)} à ${FORMAT_HEURE.format(t)}`;
export const libelleHeure = (t: Date) => FORMAT_HEURE.format(t);
