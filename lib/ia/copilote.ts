// Copilote IA (specs/COM3-01 RG-04, RG-06..11) : l'IA propose, l'humain valide.
// Minimisation (RG-04, ADR 0026 §6) : seuls le texte des demandes, le fil de la conversation et les
// champs utiles du Dossier sont envoyés ; jamais de CV, pièce d'identité, salaire ni donnée de paiement.
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, type Demandeur } from '@/lib/dossiers/acces';
import * as dossiers from '@/lib/dossiers/service';
import { STATUTS } from '@/lib/dossiers/statuts';
import { DOSSIER_TYPES, DOSSIER_TYPE_CODES } from '@/lib/domain/referentiels';
import { listesLieux, couverturePublique } from '@/lib/geo/service';
import { lireParametre } from '@/lib/parametres';
import { services } from '@/content/services-data';
import { libelleHoraires } from '@/lib/whatsapp/automate';
import { lignesIndicateurs, type ContenuRapport } from '@/lib/commercial/rapport';
import { ia, journaliserIa } from './client';
import { contientMontant, lireRelance, nombresInventes } from './controle';
import { PROMPT_BROUILLON, PROMPT_QUALIFICATION, PROMPT_RAPPORT, PROMPT_RELANCE, PROMPT_RESUME } from './prompts';

type Acteur = Demandeur & { ip?: string | null };

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const jourIso = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
const dateDuJour = (d: Date) => `${FORMAT_JOUR.format(d)} (${jourIso(d)})`;
const normaliser = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ─── Qualification et classification (RG-06, RG-07) ───────────

export const schemaQualification = z.object({
  type: z.enum(DOSSIER_TYPE_CODES),
  ville: z.string().nullable(),
  quartier: z.string().nullable(),
  effectif: z.number().int().nullable(),
  date_debut: z.string().nullable(),
  urgence: z.enum(['haute', 'normale']),
  budget: z.string().nullable(),
  besoin: z.string(),
  temperature: z.enum(['chaud', 'tiede', 'froid']),
  raison: z.string(),
});
export type Qualification = z.infer<typeof schemaQualification>;
export type ContenuQualification = Omit<Qualification, 'temperature' | 'raison'> & { demandeId: number; villeId: number | null; quartierId: number | null };

/** Champs de formulaire jamais envoyés (identité, coordonnées) : le besoin suffit à la qualification. */
const CHAMPS_EXCLUS = /^(phone|telephone|whatsapp|email|contact|company|nom|name|prenom|entreprise)$/i;

/** Texte de la Demande à qualifier (description, message WhatsApp, champs libres du formulaire). */
export function texteDemande(d: { description: string | null; donnees: unknown }): string {
  const donnees = (d.donnees ?? {}) as { whatsapp?: { texte?: string }; valeurs?: Record<string, unknown> };
  const morceaux = [d.description ?? '', donnees.whatsapp?.texte ?? ''];
  for (const [k, v] of Object.entries(donnees.valeurs ?? {})) if (typeof v === 'string' && v.trim() && !CHAMPS_EXCLUS.test(k)) morceaux.push(`${k} : ${v}`);
  return [...new Set(morceaux.map((m) => m.trim()).filter(Boolean))].join('\n').slice(0, 4000);
}

/** Rapprochement de la ville et du quartier cités avec le référentiel (ADR 0021). */
export function rapprocherLieu(q: Pick<Qualification, 'ville' | 'quartier'>, lieux: { id: number; nom: string; quartiers: { id: number; nom: string }[] }[]): { villeId: number | null; quartierId: number | null } {
  const ville = q.ville ? lieux.find((v) => normaliser(v.nom) === normaliser(q.ville!)) : undefined;
  if (q.quartier) {
    const candidats = (ville ? [ville] : lieux).flatMap((v) => v.quartiers.filter((x) => normaliser(x.nom) === normaliser(q.quartier!)).map((x) => ({ villeId: v.id, quartierId: x.id })));
    if (candidats.length === 1) return candidats[0]!;
  }
  return { villeId: ville?.id ?? null, quartierId: null };
}

