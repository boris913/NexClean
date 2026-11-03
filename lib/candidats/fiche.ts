// Fiche candidat du Back-Office (MVP2-02 lot B) : lecture journalisée, téléchargement des documents,
// message WhatsApp, réinitialisation assistée du mot de passe et changement de numéro (MVP2-01
// RG-07, RG-08 ; ADR 0016, 0024), réaffectation par la Direction (ADR 0018, 0019).
// Le contrôle d'accès des pages (403 journalisé) est fait par `exigerAccesVivier` ; chaque fonction
// revérifie les droits côté serveur.
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { peut } from '@/lib/authz/permissions';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { empreinteJeton, genererJeton } from '@/lib/collaborateurs/jetons';
import { evaluerCandidats } from '@/lib/dossiers/attribution';
import { getStockage } from '@/lib/fichiers/stockage';
import { declencherEnvoi, notifier } from '@/lib/notifications';
import { formaterTelephone, normaliserTelephone } from '@/lib/telephone';
import { estModeleCandidat, rendreMessage, variablesDe, type ContexteMessage } from '@/lib/modeles/variables';
import { completude, pseudonyme } from './domaine';
import { peutAccederVivier, type DemandeurVivier } from './acces';
import { lienFicheCandidat, type ActeurVivier } from './attribution';
import { DUREE_REINITIALISATION_MS, fermerToutesLesSessions } from './service';

type Db = ReturnType<typeof getDb>;

// ─── Règles pures ─────────────────────────────────────────────

/**
 * Informations du profil que le référent compare avec les réponses du candidat (MVP2-01 RG-07) :
 * il en faut au moins deux.
 */
export const ELEMENTS_VERIFICATION = {
  experience: 'Date ou lieu d’une expérience',
  quartier: 'Quartier',
  metier: 'Métier recherché',
} as const;
export type ElementVerification = keyof typeof ELEMENTS_VERIFICATION;
export const MIN_ELEMENTS_VERIFICATION = 2;

/** Éléments réellement vérifiables pour ce profil (on ne peut pas confirmer une information absente). */
export function elementsDisponibles(p: { experiences: number; quartier: boolean; metiers: number }): ElementVerification[] {
  return (['experience', 'quartier', 'metier'] as const).filter((e) => (e === 'experience' ? p.experiences > 0 : e === 'quartier' ? p.quartier : p.metiers > 0));
}

/** Contrôle de la vérification d'identité : au moins 2 éléments distincts, présents dans le profil. */
export function controlerVerification(coches: readonly string[], disponibles: readonly ElementVerification[]): ElementVerification[] {
  const retenus = [...new Set(coches)].filter((e): e is ElementVerification => e in ELEMENTS_VERIFICATION);
  if (retenus.some((e) => !disponibles.includes(e))) throw new ErreurMetier('Une information cochée est absente du profil.');
  if (retenus.length < MIN_ELEMENTS_VERIFICATION) throw new ErreurMetier(`Vérifiez au moins ${MIN_ELEMENTS_VERIFICATION} informations du profil avant de continuer.`);
  return retenus;
}

/** Le référent du candidat ou la Direction (réinitialisation assistée, changement de numéro). */
export function estReferentOuDirection(a: DemandeurVivier, referentId: string | null): boolean {
  return a.roles.includes('direction') || (a.roles.includes('referent') && !!referentId && referentId === a.id);
}

/** Lien de réinitialisation du mot de passe : page candidat existante (MVP2-01). */
export const lienReinitialisation = (jeton: string) => `${env().BETTER_AUTH_URL}/candidat/reinitialiser/${jeton}`;

/** Le texte noté au journal ne contient jamais un lien de réinitialisation utilisable. */
export const masquerLienReinitialisation = (texte: string) => texte.replace(/(\/candidat\/reinitialiser\/)[A-Za-z0-9_-]+/g, '$1[lien masqué]');

// ─── Modèles WhatsApp candidat ────────────────────────────────

export const MODELE_REINITIALISATION = 'Lien de réinitialisation';

