// Agent conversationnel WhatsApp (specs/COM3-02, ADR 0026) : répond seul dans un périmètre fermé.
// Garde-fous dans le code : outils en liste blanche, montants recalculés par le serveur, contrôle de
// chaque message avant envoi, déclencheurs de passage à l'humain, interrupteurs, plafond quotidien.
import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { journaliser } from '@/lib/audit';
import { lireParametre } from '@/lib/parametres';
import { CONTACT } from '@/lib/constants';
import { services } from '@/content/services-data';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES } from '@/lib/domain/referentiels';
import { STATUTS } from '@/lib/dossiers/statuts';
import { listesLieux } from '@/lib/geo/service';
import { estimer, MENTION_ESTIMATION, texteEstimation } from '@/lib/dossiers/formulaire-personnel';
import { idsDirection, notifier } from '@/lib/notifications';
import { automateSuspendu, estStop, libelleOuverture, ouverture } from '@/lib/whatsapp/automate';
import { envoiActif, envoyerParAgent } from '@/lib/whatsapp/envoi';
import { libelleDebut } from '@/lib/rendezvous/domaine';
import { DELAI_IA_MS, iaActive, journaliserIa } from './client';
import { PROMPT_AGENT } from './prompts';
import { texteBase, versionBase } from './connaissance';
import { rapprocherLieu } from './copilote';
import { avecPresentation, controlerMessage, creneauxRappel, declencheurPassage, montantsCites, MOTIFS_PASSAGE, PLAFOND_MESSAGES_JOUR, type Autorisations, type MotifPassage } from './agent-regles';

type Bloc = Anthropic.Beta.BetaContentBlock;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type Outil = Anthropic.Beta.BetaTool;

/** Un tour du modèle ; remplaçable dans les tests (aucun appel réel). */
export type AppelModele = (p: { systeme: Anthropic.Beta.BetaTextBlockParam[]; messages: MessageParam[]; outils: Outil[] }) => Promise<{ content: Bloc[]; stop_reason: string | null; model: string; usage?: { input_tokens?: number; output_tokens?: number } }>;

let client: Anthropic | null = null;
const appelClaude: AppelModele = async ({ systeme, messages, outils }) => {
  client ??= new Anthropic({ apiKey: env().IA_API_KEY, timeout: DELAI_IA_MS, maxRetries: 0 });
  const r = await client.beta.messages.create({
    model: env().IA_MODELE_AGENT,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systeme,
    messages,
    tools: outils,
  });
  return { content: r.content, stop_reason: r.stop_reason, model: r.model, usage: r.usage };
};
let appelModele: AppelModele = appelClaude;
export function definirModeleAgent(f: AppelModele | null) {
  appelModele = f ?? appelClaude;
}

// ─── Outils (RG-01, liste blanche) ────────────────────────────