/** RG-06 + RG-07 : une Demande → suggestions « qualification » et « classification » sur son Dossier. */
export async function qualifierDemande(demandeId: number, maintenant = new Date()): Promise<boolean> {
  const db = getDb();
  const [d] = await db
    .select({ id: schema.demande.id, dossierId: schema.demande.dossierId, canal: schema.demande.canal, description: schema.dossier.description, donnees: schema.demande.donnees })
    .from(schema.demande)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.demande.dossierId))
    .where(eq(schema.demande.id, demandeId));
  if (!d) return false;
  const texte = texteDemande(d);
  if (texte.length < 3) return false;
  const q = await ia().extraire(PROMPT_QUALIFICATION, `Date du jour : ${dateDuJour(maintenant)}\nCanal : ${d.canal}\n\nDemande du client :\n${texte}`, schemaQualification, { tache: 'qualification', dossierId: d.dossierId });
  if (!q) return false;
  const lieu = rapprocherLieu(q, (await listesLieux()).map((v) => ({ id: v.id, nom: v.nom, quartiers: v.quartiers })));
  const { temperature, raison, ...extrait } = q;
  const dateValide = extrait.date_debut && /^\d{4}-\d{2}-\d{2}$/.test(extrait.date_debut) ? extrait.date_debut : null;
  const contenu: ContenuQualification = { ...extrait, date_debut: dateValide, demandeId, ...lieu };
  await db.insert(schema.suggestionIa).values([
    { dossierId: d.dossierId, tache: 'qualification', contenu, versionPrompt: PROMPT_QUALIFICATION.version },
    { dossierId: d.dossierId, tache: 'classification', contenu: { temperature, raison, demandeId }, versionPrompt: PROMPT_QUALIFICATION.version },
  ]);
  return true;
}

/** Demandes WhatsApp et formulaires des dernières 48 h pas encore qualifiées (file traitée par la tâche planifiée). */
export async function qualifierEnAttente(limite = 10, maintenant = new Date()): Promise<number> {
  const db = getDb();
  const enAttente = await db
    .select({ id: schema.demande.id })
    .from(schema.demande)
    .where(
      and(
        inArray(schema.demande.canal, ['whatsapp', 'site']),
        gte(schema.demande.creeLe, new Date(maintenant.getTime() - 48 * 3600_000)),
        sql`not exists (select 1 from ${schema.suggestionIa} s where s.dossier_id = ${schema.demande.dossierId} and s.tache = 'qualification' and (s.contenu->>'demandeId')::int = ${schema.demande.id})`,
        // Une tentative par heure au plus pour une Demande dont l'IA a échoué.
        sql`not exists (select 1 from ${schema.journalIa} j where j.dossier_id = ${schema.demande.dossierId} and j.tache = 'qualification' and j.cree_le > ${new Date(maintenant.getTime() - 3600_000).toISOString()}::timestamptz)`,
      ),
    )
    .orderBy(asc(schema.demande.id))
    .limit(limite);
  let n = 0;
  for (const x of enAttente) if (await qualifierDemande(x.id, maintenant)) n++;
  return n;
}

async function dossierPourIa(dossierId: number, a: Acteur) {
  const [d] = await getDb()
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, type: schema.dossier.type, statut: schema.dossier.statut, referentId: schema.dossier.referentId, villeId: schema.dossier.villeId, villeAutre: schema.dossier.villeAutre, quartierId: schema.dossier.quartierId, quartierAutre: schema.dossier.quartierAutre, lieu: schema.dossier.lieu, secteur: schema.dossier.secteur, description: schema.dossier.description, creeLe: schema.dossier.creeLe, derniereActionLe: schema.dossier.derniereActionLe, ville: schema.ville.nom, client: schema.client.nom })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(eq(schema.dossier.id, dossierId));
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurMetier('Accès refusé à ce dossier.');
  return d;
}

/** RG-06 : le référent applique la qualification proposée (type, lieu si vide) ; le reste va en note. */
export async function appliquerQualification(suggestionId: number, a: Acteur, maintenant = new Date()): Promise<string[]> {
  const [s] = await getDb().select().from(schema.suggestionIa).where(eq(schema.suggestionIa.id, suggestionId));
  if (!s || s.tache !== 'qualification') throw new ErreurMetier('Suggestion introuvable.');
  if (s.statut !== 'proposee') throw new ErreurMetier('Suggestion déjà traitée.');
  const d = await dossierPourIa(s.dossierId, a);
  const q = s.contenu as ContenuQualification;
  const faits: string[] = [];
  if (q.type !== d.type) {
    try {
      await dossiers.changerType(d.id, q.type, a);
      faits.push(`type : ${DOSSIER_TYPES[q.type]}`);
    } catch (e) {
      if (!(e instanceof ErreurMetier)) throw e;
      faits.push(`type non modifié (${e.message})`);
    }
  }
  if (!d.villeId && q.villeId) {
    await dossiers.modifierLieu(d.id, { villeId: q.villeId, villeAutre: null, quartierId: q.quartierId, quartierAutre: q.quartierId ? null : (q.quartier ?? d.quartierAutre), lieu: d.lieu, secteur: d.secteur, description: d.description }, a);
    faits.push('lieu renseigné');
  }
  const details = [
    `Besoin : ${q.besoin}`,
    q.effectif ? `Effectif : ${q.effectif}` : null,
    q.date_debut ? `Début souhaité : ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date(`${q.date_debut}T12:00:00`))}` : null,
    q.urgence === 'haute' ? 'Urgent' : null,
    q.budget ? `Budget mentionné par le client : ${q.budget}` : null,
  ].filter(Boolean);
  await dossiers.ajouterNote(d.id, `Qualification proposée par l’IA et validée :\n${details.join('\n')}`, a);
  await getDb().update(schema.suggestionIa).set({ statut: 'appliquee', traiteLe: maintenant, traitePar: a.id }).where(eq(schema.suggestionIa.id, suggestionId));
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'ia.qualification_appliquee', objetType: 'dossier', objetId: d.id, details: { suggestionId, faits } });
  return faits;
}

