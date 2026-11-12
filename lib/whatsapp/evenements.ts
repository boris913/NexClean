// COM2-01 RG-03, RG-04 : lecture des webhooks WhatsApp Cloud API — module pur.
// Champs traités : `messages` (messages reçus et statuts des messages envoyés) et
// `smb_message_echoes` (coexistence : messages envoyés depuis l'application du téléphone).

export type SensMessage = 'entrant' | 'sortant';
export type OrigineMessage = 'client' | 'application' | 'back_office';
export type StatutMessage = 'envoye' | 'remis' | 'lu' | 'echec';

export interface MediaRecu {
  mediaId: string;
  mime: string | null;
  nom: string | null;
}

export interface MessageNormalise {
  genre: 'message';
  waId: string;
  sens: SensMessage;
  origine: OrigineMessage;
  /** Numéro du client (E.164). */
  numero: string;
  nomProfil: string | null;
  horodatage: Date;
  type: string;
  texte: string;
  media: MediaRecu | null;
}

export interface StatutNormalise {
  genre: 'statut';
  waId: string;
  statut: StatutMessage;
  horodatage: Date;
  erreur: string | null;
}

export type EvenementWhatsApp = MessageNormalise | StatutNormalise;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const e164 = (waId: string | undefined | null) => {
  const chiffres = String(waId ?? '').replace(/\D/g, '');
  return chiffres.length >= 8 ? `+${chiffres}` : null;
};
const instant = (ts: string | number | undefined) => new Date(Number(ts ?? 0) * 1000);

const STATUTS: Record<string, StatutMessage> = { sent: 'envoye', delivered: 'remis', read: 'lu', failed: 'echec' };
const TYPES_MEDIA = ['image', 'document', 'audio', 'video', 'sticker'] as const;

/** Texte lisible d'un message, quel que soit son type (légende des médias, localisation, contact…). */
export function texteDuMessage(m: Json): string {
  switch (m?.type) {
    case 'text':
      return String(m.text?.body ?? '');
    case 'image':
    case 'video':
    case 'document':
      return String(m[m.type]?.caption ?? '');
    case 'audio':
      return m.audio?.voice ? 'Note vocale' : 'Fichier audio';
    case 'sticker':
      return 'Autocollant';
    case 'location': {
      const l = m.location ?? {};
      const nom = [l.name, l.address].filter(Boolean).join(', ');
      return `Localisation : ${nom ? `${nom} ` : ''}(${l.latitude}, ${l.longitude})`;
    }
    case 'contacts':
      return (m.contacts ?? [])
        .map((c: Json) => `Contact : ${c.name?.formatted_name ?? ''} ${(c.phones ?? []).map((p: Json) => p.phone).join(', ')}`.trim())
        .join('\n');
    case 'button':
      return String(m.button?.text ?? '');
    case 'interactive':
      return String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '');
    case 'reaction':
      return `Réaction ${m.reaction?.emoji ?? ''}`.trim();
    default:
      return `[Message de type « ${m?.type ?? 'inconnu'} » non pris en charge]`;
  }
}

function mediaDu(m: Json): MediaRecu | null {
  if (!TYPES_MEDIA.includes(m?.type)) return null;
  const x = m[m.type];
  return x?.id ? { mediaId: String(x.id), mime: x.mime_type ?? null, nom: x.filename ?? null } : null;
}

/** Événements normalisés d'un webhook ; ignore silencieusement ce qui n'est pas reconnu. */
export function lireWebhook(corps: Json): EvenementWhatsApp[] {
  if (corps?.object !== 'whatsapp_business_account') return [];
  const out: EvenementWhatsApp[] = [];
  for (const entree of corps.entry ?? []) {
    for (const ch of entree.changes ?? []) {
      const v = ch.value ?? {};
      if (ch.field === 'messages') {
        const noms = new Map<string, string>((v.contacts ?? []).map((c: Json) => [String(c.wa_id), c.profile?.name ?? null]));
        for (const m of v.messages ?? []) {
          const numero = e164(m.from);
          if (!numero || !m.id) continue;
          out.push({ genre: 'message', waId: String(m.id), sens: 'entrant', origine: 'client', numero, nomProfil: noms.get(String(m.from)) ?? null, horodatage: instant(m.timestamp), type: String(m.type ?? 'inconnu'), texte: texteDuMessage(m), media: mediaDu(m) });
        }
        for (const s of v.statuses ?? []) {
          const statut = STATUTS[s.status];
          if (!statut || !s.id) continue;
          const err = s.errors?.[0];
          out.push({ genre: 'statut', waId: String(s.id), statut, horodatage: instant(s.timestamp), erreur: err ? `${err.code ?? ''} ${err.title ?? err.message ?? ''}`.trim() : null });
        }
      } else if (ch.field === 'smb_message_echoes') {
        for (const m of v.message_echoes ?? []) {
          const numero = e164(m.to);
          if (!numero || !m.id) continue;
          out.push({ genre: 'message', waId: String(m.id), sens: 'sortant', origine: 'application', numero, nomProfil: null, horodatage: instant(m.timestamp), type: String(m.type ?? 'inconnu'), texte: texteDuMessage(m), media: mediaDu(m) });
        }
      }
    }
  }
  return out;
}