const chaine = { type: ['string', 'null'] } as const;
const OUTILS: Outil[] = [
  { name: 'lire_dossier', description: 'Lit le dossier du client : type, statut, lieu, besoin, rendez-vous à venir.', strict: true, input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false } },
  {
    name: 'completer_qualification',
    description: 'Enregistre les éléments de qualification appris dans la conversation. Appelle-le dès que tu apprends quelque chose de nouveau. Renvoie si la qualification est complète.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { type: { type: ['string', 'null'], enum: [...DOSSIER_TYPE_CODES, null] }, ville: chaine, quartier: chaine, effectif: { type: ['integer', 'null'] }, date_debut: { type: ['string', 'null'], description: 'AAAA-MM-JJ' }, besoin: chaine },
      required: ['type', 'ville', 'quartier', 'effectif', 'date_debut', 'besoin'],
      additionalProperties: false,
    },
  },
  {
    name: 'donner_estimation',
    description: 'Calcule une estimation indicative à partir de la grille de NEXCLEAN. Seul moyen autorisé de citer un montant.',
    strict: true,
    input_schema: { type: 'object', properties: { service: { type: 'string', enum: [...DOSSIER_TYPE_CODES] }, personnes: { type: ['integer', 'null'] }, poste: chaine }, required: ['service', 'personnes', 'poste'], additionalProperties: false },
  },
  {
    name: 'proposer_creneau_rappel',
    description: 'Sans créneau : renvoie les prochains créneaux libres pour un rappel par un conseiller. Avec un créneau choisi par le client (valeur exacte renvoyée), le réserve (à confirmer par le conseiller).',
    strict: true,
    input_schema: { type: 'object', properties: { creneau: chaine }, required: ['creneau'], additionalProperties: false },
  },
  { name: 'envoyer_lien_suivi', description: 'Renvoie le lien de suivi du dossier, à transmettre au client.', strict: true, input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false } },
  {
    name: 'passer_la_main',
    description: 'Passe la conversation à un conseiller humain, avec un résumé pour lui.',
    strict: true,
    input_schema: { type: 'object', properties: { motif: { type: 'string', enum: Object.keys(MOTIFS_PASSAGE) }, resume: { type: 'string' } }, required: ['motif', 'resume'], additionalProperties: false },
  },
];

interface Etat {
  conv: { id: number; numero: string; dossierId: number | null };
  dossier: { id: number; numero: string; type: keyof typeof DOSSIER_TYPES; statut: keyof typeof STATUTS; referentId: string | null; description: string | null; ville: string | null; jeton: string } | null;
  autorisations: Autorisations;
  passage: { motif: MotifPassage; resume: string } | null;
  qualificationComplete: boolean;
  traces: { outil: string; entree: unknown; sortie: unknown }[];
  maintenant: Date;
}

const lienSuivi = (jeton: string) => `${env().BETTER_AUTH_URL}/suivi/${jeton}`;