/** Modèles candidat initiaux (scripts/initialiser.ts) ; proposés aussi s'ils n'ont pas été créés. */
export const MODELES_CANDIDAT_PAR_DEFAUT: { nom: string; texte: string }[] = [
  {
    nom: 'Bienvenue candidat',
    texte:
      'Bonjour {{candidat.prenom}}, je suis {{referent.prenom}} de NEXCLEAN. Merci pour votre inscription ! Je suis votre interlocuteur pour vos recherches d’emploi. Votre espace candidat : {{candidat.lien_espace}}\n\nL’inscription et la mise en relation sont 100 % gratuites.\n\n{{referent.prenom}}, NEXCLEAN',
  },
  {
    nom: 'Compléter votre profil',
    texte:
      'Bonjour {{candidat.prenom}}, pour que nous puissions vous proposer des offres, merci de compléter votre profil (expériences, CV, disponibilité) ici : {{candidat.lien_profil}}\n\nJe reste disponible au {{referent.telephone}}.\n\n{{referent.prenom}}, NEXCLEAN',
  },
  {
    nom: MODELE_REINITIALISATION,
    texte:
      'Bonjour {{candidat.prenom}}, voici votre lien pour choisir un nouveau mot de passe : {{candidat.lien_reinitialisation}}\n\nIl est valable 30 minutes et ne fonctionne qu’une seule fois. Ne le transmettez à personne.\n\n{{referent.prenom}}, NEXCLEAN',
  },
];

/** Insère les modèles candidat absents (idempotent ; un modèle modifié ou désactivé est conservé). */
export async function initialiserModelesCandidat(): Promise<number> {
  const r = await getDb()
    .insert(schema.modeleMessage)
    .values(MODELES_CANDIDAT_PAR_DEFAUT.map((m) => ({ nom: m.nom, texte: m.texte, types: [] })))
    .onConflictDoNothing({ target: schema.modeleMessage.nom })
    .returning({ id: schema.modeleMessage.id });
  return r.length;
}

export const utiliseLienReinitialisation = (texte: string) => variablesDe(texte).includes('candidat.lien_reinitialisation');

