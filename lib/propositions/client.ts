// Côté client des Propositions (specs/MVP2-03 RG-07..11, RG-15, RG-16, RG-23 ; ADR 0014, 0017) :
// vérification des 4 chiffres, profils transmis (contenu minimisé), CV filigrané, retours du
// client, confirmation de prise de poste, attestation. Utilisé par la page de suivi
// (app/(site)/suivi/[jeton]) et les liens temporaires (app/(site)/profil/[jeton]).
// Indépendant de Next.js, sauf les deux fonctions de cookie (import dynamique de next/headers).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, isNull, ne, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { notifier } from '@/lib/notifications';
import { lireParametre } from '@/lib/parametres';
import { getStockage } from '@/lib/fichiers/stockage';
import { EXPIRATION_SUIVI_MS } from '@/lib/dossiers/service';
import { estFinal, type Statut } from '@/lib/dossiers/statuts';
import type { DossierType } from '@/lib/domain/referentiels';
import { DISPONIBILITES } from '@/lib/candidats/domaine';
import { BLOCAGE_VERIFICATION_MS, MAX_ESSAIS_VERIFICATION, nomAffichable, quatreDerniersChiffres, STATUTS_TRANSMIS, texteFiligrane, type StatutProposition } from './domaine';
import { confirmerPlacement, evenementDossier, lienPropositionsDossier } from './effets';
import { empreinteJeton, jetonAccesValide } from './jetons';
import { dateIsoLongue, filigranerPdf, genererAttestation, imageFiligranee, type DonneesAttestation } from './pdf';

// ─── Cookie de vérification (pur, testable) ─────────────────

export const COOKIE_VERIFICATION = 'nexclean_verif';
/** Durée de validité d'une vérification réussie. */
export const DUREE_VERIFICATION_MS = 2 * 60 * 60 * 1000;

const empreinte = (s: string) => createHash('sha256').update(s).digest('hex');
const hmac = (secret: string, message: string) => createHmac('sha256', secret).update(message).digest('base64url');
const messageVerification = (portee: string, jeton: string, expireLe: number) => `verification-client|v1|${portee}|${expireLe}|${empreinte(jeton)}`;

/**
 * Valeur signée (HMAC-SHA256) du cookie de vérification : « <expiration ms>.<signature> ».
 * La signature couvre la portée (« dossier:<id> » ou « acces:<id> ») et l'empreinte du jeton
 * de la page : un jeton régénéré invalide la vérification.
 */
export function signerVerification(e: { portee: string; jeton: string; expireLe: number }, secret: string): string {
  return `${e.expireLe}.${hmac(secret, messageVerification(e.portee, e.jeton, e.expireLe))}`;
}

