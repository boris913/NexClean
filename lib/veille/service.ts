// Veille prospects (specs/COM4-01, ADR 0027) : ajout et qualification des pistes, approche,
// contacts (toujours faits par un humain, sur le canal d'origine), conversion depuis WhatsApp, purge.
import { and, asc, desc, eq, gte, ilike, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peut } from '@/lib/authz/permissions';
import type { Role } from '@/lib/domain/referentiels';
import { lireParametre } from '@/lib/parametres';
import { listesLieux } from '@/lib/geo/service';
import { notifier } from '@/lib/notifications';
import { ia, iaActive } from '@/lib/ia/client';
import { PROMPT_APPROCHE, PROMPT_VEILLE } from '@/lib/ia/prompts';
import { rapprocherLieu } from '@/lib/ia/copilote';
import { contientMontant } from '@/lib/ia/controle';
import { CANAUX_CONTACT, contactsPublies, debutJourDouala, MOTIFS_ECART, normaliserUrl, referencePiste, relancePossible, transitionPossible, type CanalContact, type MotifEcart, type StatutPiste } from './domaine';

export interface Acteur {
  id: string;
  roles: readonly Role[];
  ip?: string | null;
}

const JOUR_MS = 24 * 3600_000;
const TYPES_VEILLE = ['REC', 'MAD', 'NET', 'EV', 'ABO'] as const;

// ─── Qualification par l'IA (RG-05, RG-06) ─────────────────────

export const schemaAnalyse = z.object({
  pertinent: z.boolean(),
  motif_ecart: z.enum(['hors_services', 'pas_un_besoin']).nullable(),
  type: z.enum(TYPES_VEILLE).nullable(),
  postes: z.array(z.string()),
  effectif: z.number().int().nullable(),
  ville: z.string().nullable(),
  quartier: z.string().nullable(),
  date_publication: z.string().nullable(),
  contact_nom: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_telephone: z.string().nullable(),
  besoin: z.string(),
  score: z.number().int(),
  justification: z.string(),
});
export type Analyse = z.infer<typeof schemaAnalyse>;

export const schemaNouvellePiste = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .transform((u) => u || null),
  texte: z.string().trim().min(20, 'Collez le texte de la publication (20 caractères au moins).').max(6000, '6 000 caractères maximum'),
});

export type IssueAjout = { issue: 'creee'; pisteId: number; reference: string; statut: StatutPiste } | { issue: 'doublon'; pisteId: number; reference: string } | { issue: 'client_existant'; clientId: number; nom: string };

/** Client existant dont le numéro ou l'e-mail est celui de la publication. */
async function clientExistant(c: { email: string | null; telephone: string | null }) {
  const conditions: SQL[] = [];
  if (c.telephone) conditions.push(eq(schema.client.whatsapp, c.telephone), eq(schema.client.autreTelephone, c.telephone));
  if (c.email) conditions.push(ilike(schema.client.email, c.email));
  if (!conditions.length) return null;
  const [cli] = await getDb().select({ id: schema.client.id, nom: schema.client.nom }).from(schema.client).where(or(...conditions)).limit(1);
  return cli ?? null;
}

const datePublication = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? new Date(`${s}T12:00:00+01:00`) : null);

/**
 * RG-03, RG-05, RG-06 : ajout d'une piste (saisie assistée ou collecte). Dédoublonnage par URL puis
 * par contact et besoin sur 30 jours ; un contact déjà client est signalé au lieu d'ouvrir une piste ;
 * hors services ou hors zone → écartée d'office.
 */