/** Modèles candidat actifs (+ modèles par défaut jamais créés en base). */
export async function listerModelesCandidat(): Promise<{ nom: string; texte: string }[]> {
  const tous = await getDb().select().from(schema.modeleMessage).orderBy(asc(schema.modeleMessage.nom));
  const enBase = tous.filter((m) => m.actif && estModeleCandidat(m.texte)).map((m) => ({ nom: m.nom, texte: m.texte }));
  const manquants = MODELES_CANDIDAT_PAR_DEFAUT.filter((d) => !tous.some((m) => m.nom === d.nom));
  return [...enBase, ...manquants].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Valeurs des variables pour un candidat (sans donnée sensible). */
export async function contexteCandidat(c: { prenom: string; nom: string; referentId: string | null }, utilisateurCourant: { id: string; nom: string }, lienReinit?: string): Promise<ContexteMessage> {
  const [ref] = await getDb()
    .select({ nom: schema.user.name, telephone: schema.collaborateurProfil.telephone })
    .from(schema.user)
    .leftJoin(schema.collaborateurProfil, eq(schema.collaborateurProfil.userId, schema.user.id))
    .where(eq(schema.user.id, c.referentId ?? utilisateurCourant.id));
  const nomRef = ref?.nom ?? utilisateurCourant.nom;
  const base = env().BETTER_AUTH_URL;
  return {
    'candidat.prenom': c.prenom,
    'candidat.nom': c.nom,
    'candidat.lien_espace': `${base}/candidat/espace`,
    'candidat.lien_profil': `${base}/candidat/espace/profil`,
    'candidat.lien_reinitialisation': lienReinit ?? '',
    'referent.prenom': nomRef.split(/\s+/)[0] ?? nomRef,
    'referent.telephone': ref?.telephone ? formaterTelephone(ref.telephone) : '',
  };
}

// ─── Lecture de la fiche ──────────────────────────────────────

async function exigerVivier(a: DemandeurVivier, permission: 'candidat.voir' | 'candidat.traiter' = 'candidat.voir') {
  if (!(await peutAccederVivier(a, permission))) throw new ErreurMetier('Accès réservé aux référents recrutement et à la Direction.');
}

/** Actions exclues de l'historique de la fiche : consultations et connexions (bruit). */
const ACTIONS_HORS_HISTORIQUE = ['candidat.fiche_consultee', 'candidat.cv_telecharge', 'candidat.connexion', 'candidat.connexion_echec'];

/**
 * Fiche complète d'un candidat. Chaque consultation est journalisée (`candidat.fiche_consultee`,
 * RG-13 ; ADR 0017). Compte supprimé : seul le pseudonyme est renvoyé.
 */
export async function lireFicheCandidat(candidatId: number, a: ActeurVivier) {
  await exigerVivier(a);
  const db = getDb();
  const [c] = await db.select().from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c) return null;
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.fiche_consultee', objetType: 'candidat', objetId: candidatId });
  if (c.supprimeLe) return { supprime: true as const, id: c.id, pseudonyme: pseudonyme(c.id), supprimeLe: c.supprimeLe };

  const nomsDe = async <T extends { id: number; nom: string }>(table: typeof schema.arrondissement | typeof schema.quartier, ids: number[]) =>
    ids.length ? ((await db.select({ id: table.id, nom: table.nom }).from(table).where(inArray(table.id, ids))) as T[]) : [];
  const [ville, arrondissement, quartier, zonesArr, zonesQuartiers, experiences, documents, consentements, candidatures, referent, demande, historique] = await Promise.all([
    c.villeId ? db.select({ nom: schema.ville.nom }).from(schema.ville).where(eq(schema.ville.id, c.villeId)).then((r) => r[0]?.nom ?? null) : null,
    c.arrondissementId ? db.select({ nom: schema.arrondissement.nom }).from(schema.arrondissement).where(eq(schema.arrondissement.id, c.arrondissementId)).then((r) => r[0]?.nom ?? null) : null,
    c.quartierId ? db.select({ nom: schema.quartier.nom }).from(schema.quartier).where(eq(schema.quartier.id, c.quartierId)).then((r) => r[0]?.nom ?? null) : null,
    nomsDe(schema.arrondissement, c.zonesArrondissementIds),
    nomsDe(schema.quartier, c.zonesQuartierIds),
    db.select().from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, candidatId)).orderBy(asc(schema.candidatExperience.ordre)),
    db
      .select({ id: schema.candidatDocument.id, categorie: schema.candidatDocument.categorie, nom: schema.candidatDocument.nomOrigine, taille: schema.candidatDocument.taille, creeLe: schema.candidatDocument.creeLe })
      .from(schema.candidatDocument)
      .where(eq(schema.candidatDocument.candidatId, candidatId))
      .orderBy(asc(schema.candidatDocument.categorie), asc(schema.candidatDocument.creeLe)),
    db.select().from(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, candidatId)).orderBy(asc(schema.candidatConsentement.horodatage)),
    db
      .select({ id: schema.candidature.id, offreSlug: schema.candidature.offreSlug, offreTitre: schema.candidature.offreTitre, statut: schema.candidature.statut, creeLe: schema.candidature.creeLe, motivation: schema.candidature.motivation })
      .from(schema.candidature)
      .where(eq(schema.candidature.candidatId, candidatId))
      .orderBy(desc(schema.candidature.creeLe)),
    c.referentId ? db.select({ nom: schema.user.name }).from(schema.user).where(eq(schema.user.id, c.referentId)).then((r) => r[0]?.nom ?? null) : null,
    db
      .select({ id: schema.candidatDemandeReinitialisation.id, creeLe: schema.candidatDemandeReinitialisation.creeLe })
      .from(schema.candidatDemandeReinitialisation)
      .where(and(eq(schema.candidatDemandeReinitialisation.candidatId, candidatId), isNull(schema.candidatDemandeReinitialisation.traiteeLe)))
      .orderBy(desc(schema.candidatDemandeReinitialisation.creeLe))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ id: schema.journalAudit.id, horodatage: schema.journalAudit.horodatage, action: schema.journalAudit.action, acteurType: schema.journalAudit.acteurType, acteurNom: schema.user.name, avant: schema.journalAudit.avant, apres: schema.journalAudit.apres, details: schema.journalAudit.details })
      .from(schema.journalAudit)
      .leftJoin(schema.user, eq(schema.user.id, schema.journalAudit.acteurId))
      .where(and(eq(schema.journalAudit.objetType, 'candidat'), eq(schema.journalAudit.objetId, String(candidatId)), notInArray(schema.journalAudit.action, ACTIONS_HORS_HISTORIQUE)))
      .orderBy(desc(schema.journalAudit.horodatage), desc(schema.journalAudit.id))
      .limit(100),
  ]);

  const { motDePasse: _mdp, ...profil } = c;
  return {
    supprime: false as const,
    candidat: profil,
    ville,
    arrondissement,
    quartier,
    zonesArrondissements: zonesArr.map((z) => z.nom),
    zonesQuartiers: zonesQuartiers.map((z) => z.nom),
    experiences,
    documents,
    consentements,
    candidatures,
    referentNom: referent,
    demandeReinitialisation: demande,
    historique,
    completude: completude({
      email: c.email,
      quartierId: c.quartierId,
      quartierAutre: c.quartierAutre,
      repere: c.repere,
      secteurs: c.secteurs,
      salaireMin: c.salaireMin,
      qualifications: c.qualifications,
      experiences: experiences.length,
      competences: c.competences,
      horaires: c.horaires,
      cv: documents.some((d) => d.categorie === 'cv'),
    }),
    verification: elementsDisponibles({ experiences: experiences.length, quartier: !!(quartier ?? c.quartierAutre), metiers: c.metiers.length }),
  };
}