export function verificationValide(valeur: string | null | undefined, e: { portee: string; jeton: string }, secret: string, maintenant = Date.now()): boolean {
  if (!valeur) return false;
  const m = /^(\d{10,16})\.([A-Za-z0-9_-]{43})$/.exec(valeur);
  if (!m) return false;
  const expireLe = Number(m[1]);
  if (!Number.isSafeInteger(expireLe) || expireLe <= maintenant || expireLe > maintenant + DUREE_VERIFICATION_MS) return false;
  const attendu = Buffer.from(hmac(secret, messageVerification(e.portee, e.jeton, expireLe)));
  const recu = Buffer.from(m[2]!);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

/** Comparaison à temps constant des 4 chiffres saisis. */
export function chiffresCorrects(saisie: string, whatsapp: string): boolean {
  const attendu = quatreDerniersChiffres(whatsapp);
  const s = saisie.replace(/\D/g, '');
  if (attendu.length !== 4 || s.length !== 4) return false;
  return timingSafeEqual(Buffer.from(s), Buffer.from(attendu));
}

// ─── Contexte : page de suivi ou lien temporaire ────────────

export type ObjetAcces = 'profil' | 'attestation';

export interface Contexte {
  type: 'dossier' | 'acces';
  /** Clé de vérification et portée du cookie : « dossier:<id> » ou « acces:<id> ». */
  cle: string;
  /** Jeton de la page (suivi ou lien temporaire), couvert par la signature du cookie. */
  jeton: string;
  /** Chemin de la page (portée `path` du cookie). */
  chemin: string;
  dossierId: number;
  numero: string;
  typeDossier: DossierType;
  statut: Statut;
  /** Recherche clôturée ou Dossier fermé : seuls les profils placés restent visibles (RG-23). */
  ferme: boolean;
  clientNom: string;
  whatsapp: string;
  referentId: string | null;
  /** Lien temporaire : la Proposition visée et l'objet du lien. */
  accesId?: number;
  propositionId?: number;
  objet?: ObjetAcces;
  expireLe?: Date;
}

const colonnesDossier = {
  dossierId: schema.dossier.id,
  numero: schema.dossier.numero,
  typeDossier: schema.dossier.type,
  statut: schema.dossier.statut,
  fermeLe: schema.dossier.fermeLe,
  rechercheClotureLe: schema.dossier.rechercheClotureLe,
  referentId: schema.dossier.referentId,
  clientNom: schema.client.nom,
  whatsapp: schema.client.whatsapp,
};

/** Contexte de la page de suivi (même contrôle d'expiration que lireSuivi). */
export async function chargerContexteSuivi(jeton: string, maintenant = new Date()): Promise<Contexte | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return null;
  const [r] = await getDb().select(colonnesDossier).from(schema.dossier).innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId)).where(eq(schema.dossier.jetonSuivi, jeton));
  if (!r) return null;
  if (r.fermeLe && maintenant.getTime() - r.fermeLe.getTime() > EXPIRATION_SUIVI_MS) return null;
  const { fermeLe: _f, rechercheClotureLe: _c, ...d } = r;
  return { ...d, type: 'dossier', cle: `dossier:${r.dossierId}`, jeton, chemin: `/suivi/${jeton}`, ferme: estFinal(r.statut) };
}

/**
 * RG-10, RG-15, RG-23 : lien temporaire valide = trouvé par empreinte, non expiré, non révoqué,
 * Proposition transmise et non révoquée, candidat non supprimé ; Dossier fermé → profil placé seulement.
 */