export async function ajouterPiste(entree: z.input<typeof schemaNouvellePiste>, a: Acteur | null, source = 'saisie_assistee', maintenant = new Date(), collecte: { sourceId: number; requete: string | null; publieLe: Date | null } | null = null): Promise<IssueAjout> {
  const { url, texte } = schemaNouvellePiste.parse(entree);
  const db = getDb();
  const urlNormalisee = url ? normaliserUrl(url) : null;
  if (url && !urlNormalisee) throw new ErreurMetier('Lien invalide.');
  if (urlNormalisee) {
    const [deja] = await db.select({ id: schema.piste.id }).from(schema.piste).where(eq(schema.piste.urlNormalisee, urlNormalisee));
    if (deja) return { issue: 'doublon', pisteId: deja.id, reference: referencePiste(deja.id) };
  }

  const jour = new Date(maintenant.getTime() + 3600_000).toISOString().slice(0, 10);
  const analyse = await ia().extraire(PROMPT_VEILLE, `Date du jour : ${jour}.${url ? `\nLien : ${url}` : ''}\n\nPublication :\n${texte}`, schemaAnalyse, { tache: 'veille', collaborateurId: a?.id ?? null });
  const contacts = contactsPublies(texte, { email: analyse?.contact_email ?? null, telephone: analyse?.contact_telephone ?? null });

  const cli = await clientExistant(contacts);
  if (cli) {
    await db.insert(schema.signalementClient).values({ clientId: cli.id, url, extrait: texte.slice(0, 2000), creePar: a?.id ?? null });
    await journaliser({ acteurType: a ? 'collaborateur' : 'systeme', acteurId: a?.id ?? null, ip: a?.ip ?? null, action: 'veille.client_existant', objetType: 'client', objetId: cli.id, details: { url } });
    return { issue: 'client_existant', clientId: cli.id, nom: cli.nom };
  }

  const type = analyse?.type ?? null;
  if (contacts.email || contacts.telephone) {
    const memeContact = or(...[contacts.telephone ? eq(schema.piste.contactTelephone, contacts.telephone) : null, contacts.email ? eq(schema.piste.contactEmail, contacts.email) : null].filter((c): c is SQL => !!c));
    const [deja] = await db
      .select({ id: schema.piste.id })
      .from(schema.piste)
      .where(and(memeContact, gte(schema.piste.creeLe, new Date(maintenant.getTime() - 30 * JOUR_MS)), type ? eq(schema.piste.type, type) : sql`true`))
      .limit(1);
    if (deja) return { issue: 'doublon', pisteId: deja.id, reference: referencePiste(deja.id) };
  }

  const lieux = await listesLieux();
  const lieu = analyse ? rapprocherLieu(analyse, lieux) : { villeId: null, quartierId: null };
  const ville = lieux.find((v) => v.id === lieu.villeId);
  let statut: StatutPiste = 'nouvelle';
  let motifEcart: MotifEcart | null = null;
  if (analyse && !analyse.pertinent) {
    statut = 'ecartee';
    motifEcart = analyse.motif_ecart ?? 'pas_un_besoin';
  } else if (analyse && ((analyse.ville && !ville) || (ville && !ville.couverte))) {
    // Ville citée absente du référentiel ou non couverte. Un quartier seul, inconnu, ne suffit pas à écarter.
    statut = 'ecartee';
    motifEcart = 'hors_zone';
  }
  const quartierConnu = !!lieu.quartierId;
  const [p] = await db
    .insert(schema.piste)
    .values({
      source,
      url,
      urlNormalisee,
      extrait: texte,
      sourceId: collecte?.sourceId ?? null,
      requete: collecte?.requete ?? null,
      publieLe: collecte?.publieLe ?? datePublication(analyse?.date_publication ?? null),
      type,
      postes: (analyse?.postes ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 10),
      effectif: analyse?.effectif && analyse.effectif > 0 && analyse.effectif < 1000 ? analyse.effectif : null,
      besoin: analyse?.besoin?.slice(0, 500) ?? null,
      villeId: lieu.villeId,
      quartierId: lieu.quartierId,
      lieuTexte: !quartierConnu && analyse?.quartier ? analyse.quartier : !lieu.villeId && analyse?.ville ? analyse.ville : null,
      contactNom: analyse?.contact_nom?.slice(0, 200) ?? null,
      contactEmail: contacts.email,
      contactTelephone: contacts.telephone,
      score: analyse ? Math.max(0, Math.min(100, analyse.score)) : null,
      justification: analyse ? analyse.justification.slice(0, 500) : iaActive() ? 'Qualification IA indisponible : à qualifier à la main.' : null,
      statut,
      motifEcart,
      versionPrompt: analyse ? PROMPT_VEILLE.version : null,
      assigneA: a?.id ?? null,
      creePar: a?.id ?? null,
    })
    .returning({ id: schema.piste.id });
  await journaliser({ acteurType: a ? 'collaborateur' : 'systeme', acteurId: a?.id ?? null, ip: a?.ip ?? null, action: 'veille.piste_ajoutee', objetType: 'piste', objetId: p!.id, details: { source, statut, motifEcart } });
  return { issue: 'creee', pisteId: p!.id, reference: referencePiste(p!.id), statut };
}

// ─── Statuts et approche (RG-02, RG-07) ────────────────────────