export type FicheCandidat = NonNullable<Awaited<ReturnType<typeof lireFicheCandidat>>>;

/** Téléchargement d'un CV ou justificatif depuis le Back-Office, journalisé (`candidat.cv_telecharge`). */
export async function lireDocumentPourCollaborateur(candidatId: number, documentId: number, a: ActeurVivier) {
  await exigerVivier(a);
  const [d] = await getDb()
    .select()
    .from(schema.candidatDocument)
    .where(and(eq(schema.candidatDocument.id, documentId), eq(schema.candidatDocument.candidatId, candidatId)));
  if (!d) return null;
  const octets = await getStockage().lire(d.cle);
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.cv_telecharge', objetType: 'candidat', objetId: candidatId, details: { documentId: d.id, categorie: d.categorie } });
  return { nom: d.nomOrigine, mime: d.mime, octets };
}

// ─── WhatsApp ─────────────────────────────────────────────────

/** Message WhatsApp préparé depuis la fiche (comme pour les Dossiers), noté au journal. */
export async function noterWhatsAppCandidat(candidatId: number, modele: string, texte: string, a: ActeurVivier): Promise<void> {
  await exigerVivier(a, 'candidat.traiter');
  const nom = modele.trim().slice(0, 80);
  const t = texte.trim();
  if (!nom || !t) throw new ErreurMetier('Message vide.');
  if (t.length > 4000) throw new ErreurMetier('Message trop long.');
  const [c] = await getDb().select({ supprimeLe: schema.candidat.supprimeLe }).from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c || c.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
  await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.whatsapp_prepare', objetType: 'candidat', objetId: candidatId, details: { modele: nom, texte: masquerLienReinitialisation(t) } });
}

// ─── Réinitialisation assistée et changement de numéro ───────