async function executerOutil(nom: string, entree: Record<string, unknown>, e: Etat): Promise<unknown> {
  const d = e.dossier;
  switch (nom) {
    case 'lire_dossier': {
      if (!d) return { dossier: null };
      const rdv = await getDb().select({ type: schema.rendezVous.type, debut: schema.rendezVous.debut }).from(schema.rendezVous).where(and(eq(schema.rendezVous.dossierId, d.id), eq(schema.rendezVous.statut, 'prevu'), gte(schema.rendezVous.debut, e.maintenant)));
      return { numero: d.numero, type: DOSSIER_TYPES[d.type], statut: STATUTS[d.statut], ville: d.ville, besoin: (d.description ?? '').slice(0, 1000), rendez_vous: rdv.map((r) => `${r.type} le ${libelleDebut(r.debut)}`) };
    }
    case 'completer_qualification': {
      if (!d) return { enregistre: false };
      const q = z.object({ type: z.enum(DOSSIER_TYPE_CODES).nullable(), ville: z.string().nullable(), quartier: z.string().nullable(), effectif: z.number().int().nullable(), date_debut: z.string().nullable(), besoin: z.string().nullable() }).parse(entree);
      const lieu = rapprocherLieu(q, (await listesLieux()).map((v) => ({ id: v.id, nom: v.nom, quartiers: v.quartiers })));
      const type = q.type ?? d.type;
      const complete = !!(q.besoin && (lieu.villeId || q.ville) && (type !== 'REC' || q.effectif));
      await getDb().insert(schema.suggestionIa).values({ dossierId: d.id, tache: 'qualification', contenu: { ...q, type, urgence: 'normale', budget: null, besoin: q.besoin ?? '', date_debut: q.date_debut && /^\d{4}-\d{2}-\d{2}$/.test(q.date_debut) ? q.date_debut : null, demandeId: 0, source: 'agent', ...lieu }, versionPrompt: PROMPT_AGENT.version });
      if (complete) e.qualificationComplete = true;
      return { enregistre: true, complete };
    }
    case 'donner_estimation': {
      const p = z.object({ service: z.enum(DOSSIER_TYPE_CODES), personnes: z.number().int().min(1).max(100).nullable(), poste: z.string().nullable() }).parse(entree);
      if (p.service === 'REC' || p.service === 'MAD') {
        const [defaut, parCategorie] = await Promise.all([lireParametre('commission_par_personne'), lireParametre('commissions_par_categorie')]);
        const cle = p.poste ? Object.keys(parCategorie).find((k) => k.toLowerCase() === p.poste!.toLowerCase()) : undefined;
        const est = estimer(cle ? parCategorie[cle]! : defaut, p.personnes ?? 1);
        e.autorisations.montants.push(est.montant, est.commission);
        return { estimation: texteEstimation(est), mention: MENTION_ESTIMATION, montant_fcfa: est.montant };
      }
      const prix = services.filter((s) => (p.service === 'EV' ? s.slug.includes('espaces-verts') : p.service === 'NET' ? !s.slug.includes('espaces-verts') : false)).map((s) => `${s.name} : ${s.priceRange}`);
      prix.forEach((x) => e.autorisations.montants.push(...montantsCites(x)));
      return prix.length ? { tarifs_indicatifs: prix, mention: 'Prix indicatifs : le devis final dépend de la surface, de l’état et de la fréquence.' } : { estimation: null, mention: 'Pas d’estimation automatique pour ce service : un conseiller établira un devis.' };
    }
    case 'proposer_creneau_rappel': {
      if (!d) return { creneaux: [] };
      const horaires = await lireParametre('heures_ouvrees');
      const occupes = d.referentId
        ? (await getDb().select({ debut: schema.rendezVous.debut }).from(schema.rendezVous).innerJoin(schema.dossier, eq(schema.dossier.id, schema.rendezVous.dossierId)).where(and(eq(schema.dossier.referentId, d.referentId), eq(schema.rendezVous.statut, 'prevu'), gte(schema.rendezVous.debut, e.maintenant)))).map((r) => r.debut)
        : [];
      const creneaux = creneauxRappel(e.maintenant, horaires, occupes);
      const choisi = typeof entree.creneau === 'string' ? creneaux.find((c) => c.toISOString() === entree.creneau) : undefined;
      if (!choisi) return { creneaux: creneaux.map((c) => ({ valeur: c.toISOString(), libelle: libelleDebut(c) })) };
      await getDb().insert(schema.rendezVous).values({ dossierId: d.id, type: 'appel', debut: choisi, planifieLe: e.maintenant, dureeMinutes: 30, lieu: 'Rappel demandé sur WhatsApp — à confirmer par le conseiller' });
      await getDb().insert(schema.evenementDossier).values({ dossierId: d.id, auteurId: null, type: 'rendez_vous', commentaire: `Rappel demandé via l’assistant WhatsApp : ${libelleDebut(choisi)} (à confirmer)` });
      await notifier({ destinataires: d.referentId ? [d.referentId] : await idsDirection(), type: 'rendez_vous', dossierId: d.id, titre: `Rappel à confirmer : ${d.numero}`, texte: `Le client a choisi un rappel le ${libelleDebut(choisi)} via l’assistant WhatsApp.`, lien: `/admin/dossiers/${d.id}`, email: true });
      return { reserve: true, creneau: libelleDebut(choisi), mention: 'Le conseiller confirmera ce rappel.' };
    }
    case 'envoyer_lien_suivi': {
      if (!d) return { lien: null };
      const lien = lienSuivi(d.jeton);
      e.autorisations.liens.push(lien);
      return { lien, mention: 'Le client devra saisir les 4 derniers chiffres de son numéro WhatsApp.' };
    }
    case 'passer_la_main': {
      const p = z.object({ motif: z.enum(Object.keys(MOTIFS_PASSAGE) as [MotifPassage, ...MotifPassage[]]), resume: z.string() }).parse(entree);
      e.passage = { motif: p.motif, resume: p.resume.slice(0, 1500) };
      return { ok: true };
    }
    default:
      return { erreur: 'outil inconnu' };
  }
}