async function lirePiste(id: number) {
  const [p] = await getDb().select().from(schema.piste).where(eq(schema.piste.id, id));
  if (!p) throw new ErreurMetier('Piste introuvable.');
  return p;
}

export async function changerStatutPiste(id: number, vers: StatutPiste, motif: MotifEcart | null, a: Acteur): Promise<typeof schema.piste.$inferSelect> {
  const p = await lirePiste(id);
  if (!transitionPossible(p.statut, vers)) throw new ErreurMetier(`Passage impossible de « ${p.statut} » à « ${vers} ».`);
  if (vers === 'ecartee' && !(motif && motif in MOTIFS_ECART)) throw new ErreurMetier('Indiquez le motif.');
  if (vers === 'contactee') throw new ErreurMetier('Utilisez « Marquer contactée » pour enregistrer le contact.');
  await getDb()
    .update(schema.piste)
    .set({ statut: vers, motifEcart: vers === 'ecartee' ? motif : null, assigneA: vers === 'retenue' ? (p.assigneA ?? a.id) : p.assigneA, majLe: new Date() })
    .where(eq(schema.piste.id, id));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'veille.statut', objetType: 'piste', objetId: id, avant: { statut: p.statut }, apres: { statut: vers, motif } });
  return p;
}

/** Canal proposé par défaut selon ce que l'on sait du contact. */
export const canalParDefaut = (p: { contactEmail: string | null; url: string | null }): CanalContact => (p.contactEmail ? 'email' : p.url && /facebook|tiktok|instagram|linkedin/i.test(p.url) ? 'commentaire' : 'annonce');

/**
 * RG-07 : message d'approche rédigé par l'IA, adapté au canal. Aucun prix ; ni lien ni numéro (le
 * lien wa.me avec la référence est ajouté par le code). Rejeté s'il enfreint ces règles.
 */
export async function redigerApproche(id: number, canal: CanalContact, a: Acteur): Promise<string> {
  if (!(canal in CANAUX_CONTACT)) throw new ErreurMetier('Canal inconnu.');
  if (!iaActive()) throw new ErreurMetier('La clé de l’API IA n’est pas configurée : rédigez le message vous-même.');
  const p = await lirePiste(id);
  const [ville] = p.villeId ? await getDb().select({ nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.id, p.villeId)) : [];
  const contenu = [`Canal : ${CANAUX_CONTACT[canal]}`, p.besoin && `Besoin : ${p.besoin}`, p.postes.length && `Postes : ${p.postes.join(', ')}`, p.effectif && `Effectif : ${p.effectif}`, (ville?.nom || p.lieuTexte) && `Lieu : ${[p.lieuTexte, ville?.nom].filter(Boolean).join(', ')}`, p.contactNom && `Auteur : ${p.contactNom}`, `Publication :\n${p.extrait.slice(0, 1500)}`].filter(Boolean).join('\n');
  const texte = await ia().rediger(PROMPT_APPROCHE, contenu, { tache: 'veille_approche', collaborateurId: a.id }, { maxTokens: 800 });
  if (!texte) throw new ErreurMetier('Message indisponible pour le moment : réessayez ou rédigez-le vous-même.');
  if (contientMontant(texte) || /https?:\/\/|www\.|\+?\d[\d\s.-]{7,}\d/i.test(texte)) throw new ErreurMetier('Le message proposé contenait un prix, un lien ou un numéro : il a été écarté. Réessayez.');
  await getDb().update(schema.piste).set({ message: texte, versionPrompt: PROMPT_APPROCHE.version, majLe: new Date() }).where(eq(schema.piste.id, id));
  return texte;
}

export async function enregistrerMessage(id: number, texte: string, a: Acteur): Promise<void> {
  const t = z.string().trim().min(10, 'Message trop court').max(3000).parse(texte);
  if (contientMontant(t)) throw new ErreurMetier('Pas de prix ferme dans le premier message (l’estimation se donne ensuite, sur WhatsApp).');
  await lirePiste(id);
  await getDb().update(schema.piste).set({ message: t, majLe: new Date() }).where(eq(schema.piste.id, id));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'veille.message_modifie', objetType: 'piste', objetId: id });
}

// ─── Contacts (RG-08, RG-10) ───────────────────────────────────

/**
 * RG-08 : le collaborateur a envoyé lui-même le message sur le canal d'origine ; on enregistre
 * date, canal et texte. RG-10 : plafond quotidien par collaborateur, une seule relance après 5 jours.
 */