async function chargerPourProcedure(tx: Pick<Db, 'select'>, candidatId: number, a: ActeurVivier) {
  const [c] = await tx
    .select({ id: schema.candidat.id, prenom: schema.candidat.prenom, nom: schema.candidat.nom, telephone: schema.candidat.telephone, whatsapp: schema.candidat.whatsapp, referentId: schema.candidat.referentId, quartierId: schema.candidat.quartierId, quartierAutre: schema.candidat.quartierAutre, metiers: schema.candidat.metiers, supprimeLe: schema.candidat.supprimeLe, suppressionDemandeeLe: schema.candidat.suppressionDemandeeLe })
    .from(schema.candidat)
    .where(eq(schema.candidat.id, candidatId))
    .for('update');
  if (!c || c.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
  if (!estReferentOuDirection(a, c.referentId)) throw new ErreurMetier('Réservé au référent du candidat ou à la Direction.');
  if (c.suppressionDemandeeLe) throw new ErreurMetier('La suppression de ce compte est en cours.');
  const [e] = await tx.select({ n: count() }).from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, candidatId));
  return { c, disponibles: elementsDisponibles({ experiences: e?.n ?? 0, quartier: !!(c.quartierId || c.quartierAutre), metiers: c.metiers.length }) };
}

export interface LienGenere {
  lien: string;
  expireLe: Date;
}

/**
 * Réinitialisation assistée (MVP2-01 RG-07, ADR 0016) : après vérification d'identité, génère un
 * lien à usage unique valable 30 min (seule l'empreinte est stockée), invalide les liens précédents
 * non utilisés et clôt la demande en attente. Vérification et génération sont journalisées.
 * Le lien n'est renvoyé qu'une fois : il n'est stocké nulle part en clair.
 */
export async function genererLienReinitialisation(candidatId: number, coches: readonly string[], a: ActeurVivier, maintenant = new Date()): Promise<LienGenere> {
  await exigerVivier(a, 'candidat.traiter');
  const jeton = genererJeton();
  const expireLe = new Date(maintenant.getTime() + DUREE_REINITIALISATION_MS);
  await getDb().transaction(async (tx) => {
    const { disponibles } = await chargerPourProcedure(tx, candidatId, a);
    const elements = controlerVerification(coches, disponibles);
    const audit = { acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null, objetType: 'candidat', objetId: candidatId };
    await journaliser({ ...audit, action: 'candidat.identite_verifiee', details: { procedure: 'reinitialisation', elements } }, tx);
    // Les liens précédents encore valables cessent immédiatement de fonctionner.
    const invalides = await tx
      .update(schema.candidatJeton)
      .set({ expireLe: maintenant })
      .where(and(eq(schema.candidatJeton.candidatId, candidatId), eq(schema.candidatJeton.type, 'reinitialisation'), isNull(schema.candidatJeton.utiliseLe), gt(schema.candidatJeton.expireLe, maintenant)))
      .returning({ id: schema.candidatJeton.id });
    await tx.insert(schema.candidatJeton).values({ candidatId, type: 'reinitialisation', empreinte: empreinteJeton(jeton), expireLe, creePar: a.id, creeLe: maintenant });
    const demandes = await tx
      .update(schema.candidatDemandeReinitialisation)
      .set({ traiteeLe: maintenant, traiteePar: a.id })
      .where(and(eq(schema.candidatDemandeReinitialisation.candidatId, candidatId), isNull(schema.candidatDemandeReinitialisation.traiteeLe)))
      .returning({ id: schema.candidatDemandeReinitialisation.id });
    await journaliser({ ...audit, action: 'candidat.lien_reinitialisation_genere', details: { expireLe: expireLe.toISOString(), liensInvalides: invalides.length, demandesTraitees: demandes.map((d) => d.id) } }, tx);
  });
  return { lien: lienReinitialisation(jeton), expireLe };
}

/** Message WhatsApp prérempli avec le lien généré (modèle « Lien de réinitialisation »). */
export async function messageReinitialisation(candidatId: number, lien: string, a: { id: string; nom: string }): Promise<string> {
  const modeles = await listerModelesCandidat();
  const modele = modeles.find((m) => m.nom === MODELE_REINITIALISATION) ?? modeles.find((m) => utiliseLienReinitialisation(m.texte));
  const [c] = await getDb().select({ prenom: schema.candidat.prenom, nom: schema.candidat.nom, referentId: schema.candidat.referentId }).from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!modele || !c) return lien;
  return rendreMessage(modele.texte, await contexteCandidat(c, a, lien));
}