export async function chargerContexteAcces(jeton: string, maintenant = new Date()): Promise<Contexte | null> {
  if (!jetonAccesValide(jeton)) return null;
  const [r] = await getDb()
    .select({
      ...colonnesDossier,
      accesId: schema.accesProfil.id,
      objet: schema.accesProfil.objet,
      expireLe: schema.accesProfil.expireLe,
      revoqueLe: schema.accesProfil.revoqueLe,
      propositionId: schema.proposition.id,
      statutProposition: schema.proposition.statut,
      accesRevoqueLe: schema.proposition.accesRevoqueLe,
      candidatSupprimeLe: schema.candidat.supprimeLe,
      suppressionDemandeeLe: schema.candidat.suppressionDemandeeLe,
    })
    .from(schema.accesProfil)
    .innerJoin(schema.proposition, eq(schema.proposition.id, schema.accesProfil.propositionId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.proposition.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .where(eq(schema.accesProfil.empreinte, empreinteJeton(jeton)));
  if (!r || r.revoqueLe || r.expireLe.getTime() <= maintenant.getTime()) return null;
  if (!STATUTS_TRANSMIS.includes(r.statutProposition) || r.accesRevoqueLe || r.candidatSupprimeLe || r.suppressionDemandeeLe) return null;
  // Clôture de la recherche : la révocation est explicite (accesRevoqueLe, posé par
  // cloturerRecherche sauf pour les remplacements sous garantie) ; dossier fermé : placés seulement.
  const ferme = estFinal(r.statut);
  if (ferme && r.statutProposition !== 'placee') return null;
  if (r.objet !== 'profil' && r.objet !== 'attestation') return null;
  return {
    type: 'acces',
    cle: `acces:${r.accesId}`,
    jeton,
    chemin: `/profil/${jeton}`,
    dossierId: r.dossierId,
    numero: r.numero,
    typeDossier: r.typeDossier,
    statut: r.statut,
    ferme,
    clientNom: r.clientNom,
    whatsapp: r.whatsapp,
    referentId: r.referentId,
    accesId: r.accesId,
    propositionId: r.propositionId,
    objet: r.objet,
    expireLe: r.expireLe,
  };
}

const auditObjet = (ctx: Contexte) => (ctx.type === 'dossier' ? { objetType: 'dossier', objetId: ctx.dossierId } : { objetType: 'acces_profil', objetId: ctx.accesId! });

/** Journalise la consultation d'un lien temporaire (la page de suivi l'est par lireSuivi). */
export async function journaliserConsultationAcces(ctx: Contexte, ip: string | null): Promise<void> {
  if (ctx.type !== 'acces') return;
  await journaliser({ acteurType: 'client', action: 'acces_profil.consulte', ...auditObjet(ctx), ip, details: { propositionId: ctx.propositionId, objet: ctx.objet, dossierId: ctx.dossierId } });
}

// ─── Vérification des 4 chiffres (RG-07, ADR 0014) ──────────

export type ResultatVerification = { ok: true } | { ok: false; erreur: string; bloqueJusquA?: Date; essaisRestants?: number };

const heure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' }).format(d);
const messageBlocage = (d: Date) => `Trop d’essais. Réessayez après ${heure(d)} ou contactez NEXCLEAN sur WhatsApp.`;

/** Blocage en cours pour cette clé, ou null. */
export async function blocageEnCours(cle: string, maintenant = new Date()): Promise<Date | null> {
  const [v] = await getDb().select({ bloqueJusquA: schema.verificationClient.bloqueJusquA }).from(schema.verificationClient).where(eq(schema.verificationClient.cle, cle));
  return v?.bloqueJusquA && v.bloqueJusquA.getTime() > maintenant.getTime() ? v.bloqueJusquA : null;
}

/**
 * RG-07 : compare la saisie aux 4 derniers chiffres du WhatsApp du client. 5 échecs dans une
 * fenêtre glissante de 30 min → blocage 30 min. Chaque tentative (réussie, échouée, bloquée)
 * est journalisée (acteur client, IP).
 */
export async function verifierChiffres(ctx: Contexte, saisie: string, ip: string | null, maintenant = new Date()): Promise<ResultatVerification> {
  return getDb().transaction(async (tx) => {
    const t = maintenant.getTime();
    await tx.insert(schema.verificationClient).values({ cle: ctx.cle }).onConflictDoNothing();
    const [v] = await tx.select().from(schema.verificationClient).where(eq(schema.verificationClient.cle, ctx.cle)).for('update');
    const base = { acteurType: 'client' as const, ...auditObjet(ctx), ip };
    if (v!.bloqueJusquA && v!.bloqueJusquA.getTime() > t) {
      await journaliser({ ...base, action: 'verification_client.bloquee', details: { cle: ctx.cle, bloqueJusquA: v!.bloqueJusquA.toISOString() } }, tx);
      return { ok: false, erreur: messageBlocage(v!.bloqueJusquA), bloqueJusquA: v!.bloqueJusquA };
    }
    // Blocage échu ou premier échec hors de la fenêtre : compteur remis à zéro.
    const fenetreEchue = !v!.premierEchecLe || t - v!.premierEchecLe.getTime() > BLOCAGE_VERIFICATION_MS || !!v!.bloqueJusquA;
    const echecs = fenetreEchue ? 0 : v!.echecs;

    if (chiffresCorrects(saisie, ctx.whatsapp)) {
      await tx.update(schema.verificationClient).set({ echecs: 0, premierEchecLe: null, bloqueJusquA: null }).where(eq(schema.verificationClient.cle, ctx.cle));
      await journaliser({ ...base, action: 'verification_client.reussie', details: { cle: ctx.cle } }, tx);
      return { ok: true };
    }
    const total = echecs + 1;
    const bloque = total >= MAX_ESSAIS_VERIFICATION ? new Date(t + BLOCAGE_VERIFICATION_MS) : null;
    await tx
      .update(schema.verificationClient)
      .set({ echecs: total, premierEchecLe: fenetreEchue ? maintenant : v!.premierEchecLe, bloqueJusquA: bloque })
      .where(eq(schema.verificationClient.cle, ctx.cle));
    await journaliser({ ...base, action: 'verification_client.echec', details: { cle: ctx.cle, essai: total, bloqueJusquA: bloque?.toISOString() ?? null } }, tx);
    if (bloque) return { ok: false, erreur: messageBlocage(bloque), bloqueJusquA: bloque };
    const restants = MAX_ESSAIS_VERIFICATION - total;
    return { ok: false, erreur: `Chiffres incorrects. Il vous reste ${restants} essai${restants > 1 ? 's' : ''}.`, essaisRestants: restants };
  });
}

/** Vérification valide pour ce contexte (cookie signé, non expiré, jeton inchangé). */
export const contexteVerifie = (ctx: Contexte, valeur: string | null | undefined, maintenant = Date.now()) =>
  verificationValide(valeur, { portee: ctx.cle, jeton: ctx.jeton }, env().BETTER_AUTH_SECRET, maintenant);

/** Lit le cookie de vérification de la requête courante (pages, routes, actions). */
export async function estVerifie(ctx: Contexte): Promise<boolean> {
  const { cookies } = await import('next/headers');
  return contexteVerifie(ctx, (await cookies()).get(COOKIE_VERIFICATION)?.value);
}

/** Pose le cookie de vérification (httpOnly, sameSite lax, limité au chemin de la page). */
export async function poserVerification(ctx: Contexte, maintenant = Date.now()): Promise<void> {
  const { cookies } = await import('next/headers');
  const expireLe = maintenant + DUREE_VERIFICATION_MS;
  (await cookies()).set(COOKIE_VERIFICATION, signerVerification({ portee: ctx.cle, jeton: ctx.jeton, expireLe }, env().BETTER_AUTH_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || env().BETTER_AUTH_URL.startsWith('https://'),
    sameSite: 'lax',
    path: ctx.chemin,
    expires: new Date(expireLe),
  });
}

// ─── Profils transmis (RG-07, RG-08, RG-23) ─────────────────

/** Conditions de visibilité d'une Proposition pour ce contexte. */
function conditionsVisibles(ctx: Contexte): SQL {
  const p = schema.proposition;
  const conditions: (SQL | undefined)[] = [
    eq(p.dossierId, ctx.dossierId),
    // RG-23 : dossier fermé → seuls les profils placés ; clôture → accesRevoqueLe (posé par cloturerRecherche).
    ctx.ferme ? eq(p.statut, 'placee') : inArray(p.statut, [...STATUTS_TRANSMIS]),
    isNull(p.accesRevoqueLe),
    isNull(schema.candidat.supprimeLe),
    isNull(schema.candidat.suppressionDemandeeLe),
  ];
  if (ctx.type === 'acces') conditions.push(eq(p.id, ctx.propositionId!));
  return and(...conditions)!;
}

const LIBELLES_STATUT_CLIENT: Partial<Record<StatutProposition, string>> = { proposee: 'Proposé(e)', entretien: 'Entretien', retenue: 'Retenu(e)', placee: 'Placé(e)' };

/** Profil minimisé présenté au client : ni téléphone, ni WhatsApp, ni e-mail, ni adresse, ni repère (RG-08). */
export interface ProfilClient {
  propositionId: number;
  nom: string;
  poste: string;
  statut: string;
  metiers: string[];
  experiences: { poste: string; duree: string | null }[];
  competences: string[];
  disponibilite: string | null;
  quartier: string | null;
  aCv: boolean;
  retour: 'rencontrer' | 'ne_correspond_pas' | null;
  retourMotif: string | null;
}

const dateCourte = (iso: string) => dateIsoLongue(iso);

function disponibiliteTexte(d: string | null, le: string | null, preavis: string | null): string | null {
  if (d === 'immediate') return DISPONIBILITES.immediate;
  if (d === 'a_partir_du') return le ? `Disponible à partir du ${dateCourte(le)}` : 'Disponible prochainement';
  if (d === 'preavis') return preavis?.trim() ? `En poste, préavis : ${preavis.trim()}` : DISPONIBILITES.preavis;
  return null;
}

export async function profilsTransmis(ctx: Contexte): Promise<ProfilClient[]> {
  if (ctx.type === 'acces' && ctx.objet !== 'profil') return [];
  const db = getDb();
  const lignes = await db
    .select({
      propositionId: schema.proposition.id,
      statut: schema.proposition.statut,
      retour: schema.proposition.retourClient,
      retourMotif: schema.proposition.retourClientMotif,
      poste: schema.lignePoste.intitule,
      candidatId: schema.candidat.id,
      prenom: schema.candidat.prenom,
      nom: schema.candidat.nom,
      metiers: schema.candidat.metiers,
      competences: schema.candidat.competences,
      disponibilite: schema.candidat.disponibilite,
      disponibleLe: schema.candidat.disponibleLe,
      preavis: schema.candidat.preavis,
      quartier: schema.quartier.nom,
      quartierAutre: schema.candidat.quartierAutre,
    })
    .from(schema.proposition)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, schema.proposition.lignePosteId))
    .leftJoin(schema.quartier, eq(schema.quartier.id, schema.candidat.quartierId))
    .where(conditionsVisibles(ctx))
    .orderBy(schema.lignePoste.ordre, schema.proposition.id);
  if (!lignes.length) return [];
  const ids = [...new Set(lignes.map((l) => l.candidatId))];
  const experiences = await db
    .select({ candidatId: schema.candidatExperience.candidatId, poste: schema.candidatExperience.poste, duree: schema.candidatExperience.duree })
    .from(schema.candidatExperience)
    .where(inArray(schema.candidatExperience.candidatId, ids))
    .orderBy(schema.candidatExperience.ordre);
  const cvs = await db
    .select({ candidatId: schema.candidatDocument.candidatId })
    .from(schema.candidatDocument)
    .where(and(inArray(schema.candidatDocument.candidatId, ids), eq(schema.candidatDocument.categorie, 'cv')));
  const avecCv = new Set(cvs.map((c) => c.candidatId));
  return lignes.map((l) => ({
    propositionId: l.propositionId,
    nom: nomAffichable(l.prenom, l.nom),
    poste: l.poste,
    statut: LIBELLES_STATUT_CLIENT[l.statut] ?? '',
    metiers: l.metiers,
    experiences: experiences
      .filter((e) => e.candidatId === l.candidatId)
      .slice(0, 5)
      .map((e) => ({ poste: e.poste, duree: e.duree })),
    competences: l.competences,
    disponibilite: disponibiliteTexte(l.disponibilite, l.disponibleLe, l.preavis),
    quartier: l.quartier ?? (l.quartierAutre?.trim() || null),
    aCv: avecCv.has(l.candidatId),
    retour: l.retour,
    retourMotif: l.retourMotif,
  }));
}