// ─── Décision et passage à l'humain ───────────────────────────

async function chargerConversation(conversationId: number) {
  const [c] = await getDb()
    .select({ id: schema.conversation.id, numero: schema.conversation.numero, dossierId: schema.conversation.dossierId, candidatId: schema.conversation.candidatId, automate: schema.conversation.automate, agent: schema.conversation.agent, dernierSortantLe: schema.conversation.dernierSortantLe })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, conversationId));
  if (!c) return null;
  const [d] = c.dossierId
    ? await getDb()
        .select({ id: schema.dossier.id, numero: schema.dossier.numero, type: schema.dossier.type, statut: schema.dossier.statut, referentId: schema.dossier.referentId, description: schema.dossier.description, ville: schema.ville.nom, jeton: schema.dossier.jetonSuivi, agentCoupe: schema.dossier.agentCoupe })
        .from(schema.dossier)
        .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
        .where(eq(schema.dossier.id, c.dossierId))
    : [];
  return { c, d: d ?? null };
}

async function journal(e: { conversationId: number; dossierId: number | null; type: string; motif?: string | null; texte?: string | null; outils?: unknown; modele?: string | null }) {
  await getDb().insert(schema.evenementAgent).values({ ...e, motif: e.motif ?? null, texte: e.texte ?? null, outils: e.outils ?? null, modele: e.modele ?? null, versionPrompt: `${PROMPT_AGENT.version}/${await versionBase()}` });
}

/** RG-06 : prévient le client, notifie le référent avec le résumé, la conversation passe aux humains. */
async function passerLaMain(etat: Etat, motif: MotifPassage, resume: string, fantome: boolean) {
  const horaires = await lireParametre('heures_ouvrees');
  const o = ouverture(etat.maintenant, horaires);
  const message = `Merci ! Un conseiller de NEXCLEAN prend le relais et vous répond ${o.ouvert ? 'dans les plus brefs délais' : `dès ${libelleOuverture(o.prochaine, etat.maintenant)}`}.`;
  await journal({ conversationId: etat.conv.id, dossierId: etat.dossier?.id ?? null, type: fantome ? 'brouillon' : 'passage', motif, texte: fantome ? `[passage : ${MOTIFS_PASSAGE[motif]}] ${message}` : message, outils: etat.traces });
  if (fantome) return;
  await envoyerParAgent(etat.conv, message, etat.maintenant);
  await getDb().update(schema.conversation).set({ agent: 'passe' }).where(eq(schema.conversation.id, etat.conv.id));
  await notifier({
    destinataires: etat.dossier?.referentId ? [etat.dossier.referentId] : await idsDirection(),
    type: 'whatsapp_passage',
    dossierId: etat.dossier?.id ?? null,
    titre: `WhatsApp : l’assistant vous passe la main (${MOTIFS_PASSAGE[motif]})`,
    texte: `${etat.dossier ? `${etat.dossier.numero} — ` : ''}${resume}`,
    lien: `/admin/messagerie/${etat.conv.id}`,
    cle: `agent_passage:${etat.conv.id}:${etat.maintenant.toISOString()}`,
    email: true,
  });
}

/**
 * Point d'entrée, appelé à la réception d'un message client. Renvoie vrai si l'agent a pris la
 * conversation en charge (les réponses automatiques de COM2-02 ne partent alors pas).
 * Ne lève jamais : en cas de problème, COM2-02 s'applique.
 */