export const MESSAGE_NUMERO_PRIS = 'Ce numéro appartient déjà à un compte candidat.';

/**
 * Changement de numéro (MVP2-01 RG-08) : procédure assistée avec la même vérification d'identité.
 * Le nouveau numéro (E.164) ne doit appartenir à aucun compte ; toutes les sessions du candidat
 * sont fermées. Le WhatsApp suit s'il était identique à l'ancien numéro.
 */
export async function changerNumeroCandidat(candidatId: number, saisie: string, coches: readonly string[], a: ActeurVivier): Promise<string> {
  await exigerVivier(a, 'candidat.traiter');
  const nouveau = normaliserTelephone(saisie);
  if (!nouveau) throw new ErreurMetier('Numéro invalide (ex. 6 90 00 00 00).');
  try {
    await getDb().transaction(async (tx) => {
      const { c, disponibles } = await chargerPourProcedure(tx, candidatId, a);
      const elements = controlerVerification(coches, disponibles);
      if (c.telephone === nouveau) throw new ErreurMetier('C’est déjà le numéro de ce candidat.');
      const [pris] = await tx.select({ id: schema.candidat.id }).from(schema.candidat).where(and(eq(schema.candidat.telephone, nouveau), ne(schema.candidat.id, candidatId)));
      if (pris) throw new ErreurMetier(MESSAGE_NUMERO_PRIS);
      const audit = { acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null, objetType: 'candidat', objetId: candidatId };
      await journaliser({ ...audit, action: 'candidat.identite_verifiee', details: { procedure: 'changement_numero', elements } }, tx);
      const whatsapp = !c.whatsapp || c.whatsapp === c.telephone ? nouveau : c.whatsapp;
      await tx.update(schema.candidat).set({ telephone: nouveau, whatsapp }).where(eq(schema.candidat.id, candidatId));
      await fermerToutesLesSessions(candidatId, tx);
      await journaliser({ ...audit, action: 'candidat.telephone_modifie', avant: { telephone: c.telephone, whatsapp: c.whatsapp }, apres: { telephone: nouveau, whatsapp } }, tx);
    });
  } catch (e) {
    // Course entre deux changements : l'index unique tranche.
    if ((e as { code?: string } | null)?.code === '23505') throw new ErreurMetier(MESSAGE_NUMERO_PRIS);
    throw e;
  }
  return nouveau;
}

// ─── Réaffectation (Direction) ────────────────────────────────

/** Référents recrutement et leur éligibilité pour ce candidat (algorithme MVP1-05, service REC). */
export async function referentsPourCandidat(villeId: number | null, maintenant = new Date()) {
  const liste = await evaluerCandidats(getDb(), { type: 'REC', villeId }, maintenant);
  return liste.sort((x, y) => x.raisons.length - y.raisons.length || x.charge - y.charge || x.nom.localeCompare(y.nom, 'fr')).map(({ id, nom, charge, raisons }) => ({ id, nom, charge, raisons }));
}

/**
 * Réaffectation d'un candidat par la Direction (`candidat.reaffecter`), motif obligatoire,
 * journalisée ; sert aussi à traiter la file « Non attribués ». Le nouveau référent doit avoir accès
 * au vivier ; les autres écarts d'éligibilité sont de simples avertissements.
 */