export async function marquerContactee(id: number, e: { canal: CanalContact; texte: string }, a: Acteur, maintenant = new Date(), envoyer?: (p: typeof schema.piste.$inferSelect) => Promise<void>): Promise<'premier' | 'relance'> {
  if (!(e.canal in CANAUX_CONTACT)) throw new ErreurMetier('Canal inconnu.');
  const texte = z.string().trim().min(10, 'Collez le texte envoyé.').max(3000).parse(e.texte);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.piste).where(eq(schema.piste.id, id)).for('update');
    if (!p) throw new ErreurMetier('Piste introuvable.');
    let type: 'premier' | 'relance';
    if (p.statut === 'retenue') type = 'premier';
    else if (p.statut === 'contactee' || p.statut === 'en_conversation') type = 'relance';
    else throw new ErreurMetier(p.statut === 'nouvelle' ? 'Retenez d’abord la piste.' : 'Cette piste ne peut plus être contactée.');
    const [plafond, delai] = await Promise.all([lireParametre('veille_plafond_contacts_jour'), lireParametre('veille_delai_relance_jours')]);
    if (type === 'relance') {
      const contacts = await tx.select({ type: schema.contactPiste.type, creeLe: schema.contactPiste.creeLe }).from(schema.contactPiste).where(eq(schema.contactPiste.pisteId, id));
      const r = relancePossible(contacts, maintenant, delai);
      if (!r.ok) throw new ErreurMetier(r.raison);
    }
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.contactPiste)
      .where(and(eq(schema.contactPiste.collaborateurId, a.id), gte(schema.contactPiste.creeLe, debutJourDouala(maintenant))))) as [{ n: number }];
    if (n >= plafond) throw new ErreurMetier(`Plafond atteint : ${plafond} pistes contactées aujourd’hui.`);
    // Envoi par le Back-Office (e-mail) après tous les contrôles ; en cas d'échec, rien n'est enregistré.
    if (envoyer) await envoyer(p);
    await tx.insert(schema.contactPiste).values({ pisteId: id, type, canal: e.canal, texte, collaborateurId: a.id, creeLe: maintenant });
    await tx
      .update(schema.piste)
      .set({ statut: type === 'premier' ? 'contactee' : p.statut, assigneA: p.assigneA ?? a.id, majLe: maintenant })
      .where(eq(schema.piste.id, id));
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: type === 'premier' ? 'veille.contactee' : 'veille.relancee', objetType: 'piste', objetId: id, details: { canal: e.canal } }, tx);
    return type;
  });
}

// ─── Conversion depuis WhatsApp (RG-09) ────────────────────────

/**
 * Le prospect écrit sur WhatsApp avec `[P-xxxx]` : la Piste passe à `convertie` et pointe vers le
 * Dossier créé (source `prospection`). Idempotent ; ne lève pas.
 */
export async function convertirPiste(reference: string, dossierId: number, maintenant = new Date()): Promise<boolean> {
  try {
    const id = Number(/^P-(\d{1,6})$/.exec(reference)?.[1]);
    if (!id) return false;
    const [p] = await getDb()
      .update(schema.piste)
      .set({ statut: 'convertie', dossierId, convertieLe: maintenant, majLe: maintenant })
      .where(and(eq(schema.piste.id, id), ne(schema.piste.statut, 'convertie')))
      .returning({ id: schema.piste.id, assigneA: schema.piste.assigneA });
    if (!p) return false;
    await journaliser({ acteurType: 'systeme', action: 'veille.convertie', objetType: 'piste', objetId: id, details: { dossierId } });
    if (p.assigneA) await notifier({ destinataires: [p.assigneA], type: 'veille_conversion', dossierId, titre: `Piste ${reference} convertie`, texte: `Le prospect de la piste ${reference} a écrit sur WhatsApp : un dossier a été créé.`, lien: `/admin/dossiers/${dossierId}`, cle: `veille_conversion:${id}` });
    return true;
  } catch (e) {
    console.error('[veille] conversion', reference, e);
    return false;
  }
}

// ─── Lecture (RG-11) et purge (RG-02) ──────────────────────────

export interface FiltresPistes {
  statut?: StatutPiste | 'a_traiter' | 'toutes';
  villeId?: number;
  type?: (typeof TYPES_VEILLE)[number];
  source?: string;
  mes?: boolean;
}