export async function agentRepond(conversationId: number, texteClient: string, maintenant = new Date()): Promise<boolean> {
  try {
    const mode = await lireParametre('mode_agent');
    if (mode === 'desactive' || !iaActive() || estStop(texteClient)) return false;
    const charge = await chargerConversation(conversationId);
    if (!charge || charge.c.candidatId || charge.c.agent !== 'actif' || charge.d?.agentCoupe) return false;
    const fantome = mode === 'fantome';
    if (!fantome) {
      if (!envoiActif()) return false;
      if (automateSuspendu(charge.c, maintenant, await lireParametre('wa_suspension_heures'))) return false;
      if (mode === 'hors_heures' && ouverture(maintenant, await lireParametre('heures_ouvrees')).ouvert) return false;
    }
    const etat: Etat = {
      conv: { id: charge.c.id, numero: charge.c.numero, dossierId: charge.c.dossierId },
      dossier: charge.d,
      autorisations: { montants: [], liens: [env().BETTER_AUTH_URL, 'https://nexclean.xyz'], telephones: [CONTACT.phone] },
      passage: null,
      qualificationComplete: false,
      traces: [],
      maintenant,
    };

    // RG-05 : plafond quotidien, puis déclencheurs détectés sans appel à l'IA.
    const [{ n }] = (await getDb().select({ n: sql<number>`count(*)::int` }).from(schema.evenementAgent).where(and(eq(schema.evenementAgent.conversationId, conversationId), eq(schema.evenementAgent.type, 'reponse'), gte(schema.evenementAgent.creeLe, new Date(maintenant.getTime() - 24 * 3600_000))))) as [{ n: number }];
    if (n >= PLAFOND_MESSAGES_JOUR) {
      await passerLaMain(etat, 'plafond', `Plafond de ${PLAFOND_MESSAGES_JOUR} messages atteint. Dernier message : « ${texteClient.slice(0, 300)} »`, fantome);
      return !fantome;
    }
    const declencheur = declencheurPassage(texteClient);
    if (declencheur) {
      await passerLaMain(etat, declencheur, `Message du client : « ${texteClient.slice(0, 500)} »`, fantome);
      return !fantome;
    }

    // Conversation (20 derniers messages) et contexte.
    const historique = await getDb().select({ sens: schema.messageWhatsapp.sens, texte: schema.messageWhatsapp.texte, type: schema.messageWhatsapp.type, automatique: schema.messageWhatsapp.automatique }).from(schema.messageWhatsapp).where(eq(schema.messageWhatsapp.conversationId, conversationId)).orderBy(desc(schema.messageWhatsapp.horodatage), desc(schema.messageWhatsapp.id)).limit(20);
    const messages: MessageParam[] = historique.reverse().map((m) => ({ role: m.sens === 'entrant' ? 'user' : 'assistant', content: m.texte || `[${m.type}]` }));
    while (messages[0]?.role === 'assistant') messages.shift();
    if (!messages.length || messages.at(-1)!.role !== 'user') return false;
    const dejaPresente = (await getDb().select({ id: schema.evenementAgent.id }).from(schema.evenementAgent).where(and(eq(schema.evenementAgent.conversationId, conversationId), eq(schema.evenementAgent.type, fantome ? 'brouillon' : 'reponse'))).limit(1)).length > 0;
    const o = ouverture(maintenant, await lireParametre('heures_ouvrees'));
    const systeme: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: 'text', text: `${PROMPT_AGENT.systeme}\n\n# Base de connaissances\n\n${await texteBase()}`, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Date du jour : ${maintenant.toISOString().slice(0, 10)}. NEXCLEAN est actuellement ${o.ouvert ? 'ouvert' : 'fermé'}.${etat.dossier ? ` Dossier du client : ${etat.dossier.numero} (${DOSSIER_TYPES[etat.dossier.type]}).` : ''}` },
    ];

    // Boucle d'outils (6 tours au plus).
    let texte = '';
    let modele = env().IA_MODELE_AGENT;
    const debut = Date.now();
    for (let tour = 0; tour < 6; tour++) {
      const r = await appelModele({ systeme, messages, outils: OUTILS });
      modele = r.model;
      await journaliserIa({ ctx: { tache: 'agent', dossierId: etat.dossier?.id ?? null }, modele, version: PROMPT_AGENT.version, debut, issue: r.stop_reason === 'refusal' ? 'refus' : 'ok', usage: r.usage });
      if (r.stop_reason === 'refusal') {
        etat.passage = { motif: 'hors_perimetre', resume: `Message du client : « ${texteClient.slice(0, 500)} »` };
        break;
      }
      const appels = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      texte = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      if (!appels.length || r.stop_reason !== 'tool_use') break;
      messages.push({ role: 'assistant', content: r.content as Anthropic.Beta.BetaContentBlockParam[] });
      const resultats: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const a of appels) {
        let sortie: unknown;
        try {
          sortie = await executerOutil(a.name, (a.input ?? {}) as Record<string, unknown>, etat);
        } catch (err) {
          sortie = { erreur: err instanceof Error ? err.message : 'erreur' };
        }
        etat.traces.push({ outil: a.name, entree: a.input, sortie });
        resultats.push({ type: 'tool_result', tool_use_id: a.id, content: JSON.stringify(sortie) });
      }
      messages.push({ role: 'user', content: resultats });
      if (etat.passage) break;
    }

    if (etat.passage) {
      await passerLaMain(etat, etat.passage.motif, etat.passage.resume, fantome);
      return !fantome;
    }
    if (!texte) return false; // rien à dire : COM2-02 prend le relais

    // RG-02 : contrôle avant envoi ; échec → bloqué et main passée.
    const controle = controlerMessage(texte, etat.autorisations);
    if (!controle.ok) {
      await journal({ conversationId, dossierId: etat.dossier?.id ?? null, type: 'bloque', motif: controle.raison, texte, outils: etat.traces, modele });
      await journaliser({ acteurType: 'systeme', action: 'agent.message_bloque', objetType: 'conversation', objetId: conversationId, details: { raison: controle.raison } });
      await passerLaMain(etat, 'controle', `Réponse de l’assistant bloquée (${controle.raison}). Dernier message du client : « ${texteClient.slice(0, 300)} »`, fantome);
      return !fantome;
    }
    const final = avecPresentation(texte, !dejaPresente);
    await journal({ conversationId, dossierId: etat.dossier?.id ?? null, type: fantome ? 'brouillon' : 'reponse', texte: final, outils: etat.traces, modele });
    if (fantome) return false;
    if (!(await envoyerParAgent(etat.conv, final, maintenant))) return false;
    if (etat.qualificationComplete) {
      await journal({ conversationId, dossierId: etat.dossier?.id ?? null, type: 'qualification_complete', outils: etat.traces, modele });
      await passerLaMain(etat, 'qualification_complete', `Qualification complète par l’assistant. Dernier message du client : « ${texteClient.slice(0, 300)} »`, false);
    }
    return true;
  } catch (e) {
    console.error('[agent]', conversationId, e);
    return false;
  }
}

// ─── Interrupteurs (RG-07, RG-08), journalisés ────────────────

type Auteur = { id: string; ip?: string | null };

export async function changerModeAgent(mode: 'desactive' | 'fantome' | 'hors_heures' | 'permanent', a: Auteur) {
  const { definirParametre } = await import('@/lib/parametres');
  await definirParametre('mode_agent', mode, a);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'agent.mode', details: { mode } });
}

export async function changerAgentConversation(conversationId: number, etat: 'actif' | 'coupe', a: Auteur) {
  await getDb().update(schema.conversation).set({ agent: etat }).where(eq(schema.conversation.id, conversationId));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: etat === 'coupe' ? 'agent.coupe_conversation' : 'agent.rendu_conversation', objetType: 'conversation', objetId: conversationId });
}

export async function changerAgentDossier(dossierId: number, coupe: boolean, a: Auteur) {
  await getDb().update(schema.dossier).set({ agentCoupe: coupe }).where(eq(schema.dossier.id, dossierId));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: coupe ? 'agent.coupe_dossier' : 'agent.rendu_dossier', objetType: 'dossier', objetId: dossierId });
}
