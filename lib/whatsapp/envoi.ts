// WhatsApp Cloud API, envoi (specs/COM2-02) : réponses du Back-Office, modèles Meta, réponses
// automatiques, STOP et consentement, note de qualité. Sans configuration complète (jeton + numéro),
// rien n'est envoyé : l'interface propose le repli wa.me (ADR 0005).
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peut } from '@/lib/authz/permissions';
import { peutTraiter, type Demandeur } from '@/lib/dossiers/acces';
import { lireParametre } from '@/lib/parametres';
import { idsDirection, notifier } from '@/lib/notifications';
// Lecture directe du référentiel (pas lib/geo/couverture : next/cache n'existe pas dans la tâche planifiée).
import { couverturePublique } from '@/lib/geo/service';
import { services } from '@/content/services-data';
import { contexteDossier } from '@/lib/modeles/service';
import { rendreMessage, type Variable } from '@/lib/modeles/variables';
import { automateSuspendu, contientPrix, doitAccuser, estStop, fenetreOuverte, libelleHoraires, libelleOuverture, marketingAutorise, ouverture, remplir, reponseRapide } from './automate';

const JOUR_MS = 24 * 60 * 60 * 1000;
type Acteur = Demandeur & { ip?: string | null; nom?: string };

export const envoiActif = () => !!(env().WHATSAPP_ACCESS_TOKEN && env().WHATSAPP_PHONE_NUMBER_ID);

/** Repli ADR 0005 : lien wa.me prérempli, ouvert par le collaborateur sur son téléphone. */
export const lienWaMe = (numero: string, texte = '') => `https://wa.me/${numero.replace(/\D/g, '')}${texte ? `?text=${encodeURIComponent(texte)}` : ''}`;

export class ErreurEnvoi extends ErreurMetier {
  constructor(message: string, readonly repli: string) {
    super(message);
  }
}

// ─── API Graph ────────────────────────────────────────────────

async function graphJson<T>(chemin: string, init?: { method: 'POST'; corps: unknown }): Promise<T> {
  const { WHATSAPP_ACCESS_TOKEN: jeton, WHATSAPP_GRAPH_VERSION: version } = env();
  if (!jeton) throw new Error('WHATSAPP_ACCESS_TOKEN manquant');
  const r = await fetch(`https://graph.facebook.com/${version}/${chemin}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${jeton}`, ...(init ? { 'Content-Type': 'application/json' } : {}) },
    body: init ? JSON.stringify(init.corps) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!r.ok) throw new Error(`Meta ${r.status}${json.error ? ` : ${json.error.code ?? ''} ${json.error.message ?? ''}` : ''}`.trim());
  return json;
}

type Contenu = { type: 'text'; text: { body: string; preview_url: boolean } } | { type: 'template'; template: { name: string; language: { code: string }; components?: unknown[] } };