export async function ignorerSuggestion(suggestionId: number, a: Acteur, maintenant = new Date()): Promise<void> {
  const [s] = await getDb().select().from(schema.suggestionIa).where(eq(schema.suggestionIa.id, suggestionId));
  if (!s) throw new ErreurMetier('Suggestion introuvable.');
  await dossierPourIa(s.dossierId, a);
  await getDb().update(schema.suggestionIa).set({ statut: 'ignoree', traiteLe: maintenant, traitePar: a.id }).where(eq(schema.suggestionIa.id, suggestionId));
}

/** Dernières suggestions d'un Dossier, par tâche (affichage de la fiche). */
export async function suggestionsDuDossier(dossierId: number) {
  const lignes = await getDb().select().from(schema.suggestionIa).where(eq(schema.suggestionIa.dossierId, dossierId)).orderBy(desc(schema.suggestionIa.creeLe), desc(schema.suggestionIa.id)).limit(20);
  const derniere = (tache: string) => lignes.find((l) => l.tache === tache) ?? null;
  return { qualification: derniere('qualification'), classification: derniere('classification'), resume: derniere('resume') };
}

// ─── Brouillon, relance, résumé (RG-08..10) ───────────────────

async function informationsGenerales() {
  const [horaires, couverture] = await Promise.all([lireParametre('heures_ouvrees'), couverturePublique().catch(() => ({ villes: [] as string[] }))]);
  return `Horaires : ${libelleHoraires(horaires)}.\nVilles couvertes : ${couverture.villes.join(', ') || 'Douala, Yaoundé'}.\nServices : ${services.map((s) => s.name).join(', ')}.`;
}

const resumeDossier = (d: Awaited<ReturnType<typeof dossierPourIa>>) =>
  `Dossier ${d.numero} — ${DOSSIER_TYPES[d.type]} — statut : ${STATUTS[d.statut]} — ville : ${d.ville ?? d.villeAutre ?? 'non précisée'}${d.lieu ? ` (${d.lieu})` : ''}\nDemande : ${(d.description ?? '').slice(0, 1500)}`;

/** RG-08 : brouillon de réponse à partir du fil de la conversation ; rien n'est envoyé. */
export async function brouillonReponse(conversationId: number, a: Acteur): Promise<string | null> {
  const { lireConversation } = await import('@/lib/whatsapp/lecture');
  const conv = await lireConversation(conversationId, a);
  if (!conv) throw new ErreurMetier('Accès refusé.');
  const d = conv.dossierId ? await dossierPourIa(conv.dossierId, a) : null;
  const fil = conv.messages
    .slice(-20)
    .map((m) => `${m.sens === 'entrant' ? 'Client' : 'NEXCLEAN'} : ${m.texte || `[${m.type}]`}`)
    .join('\n');
  const texte = await ia().rediger(PROMPT_BROUILLON, `${await informationsGenerales()}\n\n${d ? resumeDossier(d) : 'Aucun dossier ouvert.'}\n\nConversation (du plus ancien au plus récent) :\n${fil}`, { tache: 'brouillon', dossierId: conv.dossierId, collaborateurId: a.id }, { maxTokens: 800 });
  if (texte && contientMontant(texte)) {
    await journaliserIa({ ctx: { tache: 'brouillon', dossierId: conv.dossierId, collaborateurId: a.id }, modele: '-', version: PROMPT_BROUILLON.version, debut: Date.now(), issue: 'rejete', erreur: 'montant dans le brouillon' });
    return null;
  }
  return texte;
}

