// Veille prospects (specs/COM4-01 RG-04, RG-05) : référentiel des sources et collecte automatique.
// Seuls les flux publics (RSS / Atom) sont collectés ; les réseaux sociaux restent en saisie
// assistée et une API de recherche n'est branchée qu'avec l'accord de la Direction (ADR 0027 §2).
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { iaActive } from '@/lib/ia/client';
import { normaliserUrl, TYPES_AUTOMATISES, TYPES_SOURCE_CODES, type TypeSource } from './domaine';
import { lireFlux, requeteCorrespondante } from './flux';
import { ajouterPiste } from './service';

const HEURE_MS = 3600_000;
const DELAI_FLUX_MS = 15_000;
const TAILLE_MAX = 2_000_000;
/** Nouvelles pistes analysées par source et par passage (maîtrise du coût de l'IA). */
export const MAX_NOUVELLES_PAR_PASSAGE = 15;
const AGE_MAX_JOURS = 30;

export const schemaSource = z
  .object({
    nom: z.string().trim().min(2, 'Nom trop court').max(120),
    type: z.enum(TYPES_SOURCE_CODES),
    url: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .transform((u) => u || null),
    requetes: z
      .array(z.string().trim().min(3).max(200))
      .max(30)
      .transform((l) => [...new Set(l)]),
    frequenceHeures: z.number().int().min(1, 'Au moins 1 heure').max(168),
    actif: z.boolean(),
  })
  .refine((s) => !TYPES_AUTOMATISES.includes(s.type) || (s.url && /^https?:\/\//i.test(s.url)), { message: 'Indiquez l’adresse du flux (https://…).', path: ['url'] });

export async function listerSources() {
  return getDb().select().from(schema.sourceVeille).orderBy(asc(schema.sourceVeille.nom));
}

export async function enregistrerSource(id: number | null, entree: z.input<typeof schemaSource>, a: { id: string; ip?: string | null }): Promise<number> {
  const s = schemaSource.parse(entree);
  const db = getDb();
  if (id === null) {
    const [r] = await db.insert(schema.sourceVeille).values(s).returning({ id: schema.sourceVeille.id });
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'veille.source_creee', objetType: 'source_veille', objetId: r!.id, apres: s });
    return r!.id;
  }
  const [avant] = await db.select().from(schema.sourceVeille).where(eq(schema.sourceVeille.id, id));
  if (!avant) throw new ErreurMetier('Source introuvable.');
  await db.update(schema.sourceVeille).set({ ...s, majLe: new Date() }).where(eq(schema.sourceVeille.id, id));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'veille.source_modifiee', objetType: 'source_veille', objetId: id, avant: { nom: avant.nom, type: avant.type, url: avant.url, requetes: avant.requetes, actif: avant.actif }, apres: s });
  return id;
}

/** Téléchargement d'un flux public, borné en durée et en taille. */
export async function telechargerFlux(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(DELAI_FLUX_MS), headers: { 'User-Agent': 'VeilleNexclean/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const texte = await r.text();
  if (texte.length > TAILLE_MAX) throw new Error('Flux trop volumineux');
  return texte;
}

export interface BilanCollecte {
  lus: number;
  retenus: number;
  pistes: number;
  doublons: number;
}

/** RG-05 : collecte d'une source. Le texte de chaque élément retenu est qualifié comme une saisie assistée. */
export async function collecterSource(source: typeof schema.sourceVeille.$inferSelect, maintenant = new Date(), telecharger = telechargerFlux): Promise<BilanCollecte> {
  const bilan: BilanCollecte = { lus: 0, retenus: 0, pistes: 0, doublons: 0 };
  try {
    if (!TYPES_AUTOMATISES.includes(source.type as TypeSource) || !source.url) throw new Error('Méthode non automatisée : utilisez la saisie assistée.');
    const elements = lireFlux(await telecharger(source.url));
    bilan.lus = elements.length;
    const limite = maintenant.getTime() - AGE_MAX_JOURS * 24 * HEURE_MS;
    for (const el of elements) {
      if (bilan.pistes + bilan.doublons >= MAX_NOUVELLES_PAR_PASSAGE) break;
      if (el.publieLe && el.publieLe.getTime() < limite) continue;
      const texte = [el.titre, el.texte].filter(Boolean).join('\n').trim();
      if (texte.length < 20) continue;
      const corr = requeteCorrespondante(texte, source.requetes);
      if (!corr.ok) continue;
      bilan.retenus++;
      // Déjà vu : pas de nouvel appel à l'IA.
      if (el.lien) {
        const n = normaliserUrl(el.lien);
        if (n && (await getDb().select({ id: schema.piste.id }).from(schema.piste).where(eq(schema.piste.urlNormalisee, n)).limit(1)).length) continue;
      }
      const r = await ajouterPiste({ url: el.lien, texte: texte.slice(0, 6000) }, null, source.type, maintenant, { sourceId: source.id, requete: corr.requete, publieLe: el.publieLe });
      if (r.issue === 'creee') bilan.pistes++;
      else bilan.doublons++;
    }
    await getDb()
      .update(schema.sourceVeille)
      .set({ derniereCollecteLe: maintenant, dernierResultat: `${bilan.lus} élément(s) lu(s), ${bilan.retenus} correspondant aux requêtes, ${bilan.pistes} nouvelle(s) piste(s).` })
      .where(eq(schema.sourceVeille.id, source.id));
  } catch (e) {
    await getDb()
      .update(schema.sourceVeille)
      .set({ derniereCollecteLe: maintenant, dernierResultat: `Échec : ${e instanceof Error ? e.message.slice(0, 200) : 'erreur'}` })
      .where(eq(schema.sourceVeille.id, source.id));
  }
  return bilan;
}

/** Tâche planifiée : sources actives et automatisées dont la fréquence est échue. Sans IA, rien. */
export async function collecterSourcesDues(maintenant = new Date()): Promise<number> {
  if (!iaActive()) return 0;
  const sources = (await listerSources()).filter((s) => s.actif && TYPES_AUTOMATISES.includes(s.type) && (!s.derniereCollecteLe || maintenant.getTime() - s.derniereCollecteLe.getTime() >= s.frequenceHeures * HEURE_MS - 5 * 60_000));
  let pistes = 0;
  for (const s of sources) pistes += (await collecterSource(s, maintenant)).pistes;
  return pistes;
}