/** Nombre de Propositions visibles (sans aucune donnée de profil) : affiche ou non la section. */
export async function compterVisibles(ctx: Contexte): Promise<number> {
  const r = await getDb()
    .select({ id: schema.proposition.id })
    .from(schema.proposition)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .where(conditionsVisibles(ctx));
  return r.length;
}

/** Proposition visible dans ce contexte (pour les actions et routes), ou erreur. */
async function propositionVisible(ctx: Contexte, propositionId: number) {
  if (!Number.isInteger(propositionId) || propositionId <= 0) throw new ErreurMetier('Profil introuvable.');
  const [p] = await getDb()
    .select({ id: schema.proposition.id, candidatId: schema.proposition.candidatId, retour: schema.proposition.retourClient, retourMotif: schema.proposition.retourClientMotif, prenom: schema.candidat.prenom, nom: schema.candidat.nom, poste: schema.lignePoste.intitule })
    .from(schema.proposition)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.proposition.candidatId))
    .innerJoin(schema.lignePoste, eq(schema.lignePoste.id, schema.proposition.lignePosteId))
    .where(and(conditionsVisibles(ctx), eq(schema.proposition.id, propositionId)));
  if (!p) throw new ErreurMetier('Ce profil n’est plus disponible.');
  return p;
}