export async function listerPistes(f: FiltresPistes, a: Acteur, limite = 100) {
  const p = schema.piste;
  const conditions: SQL[] = [];
  if (!f.statut || f.statut === 'a_traiter') conditions.push(inArray(p.statut, ['nouvelle', 'retenue', 'contactee', 'en_conversation']));
  else if (f.statut !== 'toutes') conditions.push(eq(p.statut, f.statut));
  if (f.villeId) conditions.push(eq(p.villeId, f.villeId));
  if (f.type) conditions.push(eq(p.type, f.type));
  if (f.source) conditions.push(eq(p.source, f.source));
  if (f.mes || !peut(a.roles, 'veille.gerer')) conditions.push(or(eq(p.assigneA, a.id), sql`${p.assigneA} is null`)!);
  const lignes = await getDb()
    .select({
      id: p.id,
      source: p.source,
      sourceNom: schema.sourceVeille.nom,
      requete: p.requete,
      url: p.url,
      extrait: p.extrait,
      publieLe: p.publieLe,
      type: p.type,
      postes: p.postes,
      effectif: p.effectif,
      besoin: p.besoin,
      ville: schema.ville.nom,
      quartier: schema.quartier.nom,
      lieuTexte: p.lieuTexte,
      contactNom: p.contactNom,
      contactEmail: p.contactEmail,
      contactTelephone: p.contactTelephone,
      score: p.score,
      justification: p.justification,
      statut: p.statut,
      motifEcart: p.motifEcart,
      message: p.message,
      dossierId: p.dossierId,
      assigneA: p.assigneA,
      assigne: schema.user.name,
      creeLe: p.creeLe,
      contacts: sql<{ type: 'premier' | 'relance'; canal: string; creeLe: string }[]>`coalesce((select json_agg(json_build_object('type', c.type, 'canal', c.canal, 'creeLe', c.cree_le) order by c.cree_le) from contact_piste c where c.piste_id = ${p.id}), '[]'::json)`,
    })
    .from(p)
    .leftJoin(schema.ville, eq(schema.ville.id, p.villeId))
    .leftJoin(schema.quartier, eq(schema.quartier.id, p.quartierId))
    .leftJoin(schema.user, eq(schema.user.id, p.assigneA))
    .leftJoin(schema.sourceVeille, eq(schema.sourceVeille.id, p.sourceId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${p.score} desc nulls last`, desc(p.creeLe), asc(p.id))
    .limit(limite);
  return lignes.map((l) => ({ ...l, reference: referencePiste(l.id), contacts: l.contacts.map((c) => ({ ...c, creeLe: new Date(c.creeLe) })) }));
}

/** RG-02 : pistes non converties supprimées après `veille_purge_jours` (90 par défaut). */
export async function purgerPistes(maintenant = new Date()): Promise<number> {
  const jours = await lireParametre('veille_purge_jours');
  const r = await getDb()
    .delete(schema.piste)
    .where(and(ne(schema.piste.statut, 'convertie'), lt(schema.piste.creeLe, new Date(maintenant.getTime() - jours * JOUR_MS))))
    .returning({ id: schema.piste.id });
  return r.length;
}

/**
 * RG-08 : e-mail professionnel envoyé depuis le Back-Office, au nom de NEXCLEAN, réponse au
 * collaborateur. Seulement à l'adresse publiée par l'auteur ; mêmes plafonds que tout contact.
 */
export async function envoyerEmailApproche(id: number, e: { objet: string; texte: string }, a: Acteur, maintenant = new Date()): Promise<'premier' | 'relance'> {
  const objet = z.string().trim().min(3, 'Objet trop court').max(150).parse(e.objet);
  const texte = z.string().trim().min(20, 'Message trop court').max(4000).parse(e.texte);
  if (contientMontant(texte)) throw new ErreurMetier('Pas de prix ferme dans un premier message.');
  const [moi] = await getDb().select({ email: schema.user.email, nom: schema.user.name }).from(schema.user).where(eq(schema.user.id, a.id));
  return marquerContactee(id, { canal: 'email', texte: `${objet}\n\n${texte}` }, a, maintenant, async (p) => {
    if (!p.contactEmail) throw new ErreurMetier('Aucune adresse e-mail publiée par l’auteur de cette piste.');
    const { envoyerEmail, echapperHtml } = await import('@/lib/email');
    const corps = `${texte}\n\n${moi?.nom ?? 'L’équipe'} — NEXCLEAN`;
    await envoyerEmail({ to: p.contactEmail, subject: objet, text: corps, html: `<div style="font-family:sans-serif;white-space:pre-line">${echapperHtml(corps).replace(/(https:\/\/wa\.me\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`, replyTo: moi?.email ?? undefined });
  });
}