async function posterMessage(numero: string, contenu: Contenu): Promise<string> {
  const r = await graphJson<{ messages?: { id: string }[] }>(`${env().WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: 'POST', corps: { messaging_product: 'whatsapp', recipient_type: 'individual', to: numero.replace(/\D/g, ''), ...contenu } });
  const id = r.messages?.[0]?.id;
  if (!id) throw new Error('Réponse Meta sans identifiant de message');
  return id;
}

// ─── Enregistrement ───────────────────────────────────────────

async function enregistrerSortant(conv: { id: number; dossierId: number | null }, o: { waId: string; texte: string; auteurId: string | null; automatique: boolean; modele?: string | null; categorie?: 'utility' | 'marketing' | 'authentication' | null }, maintenant: Date) {
  const db = getDb();
  await db.insert(schema.messageWhatsapp).values({ conversationId: conv.id, waId: o.waId, sens: 'sortant', origine: 'back_office', type: o.modele ? 'template' : 'text', texte: o.texte, horodatage: maintenant, statut: 'envoye', statutLe: maintenant, automatique: o.automatique, auteurId: o.auteurId, modele: o.modele ?? null, categorie: o.categorie ?? null });
  // Seule une réponse humaine rend la conversation « traitée » et suspend l'automate (RG-08).
  if (!o.automatique) await db.update(schema.conversation).set({ dernierSortantLe: maintenant }).where(eq(schema.conversation.id, conv.id));
  if (conv.dossierId) {
    await db.insert(schema.evenementDossier).values({ dossierId: conv.dossierId, auteurId: o.auteurId, type: 'whatsapp', horodatage: maintenant, commentaire: `${o.automatique ? 'Réponse automatique WhatsApp' : 'WhatsApp envoyé'}${o.modele ? ` (modèle ${o.modele})` : ''} : ${o.texte.slice(0, 500)}` });
    if (!o.automatique) await db.update(schema.dossier).set({ derniereActionLe: maintenant }).where(eq(schema.dossier.id, conv.dossierId));
  }
}

async function conversationPourEcriture(id: number, a: Acteur) {
  const [c] = await getDb()
    .select({ id: schema.conversation.id, numero: schema.conversation.numero, dossierId: schema.conversation.dossierId, candidatId: schema.conversation.candidatId, dernierEntrantLe: schema.conversation.dernierEntrantLe, automate: schema.conversation.automate, referentId: schema.dossier.referentId })
    .from(schema.conversation)
    .leftJoin(schema.dossier, eq(schema.dossier.id, schema.conversation.dossierId))
    .where(eq(schema.conversation.id, id));
  if (!c) throw new ErreurMetier('Conversation introuvable.');
  if (!peut(a.roles, 'messagerie.voir_tout') && !(c.dossierId && peutTraiter(a, c.referentId))) throw new ErreurMetier('Accès refusé.');
  return c;
}

// ─── Envois du Back-Office (RG-01..04) ────────────────────────

/** Texte libre, uniquement dans la fenêtre de service de 24 h (RG-02). */
export async function envoyerTexte(conversationId: number, texte: string, a: Acteur, maintenant = new Date()): Promise<void> {
  const corps = texte.trim();
  if (!corps) throw new ErreurMetier('Message vide.');
  if (corps.length > 4096) throw new ErreurMetier('Message trop long (4 096 caractères maximum).');
  const c = await conversationPourEcriture(conversationId, a);
  if (!fenetreOuverte(c.dernierEntrantLe, maintenant)) throw new ErreurMetier('Le client n’a pas écrit depuis plus de 24 h : seul un modèle approuvé par Meta peut être envoyé.');
  if (!envoiActif()) throw new ErreurEnvoi('L’envoi WhatsApp depuis le Back-Office n’est pas encore activé.', lienWaMe(c.numero, corps));
  let waId: string;
  try {
    waId = await posterMessage(c.numero, { type: 'text', text: { body: corps, preview_url: true } });
  } catch (e) {
    throw new ErreurEnvoi(`Échec de l’envoi (${e instanceof Error ? e.message : e}).`, lienWaMe(c.numero, corps));
  }
  await enregistrerSortant(c, { waId, texte: corps, auteurId: a.id, automatique: false }, maintenant);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'whatsapp.message_envoye', objetType: 'conversation', objetId: conversationId });
}

/** Modèles proposables : dans la fenêtre, tous ceux qui ont un nom Meta approuvé ; hors fenêtre, idem (RG-02, RG-03). */
export async function modelesMetaApprouves() {
  return getDb()
    .select({ id: schema.modeleMessage.id, nom: schema.modeleMessage.nom, texte: schema.modeleMessage.texte, metaNom: schema.modeleMessage.metaNom, metaCategorie: schema.modeleMessage.metaCategorie })
    .from(schema.modeleMessage)
    .where(and(eq(schema.modeleMessage.actif, true), eq(schema.modeleMessage.metaStatut, 'APPROVED'), sql`${schema.modeleMessage.metaNom} is not null`));
}

/** RG-03 : envoi d'un modèle approuvé par Meta (hors fenêtre ou non), paramètres tirés du Dossier. */
export async function envoyerModele(conversationId: number, modeleId: number, a: Acteur, maintenant = new Date()): Promise<void> {
  const c = await conversationPourEcriture(conversationId, a);
  const [m] = await getDb().select().from(schema.modeleMessage).where(eq(schema.modeleMessage.id, modeleId));
  if (!m || !m.actif) throw new ErreurMetier('Modèle introuvable.');
  if (!m.metaNom || m.metaStatut !== 'APPROVED') throw new ErreurMetier('Ce modèle n’est pas approuvé par Meta : il ne peut pas être envoyé.');
  const categorie = (m.metaCategorie?.toLowerCase() ?? 'utility') as 'utility' | 'marketing' | 'authentication';
  if (categorie === 'marketing') await verifierMarketing(c.numero, c.id, maintenant);
  const ctx = c.dossierId ? await contexteDossier(c.dossierId, { id: a.id, nom: a.nom ?? '' }) : {};
  const texte = rendreMessage(m.texte, ctx);
  const params = m.metaParametres.map((v) => ({ type: 'text', text: (ctx[v as Variable] ?? '').slice(0, 1000) || '-' }));
  if (!envoiActif()) throw new ErreurEnvoi('L’envoi WhatsApp depuis le Back-Office n’est pas encore activé.', lienWaMe(c.numero, texte));
  let waId: string;
  try {
    waId = await posterMessage(c.numero, { type: 'template', template: { name: m.metaNom, language: { code: m.metaLangue }, ...(params.length ? { components: [{ type: 'body', parameters: params }] } : {}) } });
  } catch (e) {
    throw new ErreurEnvoi(`Échec de l’envoi du modèle (${e instanceof Error ? e.message : e}).`, lienWaMe(c.numero, texte));
  }
  await enregistrerSortant(c, { waId, texte, auteurId: a.id, automatique: false, modele: m.metaNom, categorie }, maintenant);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'whatsapp.modele_envoye', objetType: 'conversation', objetId: conversationId, details: { modele: m.metaNom, categorie } });
}

/** RG-08 : « Reprendre la main » (manuel) / « Rendre la main à l'automate » (actif). */
export async function changerAutomate(conversationId: number, mode: 'actif' | 'manuel', a: Acteur): Promise<void> {
  await conversationPourEcriture(conversationId, a);
  await getDb().update(schema.conversation).set({ automate: mode }).where(eq(schema.conversation.id, conversationId));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: mode === 'manuel' ? 'whatsapp.main_reprise' : 'whatsapp.main_rendue', objetType: 'conversation', objetId: conversationId });
}

// ─── Consentement marketing (RG-09, RG-10) ────────────────────

export async function etatConsentement(numero: string) {
  const [c] = await getDb().select().from(schema.consentementWhatsapp).where(eq(schema.consentementWhatsapp.numero, numero));
  return c ?? null;
}

/** Accord explicite (date, formulation, canal), saisi par un collaborateur ; journalisé. */
export async function enregistrerAccord(numero: string, formulation: string, canal: string, a: Acteur, maintenant = new Date()): Promise<void> {
  if (formulation.trim().length < 10) throw new ErreurMetier('Indiquez la formulation exacte de l’accord.');
  await getDb()
    .insert(schema.consentementWhatsapp)
    .values({ numero, accordLe: maintenant, formulation: formulation.trim(), canal, majLe: maintenant })
    .onConflictDoUpdate({ target: schema.consentementWhatsapp.numero, set: { accordLe: maintenant, formulation: formulation.trim(), canal, retireLe: null, majLe: maintenant } });
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'whatsapp.accord_marketing', objetType: 'consentement', objetId: numero, apres: { formulation, canal } });
}

async function verifierMarketing(numero: string, conversationId: number, maintenant = new Date()) {
  const [consentement, plafond, qualite, envois] = await Promise.all([
    etatConsentement(numero),
    lireParametre('wa_plafond_marketing_semaine'),
    lireEtat<{ note: string }>('qualite'),
    getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.messageWhatsapp)
      .where(and(eq(schema.messageWhatsapp.conversationId, conversationId), eq(schema.messageWhatsapp.categorie, 'marketing'), gte(schema.messageWhatsapp.horodatage, new Date(maintenant.getTime() - 7 * JOUR_MS)))),
  ]);
  const v = marketingAutorise({ accordLe: consentement?.accordLe ?? null, retireLe: consentement?.retireLe ?? null, envoisSemaine: envois[0]?.n ?? 0, plafond, qualite: qualite?.note ?? null });
  if (!v.ok) throw new ErreurMetier(v.raison);
}

// ─── Réponses automatiques (RG-06..09), appelées à la réception ──

async function envoyerAutomatique(conv: { id: number; numero: string; dossierId: number | null }, texte: string, maintenant: Date, options: { autoriserMontants?: boolean } = {}): Promise<boolean> {
  // Les réponses automatiques n'annoncent jamais de prix ; l'agent (COM3-02) contrôle les siens lui-même.
  if (!envoiActif() || (!options.autoriserMontants && contientPrix(texte))) return false;
  try {
    const waId = await posterMessage(conv.numero, { type: 'text', text: { body: texte, preview_url: true } });
    await enregistrerSortant(conv, { waId, texte, auteurId: null, automatique: true }, maintenant);
    return true;
  } catch (e) {
    console.error('[whatsapp] réponse automatique', conv.id, e);
    return false;
  }
}

async function variablesAutomatiques(dossierId: number | null, maintenant: Date) {
  const [horaires, villes] = await Promise.all([lireParametre('heures_ouvrees'), couverturePublique().then((c) => c.villes).catch(() => [] as string[])]);
  const zones = villes.length > 1 ? `${villes.slice(0, -1).join(', ')} et ${villes.at(-1)}` : (villes[0] ?? 'Douala et Yaoundé');
  const [d] = dossierId ? await getDb().select({ numero: schema.dossier.numero, jeton: schema.dossier.jetonSuivi }).from(schema.dossier).where(eq(schema.dossier.id, dossierId)) : [];
  const o = ouverture(maintenant, horaires);
  return {
    horaires,
    ouvert: o.ouvert,
    valeurs: {
      numero: d?.numero ?? null,
      suivi: d ? `${env().BETTER_AUTH_URL}/suivi/${d.jeton}` : null,
      horaires: libelleHoraires(horaires),
      ouverture: libelleOuverture(o.prochaine, maintenant),
      zones,
      services: services.map((s) => s.name).join(', '),
    },
  };
}

/**
 * Après l'enregistrement d'un message entrant : STOP (toujours traité), puis accusé de réception
 * (premier message ou après 7 jours), sinon réponse rapide par mot-clé — sauf reprise manuelle
 * ou réponse humaine récente (RG-08). Ne lève jamais : un échec n'empêche pas la réception.
 */
export async function repondreAutomatiquement(conversationId: number, texte: string, entrantPrecedentLe: Date | null, maintenant = new Date()): Promise<'stop' | 'accuse' | 'mot_cle' | null> {
  try {
    const [c] = await getDb().select().from(schema.conversation).where(eq(schema.conversation.id, conversationId));
    if (!c || c.candidatId) return null;
    if (estStop(texte)) {
      await getDb()
        .insert(schema.consentementWhatsapp)
        .values({ numero: c.numero, retireLe: maintenant, canal: 'whatsapp', majLe: maintenant })
        .onConflictDoUpdate({ target: schema.consentementWhatsapp.numero, set: { retireLe: maintenant, majLe: maintenant } });
      await journaliser({ acteurType: 'client', action: 'whatsapp.stop', objetType: 'consentement', objetId: c.numero, details: { texte } });
      await envoyerAutomatique(c, 'C’est noté : vous ne recevrez plus de messages promotionnels de NEXCLEAN. Vous pouvez toujours nous écrire ici pour toute demande.', maintenant);
      return 'stop';
    }
    const suspension = await lireParametre('wa_suspension_heures');
    if (automateSuspendu(c, maintenant, suspension)) return null;
    const v = await variablesAutomatiques(c.dossierId, maintenant);
    if (doitAccuser(entrantPrecedentLe, maintenant)) {
      const modele = await lireParametre(v.ouvert ? 'wa_accuse_ouvert' : 'wa_accuse_ferme');
      return (await envoyerAutomatique(c, remplir(modele, v.valeurs), maintenant)) ? 'accuse' : null;
    }
    const regle = reponseRapide(texte, await lireParametre('wa_reponses_rapides'));
    if (regle) return (await envoyerAutomatique(c, remplir(regle.reponse, v.valeurs), maintenant)) ? 'mot_cle' : null;
    return null;
  } catch (e) {
    console.error('[whatsapp] automate', conversationId, e);
    return null;
  }
}

// ─── Synchronisations Meta (RG-03, RG-10) ─────────────────────

export async function lireEtat<T>(cle: string): Promise<T | null> {
  const [r] = await getDb().select().from(schema.etatWhatsapp).where(eq(schema.etatWhatsapp.cle, cle));
  return (r?.valeur as T) ?? null;
}

async function ecrireEtat(cle: string, valeur: unknown, maintenant: Date) {
  await getDb().insert(schema.etatWhatsapp).values({ cle, valeur, majLe: maintenant }).onConflictDoUpdate({ target: schema.etatWhatsapp.cle, set: { valeur, majLe: maintenant } });
}

/** RG-03 : statut et catégorie des modèles, lus dans le WhatsApp Manager. */
export async function synchroniserModeles(maintenant = new Date()): Promise<number> {
  const waba = env().WHATSAPP_WABA_ID;
  if (!waba || !env().WHATSAPP_ACCESS_TOKEN) return 0;
  const r = await graphJson<{ data?: { name: string; language: string; status: string; category: string }[] }>(`${waba}/message_templates?fields=name,language,status,category&limit=250`);
  let n = 0;
  for (const t of r.data ?? []) {
    const maj = await getDb()
      .update(schema.modeleMessage)
      .set({ metaStatut: t.status, metaCategorie: t.category?.toLowerCase() ?? null, metaSynchroLe: maintenant })
      .where(and(eq(schema.modeleMessage.metaNom, t.name), eq(schema.modeleMessage.metaLangue, t.language)))
      .returning({ id: schema.modeleMessage.id });
    n += maj.length;
  }
  return n;
}

/** RG-10 : note de qualité du numéro (GREEN / YELLOW / RED) ; passage à RED → alerte Direction. */
export async function synchroniserQualite(maintenant = new Date()): Promise<string | null> {
  if (!envoiActif()) return null;
  const precedente = await lireEtat<{ note: string; le: string }>('qualite');
  // Une lecture par heure suffit.
  if (precedente && maintenant.getTime() - new Date(precedente.le).getTime() < 55 * 60_000) return precedente.note;
  const r = await graphJson<{ quality_rating?: string }>(`${env().WHATSAPP_PHONE_NUMBER_ID}?fields=quality_rating`);
  const note = (r.quality_rating ?? 'UNKNOWN').toUpperCase();
  await ecrireEtat('qualite', { note, le: maintenant.toISOString() }, maintenant);
  if (note === 'RED' && precedente?.note !== 'RED') {
    await notifier({ destinataires: await idsDirection(), type: 'whatsapp_qualite', titre: 'WhatsApp : note de qualité basse', texte: 'La note de qualité du numéro WhatsApp est passée au rouge. Les envois promotionnels sont suspendus automatiquement. Vérifiez les signalements dans le WhatsApp Manager.', lien: '/admin/messagerie', cle: `wa_qualite:${maintenant.toISOString().slice(0, 10)}`, email: true });
    await journaliser({ acteurType: 'systeme', action: 'whatsapp.qualite_basse', details: { avant: precedente?.note ?? null, apres: note } });
  }
  return note;
}

/** Dernier message reçu avant celui-ci (pour la règle des 7 jours de silence). */
export async function entrantPrecedent(conversationId: number, waIdCourant: string): Promise<Date | null> {
  const [m] = await getDb()
    .select({ horodatage: schema.messageWhatsapp.horodatage })
    .from(schema.messageWhatsapp)
    .where(and(eq(schema.messageWhatsapp.conversationId, conversationId), eq(schema.messageWhatsapp.sens, 'entrant'), sql`${schema.messageWhatsapp.waId} <> ${waIdCourant}`))
    .orderBy(desc(schema.messageWhatsapp.horodatage))
    .limit(1);
  return m?.horodatage ?? null;
}

// ─── Envoi par un autre module : devis (COM2-02 RG-05) ────────

export type IssueEnvoiClient = { statut: 'envoye' } | { statut: 'manuel' | 'echec'; raison: string };

/**
 * Envoie au client un message préparé ailleurs (ex. « Envoi du devis »), l'appelant ayant déjà
 * vérifié les droits. Dans la fenêtre de 24 h : texte ; sinon le modèle Meta approuvé du même nom
 * interne s'il existe (paramètres tirés de `ctx`) ; sinon « manuel » (wa.me, comme avant).
 */
export async function envoyerAuClient(
  p: { numero: string; dossierId: number; texte: string; nomModeleInterne?: string; ctx?: Record<string, string | undefined> },
  a: Acteur,
  maintenant = new Date(),
): Promise<IssueEnvoiClient> {
  if (!envoiActif()) return { statut: 'manuel', raison: 'Envoi WhatsApp depuis le Back-Office non activé.' };
  const db = getDb();
  await db.insert(schema.conversation).values({ numero: p.numero, dossierId: p.dossierId }).onConflictDoNothing({ target: schema.conversation.numero });
  const [c] = await db.select().from(schema.conversation).where(eq(schema.conversation.numero, p.numero));
  const conv = { id: c!.id, dossierId: c!.dossierId ?? p.dossierId };
  try {
    if (fenetreOuverte(c!.dernierEntrantLe, maintenant)) {
      const waId = await posterMessage(p.numero, { type: 'text', text: { body: p.texte, preview_url: true } });
      await enregistrerSortant(conv, { waId, texte: p.texte, auteurId: a.id, automatique: false }, maintenant);
      return { statut: 'envoye' };
    }
    const [m] = p.nomModeleInterne
      ? await db.select().from(schema.modeleMessage).where(and(eq(schema.modeleMessage.nom, p.nomModeleInterne), eq(schema.modeleMessage.metaStatut, 'APPROVED'), sql`${schema.modeleMessage.metaNom} is not null`))
      : [];
    if (!m || m.metaCategorie === 'marketing') return { statut: 'manuel', raison: 'Le client n’a pas écrit depuis plus de 24 h et aucun modèle Meta approuvé ne correspond.' };
    const params = m.metaParametres.map((v) => ({ type: 'text', text: (p.ctx?.[v] ?? '').slice(0, 1000) || '-' }));
    const waId = await posterMessage(p.numero, { type: 'template', template: { name: m.metaNom!, language: { code: m.metaLangue }, ...(params.length ? { components: [{ type: 'body', parameters: params }] } : {}) } });
    await enregistrerSortant(conv, { waId, texte: p.texte, auteurId: a.id, automatique: false, modele: m.metaNom, categorie: (m.metaCategorie as 'utility' | null) ?? 'utility' }, maintenant);
    return { statut: 'envoye' };
  } catch (e) {
    console.error('[whatsapp] envoi au client', p.dossierId, e);
    return { statut: 'echec', raison: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Documents (COM2-02 RG-01) ────────────────────────────────

/** Documents consultables sur la page de suivi (jamais le fichier brut par WhatsApp, ADR 0003). */
export const CATEGORIES_PARTAGEABLES = { devis: 'Devis', facture: 'Facture', recu: 'Reçu de paiement', attestation: 'Attestation' } as const;

export async function documentsPartageables(dossierId: number) {
  const docs = await getDb()
    .select({ id: schema.document.id, nom: schema.document.nomOrigine, categorie: schema.document.categorie })
    .from(schema.document)
    .where(and(eq(schema.document.dossierId, dossierId), sql`${schema.document.supprimeLe} is null`, sql`${schema.document.categorie} in ('devis', 'facture', 'recu', 'attestation')`))
    .orderBy(desc(schema.document.id));
  const [d] = await getDb().select({ jeton: schema.dossier.jetonSuivi }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  const lien = d ? `${env().BETTER_AUTH_URL}/suivi/${d.jeton}` : null;
  return docs.map((x) => ({ id: x.id, libelle: `${CATEGORIES_PARTAGEABLES[x.categorie as keyof typeof CATEGORIES_PARTAGEABLES]} — ${x.nom}`, texte: `📄 ${CATEGORIES_PARTAGEABLES[x.categorie as keyof typeof CATEGORIES_PARTAGEABLES]} « ${x.nom} » : à consulter et télécharger sur votre espace de suivi sécurisé ${lien} (code demandé : les 4 derniers chiffres de votre numéro WhatsApp).` }));
}

/** COM3-02 : message de l'agent conversationnel (réponse automatique tracée comme telle). */
export async function envoyerParAgent(conv: { id: number; numero: string; dossierId: number | null }, texte: string, maintenant = new Date()): Promise<boolean> {
  return envoyerAutomatique(conv, texte, maintenant, { autoriserMontants: true });
}