// ─── CV (RG-09) ─────────────────────────────────────────────

export class ErreurFiligrane extends Error {}

/**
 * RG-09 : dernier CV du candidat, filigrané « Transmis par NEXCLEAN à <client> le <date> »
 * (PDF ; image JPEG/PNG convertie en PDF filigrané ; autre format servi tel quel).
 * Consultation journalisée (horodatage, IP, proposition, document). null si aucun CV.
 */
export async function lireCvTransmis(ctx: Contexte, propositionId: number, ip: string | null, maintenant = new Date()): Promise<{ nom: string; mime: string; octets: Uint8Array } | null> {
  if (ctx.type === 'acces' && ctx.objet !== 'profil') throw new ErreurMetier('Profil introuvable.');
  const p = await propositionVisible(ctx, propositionId);
  const [doc] = await getDb()
    .select()
    .from(schema.candidatDocument)
    .where(and(eq(schema.candidatDocument.candidatId, p.candidatId), eq(schema.candidatDocument.categorie, 'cv')))
    .orderBy(desc(schema.candidatDocument.creeLe), desc(schema.candidatDocument.id))
    .limit(1);
  if (!doc) return null;
  const brut = await getStockage().lire(doc.cle);
  const texte = texteFiligrane(ctx.clientNom, maintenant);
  const base = `CV-${nomAffichable(p.prenom, p.nom).replace(/[^A-Za-z0-9À-ÿ]+/g, '-').replace(/-+$/, '')}`;
  let fichier: { nom: string; mime: string; octets: Uint8Array };
  try {
    if (doc.mime === 'application/pdf') fichier = { nom: `${base}.pdf`, mime: 'application/pdf', octets: await filigranerPdf(brut, texte) };
    else {
      const pdf = await imageFiligranee(brut, doc.mime, texte);
      const ext = doc.nomOrigine.split('.').pop()?.toLowerCase() ?? 'bin';
      fichier = pdf ? { nom: `${base}.pdf`, mime: 'application/pdf', octets: pdf } : { nom: `${base}.${ext}`, mime: doc.mime, octets: brut };
    }
  } catch {
    await journaliser({ acteurType: 'client', action: 'proposition.cv_filigrane_echec', objetType: 'proposition', objetId: propositionId, ip, details: { documentId: doc.id, ...auditAcces(ctx) } });
    throw new ErreurFiligrane('Le CV ne peut pas être affiché pour le moment.');
  }
  await journaliser({ acteurType: 'client', action: 'proposition.cv_consulte', objetType: 'proposition', objetId: propositionId, ip, details: { documentId: doc.id, dossierId: ctx.dossierId, ...auditAcces(ctx) } });
  return fichier;
}

