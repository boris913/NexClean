// Collecte automatique (specs/COM4-01 RG-05) : lecture des flux RSS 2.0 / Atom et filtrage par
// requête. Module pur, sans dépendance (pas d'analyseur XML : les flux publics sont simples).

export interface ElementFlux {
  titre: string;
  lien: string | null;
  texte: string;
  publieLe: Date | null;
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', icirc: 'î', rsquo: '’', laquo: '«', raquo: '»' };

export function decoderEntites(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITES[e.toLowerCase()] ?? m;
  });
}

/** Contenu texte d'un fragment (CDATA, balises HTML et entités retirées, espaces réduits). */
export function texteBrut(s: string): string {
  const sansCdata = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Le HTML d'une description est souvent lui-même échappé : on décode, puis on retire les balises.
  const html = decoderEntites(sansCdata);
  return decoderEntites(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const balise = (bloc: string, ...noms: string[]) => {
  for (const n of noms) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i').exec(bloc);
    if (m) return m[1]!;
  }
  return null;
};

function date(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(texteBrut(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Éléments d'un flux RSS 2.0 (`<item>`) ou Atom (`<entry>`). */
export function lireFlux(xml: string, max = 200): ElementFlux[] {
  const blocs = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].slice(0, max);
  return blocs.map(([, , b]) => {
    const bloc = b!;
    const atomLien = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i.exec(bloc)?.[1];
    const lien = atomLien ? decoderEntites(atomLien) : texteBrut(balise(bloc, 'link', 'guid') ?? '') || null;
    return {
      titre: texteBrut(balise(bloc, 'title') ?? ''),
      lien: lien && /^https?:\/\//i.test(lien) ? lien : null,
      texte: texteBrut(balise(bloc, 'content:encoded', 'description', 'summary', 'content') ?? '').slice(0, 5000),
      publieLe: date(balise(bloc, 'pubDate', 'published', 'updated', 'dc:date')),
    };
  });
}

const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Mots trop généraux pour filtrer (présents dans presque toute annonce). */
const GENERIQUES = new Set(['recherche', 'recherchons', 'cherche', 'cherchons', 'besoin', 'urgent', 'urgence', 'demande', 'offre', 'poste', 'pour', 'avec', 'dans', 'sans']);

/** Mots significatifs d'une requête (4 lettres ou plus, hors mots généraux). */
export function motsRequete(requete: string): string[] {
  return [...new Set(normaliser(requete).split(' ').filter((m) => m.length >= 4 && !GENERIQUES.has(m)))];
}

/**
 * Première requête dont tous les mots significatifs figurent dans le texte (début de mot : le
 * pluriel et les dérivés passent). Sans requête, tout correspond (null).
 */
export function requeteCorrespondante(texte: string, requetes: string[]): { ok: boolean; requete: string | null } {
  if (!requetes.length) return { ok: true, requete: null };
  const mots = ` ${normaliser(texte)}`;
  for (const r of requetes) {
    const m = motsRequete(r);
    if (m.length && m.every((x) => mots.includes(` ${x}`))) return { ok: true, requete: r };
  }
  return { ok: false, requete: null };
}