/** Événements utiles au contexte (sans notes internes ni documents, qui peuvent contenir salaires ou paiements). */
async function historiqueCourt(dossierId: number) {
  const evs = await getDb()
    .select({ horodatage: schema.evenementDossier.horodatage, type: schema.evenementDossier.type, commentaire: schema.evenementDossier.commentaire, versStatut: schema.evenementDossier.versStatut })
    .from(schema.evenementDossier)
    .where(and(eq(schema.evenementDossier.dossierId, dossierId), inArray(schema.evenementDossier.type, ['creation', 'transition', 'whatsapp', 'rendez_vous', 'attribution'])))
    .orderBy(desc(schema.evenementDossier.horodatage))
    .limit(15);
  return evs
    .reverse()
    .map((e) => `${jourIso(e.horodatage)} — ${e.versStatut ? `statut ${STATUTS[e.versStatut]}` : e.type}${e.commentaire ? ` : ${e.commentaire.slice(0, 300)}` : ''}`)
    .join('\n');
}

/** RG-09 : relance suggérée (message + moment recommandé) pour un Dossier « À relancer ». */
export async function suggererRelance(dossierId: number, a: Acteur, maintenant = new Date()): Promise<{ moment: string | null; message: string } | null> {
  const d = await dossierPourIa(dossierId, a);
  const texte = await ia().rediger(PROMPT_RELANCE, `Date du jour : ${dateDuJour(maintenant)}\nDernière action sur le dossier : ${jourIso(d.derniereActionLe)}\n\n${resumeDossier(d)}\n\nHistorique :\n${await historiqueCourt(d.id)}`, { tache: 'relance', dossierId, collaborateurId: a.id }, { maxTokens: 800 });
  if (!texte || contientMontant(texte)) return null;
  return lireRelance(texte);
}

/** RG-10 : résumé en 5 lignes, enregistré comme suggestion « resume » (affiché en tête du Dossier). */
export async function resumerDossier(dossierId: number, a: Acteur): Promise<string | null> {
  const d = await dossierPourIa(dossierId, a);
  const rdv = await getDb().select({ type: schema.rendezVous.type, debut: schema.rendezVous.debut, statut: schema.rendezVous.statut }).from(schema.rendezVous).where(eq(schema.rendezVous.dossierId, dossierId)).orderBy(desc(schema.rendezVous.debut)).limit(3);
  const texte = await ia().rediger(
    PROMPT_RESUME,
    `${resumeDossier(d)}\nClient : ${d.client}\nCréé le ${jourIso(d.creeLe)}\nRendez-vous : ${rdv.map((r) => `${r.type} le ${jourIso(r.debut)} (${r.statut})`).join(' ; ') || 'aucun'}\n\nHistorique :\n${await historiqueCourt(d.id)}`,
    { tache: 'resume', dossierId, collaborateurId: a.id },
    { maxTokens: 600 },
  );
  if (!texte) return null;
  await getDb().insert(schema.suggestionIa).values({ dossierId, tache: 'resume', contenu: { texte }, versionPrompt: PROMPT_RESUME.version });
  return texte;
}

// ─── Rapport hebdomadaire (RG-11) ─────────────────────────────

/** Commentaire du rapport, rédigé à partir des seuls agrégats ; rejeté s'il cite un nombre absent des agrégats. */
export async function commentaireRapport(c: ContenuRapport): Promise<string | null> {
  const agregats = {
    indicateurs: Object.fromEntries(lignesIndicateurs(c)),
    meilleures_sources: c.topSources,
    demandes_sans_reponse_24h: c.enSouffrance.length,
    dossiers_sans_action: c.sansAction.length,
    jours_sans_action: c.joursSansAction,
    rendez_vous_a_cloturer: c.aCloturer.length,
    rendez_vous_semaine_a_venir: c.aVenir.length,
  };
  const ctx = { tache: 'rapport', dossierId: null, collaborateurId: null };
  const texte = await ia().rediger(PROMPT_RAPPORT, `Semaine du ${c.semaine} au ${c.fin}${c.portee === 'referent' ? ' (dossiers d’un référent)' : ''}.\nDonnées (JSON) :\n${JSON.stringify(agregats, null, 2)}`, ctx, { maxTokens: 800 });
  if (!texte) return null;
  const inventes = nombresInventes(texte, { ...agregats, semaine: c.semaine, fin: c.fin });
  if (inventes.length) {
    await journaliserIa({ ctx, modele: '-', version: PROMPT_RAPPORT.version, debut: Date.now(), issue: 'rejete', erreur: `nombres absents des agrégats : ${inventes.join(', ')}` });
    return null;
  }
  return texte;
}