const auditAcces = (ctx: Contexte) => (ctx.type === 'acces' ? { accesId: ctx.accesId } : { via: 'suivi' });

// ─── Retours du client (RG-11) ──────────────────────────────

export type RetourClient = 'rencontrer' | 'ne_correspond_pas';

/** RG-11 : retour du client sur un profil ; référent notifié ; aucun changement de statut. */
export async function enregistrerRetourClient(ctx: Contexte, propositionId: number, retour: RetourClient, motif: string | null, ip: string | null): Promise<void> {
  if (retour !== 'rencontrer' && retour !== 'ne_correspond_pas') throw new ErreurMetier('Réponse invalide.');
  if (ctx.type === 'acces' && ctx.objet !== 'profil') throw new ErreurMetier('Profil introuvable.');
  const p = await propositionVisible(ctx, propositionId);
  const m = retour === 'ne_correspond_pas' ? motif?.trim().slice(0, 500) || null : null;
  // Même réponse renvoyée (double clic, rechargement) : rien à notifier.
  if (p.retour === retour && (p.retourMotif ?? null) === m) return;
  const libelle = `${nomAffichable(p.prenom, p.nom)} — ${p.poste}`;
  const texte = retour === 'rencontrer' ? 'souhaite le / la rencontrer' : `indique que le profil ne correspond pas${m ? ` (${m})` : ''}`;
  await getDb().transaction(async (tx) => {
    await tx.update(schema.proposition).set({ retourClient: retour, retourClientMotif: m, retourClientLe: new Date() }).where(eq(schema.proposition.id, propositionId));
    await evenementDossier(tx, ctx.dossierId, 'proposition', `${libelle} : le client ${texte}`, { type: 'client', ip }, { propositionId, retourClient: retour });
    await journaliser({ acteurType: 'client', action: 'proposition.retour_client', objetType: 'proposition', objetId: propositionId, ip, apres: { retourClient: retour, motif: m }, details: auditAcces(ctx) }, tx);
    await notifier(
      {
        destinataires: [ctx.referentId],
        type: 'proposition_retour_client',
        titre: retour === 'rencontrer' ? 'Le client souhaite rencontrer un candidat' : 'Profil écarté par le client',
        texte: `${libelle} (${ctx.numero}) : ${ctx.clientNom} ${texte}.`,
        lien: lienPropositionsDossier(ctx.dossierId),
        dossierId: ctx.dossierId,
        cle: `proposition_retour:${propositionId}:${retour}:${Date.now()}`,
      },
      tx,
    );
  });
}