export async function reaffecterCandidat(candidatId: number, nouveauId: string, motif: string, a: ActeurVivier, maintenant = new Date()): Promise<{ avertissements: string[] }> {
  if (!peut(a.roles, 'candidat.reaffecter')) throw new ErreurMetier('Réaffectation réservée à la Direction.');
  const m = motif.trim();
  if (m.length < 3) throw new ErreurMetier('Motif obligatoire.');
  if (m.length > 500) throw new ErreurMetier('Motif trop long (500 caractères maximum).');
  const res = await getDb().transaction(async (tx) => {
    const [c] = await tx
      .select({ id: schema.candidat.id, prenom: schema.candidat.prenom, nom: schema.candidat.nom, villeId: schema.candidat.villeId, referentId: schema.candidat.referentId, supprimeLe: schema.candidat.supprimeLe })
      .from(schema.candidat)
      .where(eq(schema.candidat.id, candidatId))
      .for('update');
    if (!c || c.supprimeLe) throw new ErreurMetier('Candidat introuvable.');
    if (c.referentId === nouveauId) throw new ErreurMetier('Ce collaborateur est déjà le référent du candidat.');
    const [cible] = await evaluerCandidats(tx, { type: 'REC', villeId: c.villeId }, maintenant, [nouveauId]);
    if (!cible || cible.raisons.includes('compte désactivé')) throw new ErreurMetier('Collaborateur introuvable ou désactivé.');
    const roles = (await tx.select({ role: schema.collaborateurRole.role }).from(schema.collaborateurRole).where(eq(schema.collaborateurRole.userId, nouveauId))).map((r) => r.role);
    if (!(await peutAccederVivier({ id: nouveauId, roles }))) throw new ErreurMetier('Ce collaborateur n’a pas accès au vivier (service Recrutement requis).');

    await tx
      .update(schema.candidat)
      .set({ referentId: nouveauId, attribueLe: maintenant, enFileDepuis: null, derniereRelanceLe: null, alerteNonTraiteLe: null })
      .where(eq(schema.candidat.id, candidatId));
    await tx
      .insert(schema.collaborateurProfil)
      .values({ userId: nouveauId, derniereAttributionLe: maintenant })
      .onConflictDoUpdate({ target: schema.collaborateurProfil.userId, set: { derniereAttributionLe: maintenant } });
    const ligne = `${c.prenom} ${c.nom}`;
    const lien = lienFicheCandidat(candidatId);
    await notifier({ destinataires: [nouveauId], type: 'candidat_attribue', titre: 'Candidat attribué', texte: `La Direction vous a attribué ce candidat :\n${ligne}\nMotif : ${m}`, lien, email: true }, tx);
    if (c.referentId) await notifier({ destinataires: [c.referentId], type: 'candidat_retire', titre: 'Candidat réaffecté', texte: `${ligne} a été confié(e) à ${cible.nom}.\nMotif : ${m}`, lien }, tx);
    await journaliser(
      { acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidat.reaffecte', objetType: 'candidat', objetId: candidatId, avant: { referentId: c.referentId }, apres: { referentId: nouveauId, regle: 'manuelle' }, details: { motif: m, avertissements: cible.raisons } },
      tx,
    );
    return { avertissements: cible.raisons };
  });
  declencherEnvoi();
  return res;
}

// ─── Demandes de réinitialisation assistée en attente ────────

/** Les demandes en attente : celles de mes candidats ; la Direction voit toutes (y compris sans référent). */
export async function listerDemandesReinitialisation(a: ActeurVivier) {
  await exigerVivier(a);
  const direction = a.roles.includes('direction');
  const d = schema.candidatDemandeReinitialisation;
  return getDb()
    .select({ id: d.id, creeLe: d.creeLe, candidatId: schema.candidat.id, prenom: schema.candidat.prenom, nom: schema.candidat.nom, telephone: schema.candidat.telephone, referentId: schema.candidat.referentId, referentNom: schema.user.name })
    .from(d)
    .innerJoin(schema.candidat, eq(schema.candidat.id, d.candidatId))
    .leftJoin(schema.user, eq(schema.user.id, schema.candidat.referentId))
    .where(and(isNull(d.traiteeLe), isNull(schema.candidat.supprimeLe), isNull(schema.candidat.suppressionDemandeeLe), direction ? undefined : eq(schema.candidat.referentId, a.id)))
    .orderBy(asc(d.creeLe));
}
