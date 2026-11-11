// Source d'acquisition (specs/COM1-01) : ce qui a amené le prospect, distinct du canal de la Demande.
// Fichier pur, sans dépendance serveur ni navigateur : partagé par le site, le serveur et les tests.
import { z } from 'zod';

export const SOURCES = {
  google_naturel: 'Google (recherche)',
  google_ads: 'Google Ads',
  google_maps: 'Google Maps',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  whatsapp_direct: 'WhatsApp direct',
  bouche_a_oreille: 'Bouche-à-oreille',
  prospection: 'Prospection',
  partenaire: 'Partenaire',
  autre: 'Autre',
  inconnue: 'Inconnue',
} as const;

export type Source = keyof typeof SOURCES;
export const SOURCE_CODES = Object.keys(SOURCES) as [Source, ...Source[]];

/** Canaux pour lesquels une saisie manuelle doit préciser la source (RG-03). */
export const CANAUX_SOURCE_OBLIGATOIRE = ['telephone', 'visite'] as const;

const texteCourt = z.string().trim().max(100).optional();

/** Un point de contact : source déduite et paramètres bruts qui l'expliquent. */
export const schemaContact = z.object({
  source: z.enum(SOURCE_CODES),
  utmSource: texteCourt,
  utmMedium: texteCourt,
  utmCampaign: texteCourt,
  referent: texteCourt,
  /** Horodatage ISO de la visite. */
  le: z.string().max(40),
});
export type Contact = z.infer<typeof schemaContact>;

/** Attribution conservée côté visiteur : premier contact (fait foi) et dernier contact (RG-02). */
export const schemaAttribution = z.object({ premier: schemaContact, dernier: schemaContact });
export type Attribution = z.infer<typeof schemaAttribution>;

export const COOKIE_SOURCE = 'nx_source';
export const DUREE_COOKIE_S = 30 * 24 * 60 * 60;

const contient = (v: string, ...motifs: string[]) => motifs.some((m) => v.includes(m));

function depuisUtm(source: string, medium: string): Source {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  // Codes courts : égalité stricte (« tt » ne doit pas reconnaître « twitter »).
  if (contient(s, 'facebook') || ['fb', 'meta'].includes(s)) return 'facebook';
  if (contient(s, 'instagram') || s === 'ig') return 'instagram';
  if (contient(s, 'tiktok') || s === 'tt') return 'tiktok';
  if (contient(s, 'whatsapp') || s === 'wa') return 'whatsapp_direct';
  if (contient(s, 'gbp', 'google_maps', 'maps') || (s.includes('google') && contient(m, 'maps', 'gbp', 'local'))) return 'google_maps';
  if (s.includes('google')) return contient(m, 'cpc', 'ppc', 'paid', 'ads') ? 'google_ads' : 'google_naturel';
  if (contient(s, 'prospection', 'veille')) return 'prospection';
  if (s.includes('partenaire')) return 'partenaire';
  return 'autre';
}

function depuisReferent(hote: string): Source {
  const h = hote.toLowerCase().replace(/^www\./, '');
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return h.startsWith('maps.') ? 'google_maps' : 'google_naturel';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
  if (/(^|\.)(wa\.me|whatsapp\.com)$/.test(h)) return 'whatsapp_direct';
  return 'autre';
}

/**
 * Source d'une visite, par ordre de priorité : UTM → identifiants de clic publicitaires → referrer.
 * Renvoie null pour une visite directe ou interne : elle ne renseigne rien et ne doit pas
 * remplacer une source connue.
 */
export function deduireContact(url: string, referrer: string, hoteSite: string, maintenant = new Date()): Contact | null {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }
  const le = maintenant.toISOString();
  const coupe = (v: string | null) => (v ? v.slice(0, 100) : undefined);
  const utmSource = params.get('utm_source');
  if (utmSource) {
    const utmMedium = params.get('utm_medium') ?? '';
    return { source: depuisUtm(utmSource, utmMedium), utmSource: coupe(utmSource), utmMedium: coupe(utmMedium || null), utmCampaign: coupe(params.get('utm_campaign')), le };
  }
  if (params.has('gclid') || params.has('gbraid') || params.has('wbraid')) return { source: 'google_ads', le };
  if (params.has('fbclid')) return { source: 'facebook', le };
  if (params.has('ttclid')) return { source: 'tiktok', le };
  if (!referrer) return null;
  let hote: string;
  try {
    hote = new URL(referrer).hostname;
  } catch {
    return null;
  }
  const site = hoteSite.toLowerCase().replace(/^www\./, '');
  if (hote.toLowerCase().replace(/^www\./, '') === site) return null;
  return { source: depuisReferent(hote), referent: coupe(hote), le };
}

/** Met à jour l'attribution avec une nouvelle visite : le premier contact n'est jamais remplacé. */
export function fusionnerAttribution(existante: Attribution | null, visite: Contact | null): Attribution | null {
  if (!visite) return existante;
  return existante ? { premier: existante.premier, dernier: visite } : { premier: visite, dernier: visite };
}

export function lireAttribution(valeur: string | undefined | null): Attribution | null {
  if (!valeur) return null;
  try {
    const r = schemaAttribution.safeParse(JSON.parse(decodeURIComponent(valeur)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export const ecrireAttribution = (a: Attribution) => encodeURIComponent(JSON.stringify(a));

// ─── Références dans les liens WhatsApp (RG-05) ───────────────

const ETIQUETTES: Partial<Record<Source, string>> = {
  facebook: 'FB',
  instagram: 'IG',
  tiktok: 'TT',
  google_naturel: 'GG',
  google_ads: 'GA',
  google_maps: 'GM',
};
const SOURCE_DE_ETIQUETTE = Object.fromEntries(Object.entries(ETIQUETTES).map(([s, e]) => [e, s])) as Record<string, Source>;

const MOTIF_REFERENCE = /\[(FB|IG|TT|GG|GA|GM|P-\d{1,6})\]/;

/** Référence courte à ajouter au texte prérempli d'un lien wa.me, ou null. */
export const etiquetteSource = (s: Source): string | null => ETIQUETTES[s] ?? null;

/** Ajoute la référence `[XX]` au texte s'il n'en porte pas déjà une. */
export function marquerTexte(texte: string, s: Source): string {
  const e = etiquetteSource(s);
  if (!e || MOTIF_REFERENCE.test(texte)) return texte;
  return `${texte.trimEnd()} [${e}]`;
}

/** Lecture inverse, pour les messages WhatsApp entrants (COM2-01 RG-06). */
export function referenceDepuisTexte(texte: string): { source: Source; piste?: string } | null {
  const m = MOTIF_REFERENCE.exec(texte);
  if (!m) return null;
  const code = m[1]!;
  if (code.startsWith('P-')) return { source: 'prospection', piste: code };
  return { source: SOURCE_DE_ETIQUETTE[code]! };
}