// ─── Placements : confirmation (RG-16) et attestation (RG-15) ─

export interface PlacementClient {
  placementId: number;
  propositionId: number;
  prenom: string;
  nom: string;
  poste: string;
  datePrevue: string;
  statut: 'annonce' | 'confirme';
  datePriseDePoste: string | null;
}

/** Placements annoncés ou confirmés visibles dans ce contexte (confirmation, attestation). */
export async function placementsClient(ctx: Contexte): Promise<PlacementClient[]> {
  if (ctx.type === 'acces' && ctx.objet !== 'attestation') return [];
  const rows = await getDb()
    .select({
      placementId: schema.placement.id,
      propositionId: schema.placement.propositionId,
      prenom: schema.candidat.prenom,
      nom: schema.candidat.nom,
      poste: schema.placement.poste,
      datePrevue: schema.placement.datePrevue,
      statut: schema.placement.statut,
      datePriseDePoste: schema.placement.datePriseDePoste,
    })
    .from(schema.placement)
    .innerJoin(schema.proposition, eq(schema.proposition.id, schema.placement.propositionId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.placement.candidatId))
    .where(and(conditionsVisibles(ctx), inArray(schema.placement.statut, ['annonce', 'confirme'])))
    .orderBy(schema.placement.datePrevue, schema.placement.id);
  return rows.map((r) => ({ ...r, nom: nomAffichable(r.prenom, r.nom), statut: r.statut as 'annonce' | 'confirme' }));
}

async function placementVisible(ctx: Contexte, placementId: number, statuts: ('annonce' | 'confirme')[]) {
  if (!Number.isInteger(placementId) || placementId <= 0) throw new ErreurMetier('Placement introuvable.');
  if (ctx.type === 'acces' && ctx.objet !== 'attestation') throw new ErreurMetier('Placement introuvable.');
  const [pl] = await getDb()
    .select({ id: schema.placement.id, statut: schema.placement.statut, datePrevue: schema.placement.datePrevue })
    .from(schema.placement)
    .innerJoin(schema.proposition, eq(schema.proposition.id, schema.placement.propositionId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.placement.candidatId))
    .where(and(conditionsVisibles(ctx), eq(schema.placement.id, placementId), ne(schema.placement.statut, 'abandonne')));
  if (!pl || !statuts.includes(pl.statut as 'annonce')) throw new ErreurMetier('Ce placement n’est plus à confirmer.');
  return pl;
}

