// Veille prospects (specs/COM4-01, ADR 0027) : règles pures, sans dépendance serveur.
import { CONTACT } from '@/lib/constants';
import { normaliserTelephone } from '@/lib/telephone';

export const STATUTS_PISTE = {
  nouvelle: 'Nouvelle',
  retenue: 'Retenue',
  ecartee: 'Écartée',
  contactee: 'Contactée',
  en_conversation: 'En conversation',
  convertie: 'Convertie',
  sans_suite: 'Sans suite',
} as const;
export type StatutPiste = keyof typeof STATUTS_PISTE;
export const STATUTS_PISTE_CODES = Object.keys(STATUTS_PISTE) as [StatutPiste, ...StatutPiste[]];

export const MOTIFS_ECART = {
  hors_services: 'Hors services',
  hors_zone: 'Hors zone',
  pas_un_besoin: 'Pas un besoin de personnel ou de prestation',
  doublon: 'Doublon',
  ancienne: 'Publication trop ancienne',
  autre: 'Autre',
} as const;
export type MotifEcart = keyof typeof MOTIFS_ECART;

export const CANAUX_CONTACT = {
  annonce: 'Réponse à l’annonce',
  commentaire: 'Commentaire sous la publication',
  message_prive: 'Message privé sur la plateforme',
  email: 'E-mail',
  appel: 'Appel téléphonique',
} as const;
export type CanalContact = keyof typeof CANAUX_CONTACT;

/** RG-02 : transitions manuelles autorisées (la conversion vient de WhatsApp, RG-09). */
const TRANSITIONS: Record<StatutPiste, StatutPiste[]> = {
  nouvelle: ['retenue', 'ecartee'],
  retenue: ['ecartee', 'contactee'],
  ecartee: ['nouvelle'],
  contactee: ['en_conversation', 'sans_suite', 'convertie'],
  en_conversation: ['sans_suite', 'convertie'],
  convertie: [],
  sans_suite: ['retenue'],
};
export const transitionPossible = (de: StatutPiste, vers: StatutPiste) => TRANSITIONS[de].includes(vers);

/** RG-01 : référence courte `P-0042`. */
export const referencePiste = (id: number) => `P-${String(id).padStart(4, '0')}`;

/** RG-03 : URL comparable (sans protocole, « www. », fragment, paramètres de suivi ni barre finale). */
export function normaliserUrl(url: string): string | null {
  const brut = url.trim();
  if (!brut) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(brut) ? brut : `https://${brut}`);
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mibextid|igsh|ref$|s$|t$)/i.test(p)) u.searchParams.delete(p);
    u.searchParams.sort();
    const q = u.searchParams.toString();
    return `${u.hostname.replace(/^(www|m|mobile)\./i, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}${q ? `?${q}` : ''}`;
  } catch {
    return null;
  }
}

/**
 * RG-01 : contacts **publiés par l'auteur lui-même**. Seuls sont gardés les e-mails et numéros
 * présents littéralement dans le texte de la publication (l'IA ne peut pas en inventer).
 */
export function contactsPublies(texte: string, proposes: { email: string | null; telephone: string | null }): { email: string | null; telephone: string | null } {
  const emailsTexte = (texte.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []).map((e) => e.toLowerCase());
  const telsTexte = (texte.match(/\+?\d[\d\s.()-]{7,}\d/g) ?? []).map((t) => normaliserTelephone(t)).filter((t): t is string => !!t);
  const email = proposes.email && emailsTexte.includes(proposes.email.trim().toLowerCase()) ? proposes.email.trim().toLowerCase() : (emailsTexte[0] ?? null);
  const telPropose = proposes.telephone ? normaliserTelephone(proposes.telephone) : null;
  const telephone = telPropose && telsTexte.includes(telPropose) ? telPropose : (telsTexte[0] ?? null);
  return { email, telephone };
}

/** RG-07 : lien `wa.me` portant la référence de la Piste ; c'est le prospect qui ouvre la conversation. */
export const lienWhatsappPiste = (reference: string) => `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour NEXCLEAN [${reference}]`)}`;

/** Message d'approche complet : texte rédigé + invitation WhatsApp ajoutée par le code (jamais par l'IA). */
export const messageAvecLien = (texte: string, reference: string) => `${texte.trim()}\n\nÉcrivez-nous sur WhatsApp : ${lienWhatsappPiste(reference)}`;

/** RG-10 : relance unique, au moins `delaiJours` après le premier contact. */
export function relancePossible(contacts: { type: 'premier' | 'relance'; creeLe: Date }[], maintenant: Date, delaiJours = 5): { ok: true } | { ok: false; raison: string } {
  const premier = contacts.find((c) => c.type === 'premier');
  if (!premier) return { ok: false, raison: 'Piste pas encore contactée.' };
  if (contacts.some((c) => c.type === 'relance')) return { ok: false, raison: 'Cette piste a déjà été relancée une fois.' };
  const possibleLe = new Date(premier.creeLe.getTime() + delaiJours * 24 * 3600_000);
  if (maintenant < possibleLe) return { ok: false, raison: `Relance possible à partir du ${possibleLe.toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala' })}.` };
  return { ok: true };
}

/** Début de la journée à Douala (UTC+1), pour le plafond quotidien de contacts. */
export function debutJourDouala(d: Date): Date {
  const local = new Date(d.getTime() + 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 3600_000);
}