const dateIsoValide = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** RG-16 : le client confirme la prise de poste (nom et fonction du signataire, date effective). */
export async function confirmerPriseDePoste(
  ctx: Contexte,
  placementId: number,
  saisie: { signataireNom: string; signataireFonction: string; datePriseDePoste?: string | null },
  ip: string | null,
): Promise<void> {
  const pl = await placementVisible(ctx, placementId, ['annonce']);
  const nom = String(saisie.signataireNom ?? '').trim();
  const fonction = String(saisie.signataireFonction ?? '').trim();
  if (!nom || !fonction) throw new ErreurMetier('Indiquez le nom et la fonction du signataire.');
  if (nom.length > 120 || fonction.length > 120) throw new ErreurMetier('Nom ou fonction trop long (120 caractères au plus).');
  const date = saisie.datePriseDePoste?.trim() || pl.datePrevue;
  if (!dateIsoValide(date)) throw new ErreurMetier('Date de prise de poste invalide.');
  await getDb().transaction((tx) =>
    confirmerPlacement(tx, placementId, { mode: 'client', datePriseDePoste: date, signataireNom: nom, signataireFonction: fonction, ip }, { type: 'client', ip }),
  );
}

/** Données de l'attestation d'un Placement (Back-Office et client). */
export async function donneesAttestation(placementId: number): Promise<(DonneesAttestation & { dossierId: number; referentId: string | null; statut: string }) | null> {
  const [r] = await getDb()
    .select({
      dossierId: schema.dossier.id,
      referentId: schema.dossier.referentId,
      numeroDossier: schema.dossier.numero,
      client: schema.client.nom,
      contact: schema.client.contact,
      candidatPrenom: schema.candidat.prenom,
      candidatNom: schema.candidat.nom,
      poste: schema.placement.poste,
      datePrevue: schema.placement.datePrevue,
      statut: schema.placement.statut,
      confirmationMode: schema.placement.confirmationMode,
      datePriseDePoste: schema.placement.datePriseDePoste,
      signataireNom: schema.placement.signataireNom,
      signataireFonction: schema.placement.signataireFonction,
      confirmeLe: schema.placement.confirmeLe,
    })
    .from(schema.placement)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.placement.dossierId))
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.placement.candidatId))
    .where(eq(schema.placement.id, placementId));
  if (!r) return null;
  const garantieJours = await lireParametre('garantie_jours');
  const confirmation =
    r.confirmationMode === 'client' && r.datePriseDePoste && r.confirmeLe
      ? { datePriseDePoste: r.datePriseDePoste, signataireNom: r.signataireNom, signataireFonction: r.signataireFonction, confirmeLe: r.confirmeLe }
      : null;
  return {
    dossierId: r.dossierId,
    referentId: r.referentId,
    statut: r.statut,
    numeroDossier: r.numeroDossier,
    client: r.client,
    contact: r.contact,
    candidatPrenom: r.candidatPrenom,
    candidatNom: r.candidatNom,
    poste: r.poste,
    datePrevue: r.datePrevue,
    garantieJours,
    confirmation,
  };
}

export const nomFichierAttestation = (numero: string, prenom: string) => `Attestation-prise-de-poste-${numero}-${prenom}`.replace(/[^A-Za-z0-9À-ÿ-]+/g, '-') + '.pdf';

/** RG-15 : attestation téléchargée depuis la page de suivi ou un lien temporaire (journalisé). */
export async function attestationPourClient(ctx: Contexte, placementId: number, ip: string | null): Promise<{ nom: string; octets: Uint8Array }> {
  await placementVisible(ctx, placementId, ['annonce', 'confirme']);
  const d = await donneesAttestation(placementId);
  if (!d) throw new ErreurMetier('Placement introuvable.');
  const octets = await genererAttestation(d);
  await journaliser({ acteurType: 'client', action: 'placement.attestation_telechargee', objetType: 'placement', objetId: placementId, ip, details: { dossierId: ctx.dossierId, ...auditAcces(ctx) } });
  return { nom: nomFichierAttestation(d.numeroDossier, d.candidatPrenom), octets };
}
