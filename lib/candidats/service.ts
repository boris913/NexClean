// Espace candidat (MVP2-01) : inscription, connexion, profil, documents, mot de passe oublié,
// suppression des données. Logique serveur sans cookie (testable) ; les cookies sont dans session.ts.
import { and, asc, count, eq, gt, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { echapperHtml, envoyerEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { hacherMotDePasse, verifierMotDePasse } from '@/lib/auth/mot-de-passe';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { empreinteJeton, genererJeton } from '@/lib/collaborateurs/jetons';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { idsDirection, notifier } from '@/lib/notifications';
import { normaliserTelephone } from '@/lib/telephone';
import { FUSEAU } from '@/lib/domain/referentiels';
import { nomAffichable, STATUTS_EN_COURS } from '@/lib/propositions/domaine';
import { chargerProposition, evenementDossier, lienPropositionsDossier, type Tx } from '@/lib/propositions/effets';
import { attribuerCandidat, lienFicheCandidat } from './attribution';
import {
  CONSENTEMENTS,
  JOURS_AVANT_SUPPRESSION,
  MAX_JUSTIFICATIFS,
  MOIS_AVANT_RAPPEL,
  completude,
  pseudonyme,
  schemaConsentements,
  schemaMotDePasse,
  validerProfil,
  type BrouillonCandidat,
  type ProfilValide,
  type TypeConsentement,
} from './domaine';

export const MESSAGE_DEJA_INSCRIT = 'Ce numéro a déjà un compte.';
export const MESSAGE_SUPPRESSION_EN_COURS =
  'La suppression de ce compte et de ses données est en cours. Pour l’annuler, contactez NEXCLEAN sur WhatsApp.';
export const MESSAGE_IDENTIFIANTS = 'Numéro ou mot de passe incorrect.';
export const MESSAGE_BLOQUE = 'Trop de tentatives. Réessayez dans 15 minutes.';

export const MAX_ECHECS_CONNEXION = 5;
export const FENETRE_ECHECS_MS = 15 * 60 * 1000;
export const DUREE_REINITIALISATION_MS = 30 * 60 * 1000;

/** Ferme toutes les sessions d'un candidat (mot de passe changé, suppression demandée). */
export async function fermerToutesLesSessions(candidatId: number, tx: Pick<ReturnType<typeof getDb>, 'delete'> = getDb()): Promise<void> {
  await tx.delete(schema.candidatSession).where(eq(schema.candidatSession.candidatId, candidatId));
}

const acteur = (candidatId: number, ip?: string | null) => ({ acteurType: 'candidat' as const, acteurId: String(candidatId), ip: ip ?? null });

/** Colonnes du profil à partir d'un profil validé. */
function colonnesProfil(p: ProfilValide) {
  return {
    nom: p.nom,
    prenom: p.prenom,
    whatsapp: p.whatsapp,
    email: p.email,
    villeId: p.villeId,
    villeAutre: p.villeId ? null : p.villeAutre,
    arrondissementId: p.arrondissementId,
    quartierId: p.quartierId,
    quartierAutre: p.quartierId ? null : p.quartierAutre,
    repere: p.repere,
    zonesTouteVille: p.zonesTouteVille,
    zonesArrondissementIds: p.zonesArrondissementIds,
    zonesQuartierIds: p.zonesQuartierIds,
    metiers: p.metiers,
    secteurs: p.secteurs,
    typesContrat: p.typesContrat,
    salaireMin: p.salaireMin,
    salaireMax: p.salaireMax,
    niveauEtudes: p.niveauEtudes,
    qualifications: p.qualifications,
    competences: p.competences,
    disponibilite: p.disponibilite,
    disponibleLe: p.disponibleLe,
    preavis: p.preavis,
    horaires: p.horaires,
  };
}

// ─── Inscription (RG-01..05) ──────────────────────────────────

export async function inscrireCandidat(
  brouillon: BrouillonCandidat,
  motDePasse: string,
  contexte: { ip: string | null; canal?: 'site' | 'assiste' },
): Promise<{ candidatId: number }> {
  const v = validerProfil(brouillon);
  if (!v.ok) throw new ErreurMetier(Object.values(v.erreurs)[0] ?? 'Formulaire incomplet.');
  const consentements = schemaConsentements.safeParse(brouillon);
  if (!consentements.success) throw new ErreurMetier('Les deux consentements et l’attestation d’âge sont nécessaires pour vous inscrire.');
  const mdp = schemaMotDePasse.safeParse(motDePasse);
  if (!mdp.success) throw new ErreurMetier(mdp.error.issues[0]!.message);

  const empreinte = await hacherMotDePasse(motDePasse);
  const canal = contexte.canal ?? 'site';
  return getDb().transaction(async (tx) => {
    const [existant] = await tx.select({ id: schema.candidat.id }).from(schema.candidat).where(eq(schema.candidat.telephone, v.profil.telephone));
    if (existant) throw new ErreurMetier(MESSAGE_DEJA_INSCRIT);
    const [c] = await tx
      .insert(schema.candidat)
      .values({ ...colonnesProfil(v.profil), telephone: v.profil.telephone, motDePasse: empreinte, canalInscription: canal })
      .onConflictDoNothing()
      .returning({ id: schema.candidat.id });
    // Course entre deux inscriptions simultanées du même numéro : l'index unique tranche.
    if (!c) throw new ErreurMetier(MESSAGE_DEJA_INSCRIT);
    if (v.profil.experiences.length) {
      await tx.insert(schema.candidatExperience).values(v.profil.experiences.map((e, i) => ({ ...e, candidatId: c.id, ordre: i + 1 })));
    }
    await tx.insert(schema.candidatConsentement).values(
      (Object.keys(CONSENTEMENTS) as TypeConsentement[]).map((type) => ({ candidatId: c.id, type, version: CONSENTEMENTS[type].version, canal, ip: contexte.ip })),
    );
    await journaliser({ ...acteur(c.id, contexte.ip), action: 'candidat.inscrit', objetType: 'candidat', objetId: c.id, details: { canal } }, tx);
    // MVP2-02 RG-01 : file « Nouveaux candidats » du référent recrutement de sa ville.
    await attribuerCandidat(tx, c.id);
    return { candidatId: c.id };
  });
}

// ─── Connexion (RG-06) ────────────────────────────────────────

async function echecsRecents(telephone: string, ip: string | null): Promise<{ compte: number; ip: number }> {
  const j = schema.journalAudit;
  const depuis = new Date(Date.now() - FENETRE_ECHECS_MS);
  const [r] = await getDb()
    .select({
      compte: sql<number>`count(*) filter (where ${j.details}->>'telephone' = ${telephone})`.mapWith(Number),
      ip: ip ? sql<number>`count(*) filter (where ${j.ip} = ${ip})`.mapWith(Number) : sql<number>`0`.mapWith(Number),
    })
    .from(j)
    .where(and(eq(j.action, 'candidat.connexion_echec'), gte(j.horodatage, depuis), ip ? or(sql`${j.details}->>'telephone' = ${telephone}`, eq(j.ip, ip)) : sql`${j.details}->>'telephone' = ${telephone}`));
  return { compte: r?.compte ?? 0, ip: r?.ip ?? 0 };
}

/** Vérifie téléphone + mot de passe ; renvoie l'identifiant du candidat, ou lève une ErreurMetier. */
export async function verifierConnexion(telephoneSaisi: string, motDePasse: string, ip: string | null): Promise<number> {
  const telephone = normaliserTelephone(telephoneSaisi);
  if (!telephone || !motDePasse) throw new ErreurMetier(MESSAGE_IDENTIFIANTS);
  const echecs = await echecsRecents(telephone, ip);
  if (echecs.compte >= MAX_ECHECS_CONNEXION || echecs.ip >= MAX_ECHECS_CONNEXION) {
    await journaliser({ acteurType: 'anonyme', action: 'candidat.connexion_bloquee', ip, details: { telephone } });
    throw new ErreurMetier(MESSAGE_BLOQUE);
  }
  const [c] = await getDb()
    .select({ id: schema.candidat.id, motDePasse: schema.candidat.motDePasse, suppression: schema.candidat.suppressionDemandeeLe })
    .from(schema.candidat)
    .where(eq(schema.candidat.telephone, telephone));
  const ok = !!c?.motDePasse && (await verifierMotDePasse({ hash: c.motDePasse, password: motDePasse }));
  if (!ok) {
    await journaliser({ acteurType: 'anonyme', action: 'candidat.connexion_echec', objetType: c ? 'candidat' : undefined, objetId: c?.id, ip, details: { telephone } });
    throw new ErreurMetier(MESSAGE_IDENTIFIANTS);
  }
  // RG-16 : compte bloqué dès la demande de suppression (message explicite, mot de passe correct).
  if (c.suppression) throw new ErreurMetier(MESSAGE_SUPPRESSION_EN_COURS);
  await journaliser({ ...acteur(c.id, ip), action: 'candidat.connexion', objetType: 'candidat', objetId: c.id });
  return c.id;
}

// ─── Espace personnel (RG-09..12) ─────────────────────────────

/** Tout ce que l'espace candidat affiche. Jamais : notes internes, statut interne détaillé (RG-12). */
export async function lireEspace(candidatId: number, maintenant = new Date()) {
  const db = getDb();
  const [c] = await db.select().from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c) throw new ErreurMetier('Compte introuvable.');
  const [experiences, documents] = await Promise.all([
    db.select().from(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, candidatId)).orderBy(asc(schema.candidatExperience.ordre)),
    db
      .select({ id: schema.candidatDocument.id, categorie: schema.candidatDocument.categorie, nomOrigine: schema.candidatDocument.nomOrigine, taille: schema.candidatDocument.taille, creeLe: schema.candidatDocument.creeLe })
      .from(schema.candidatDocument)
      .where(eq(schema.candidatDocument.candidatId, candidatId))
      .orderBy(asc(schema.candidatDocument.creeLe)),
  ]);
  const limiteRappel = new Date(maintenant);
  limiteRappel.setMonth(limiteRappel.getMonth() - MOIS_AVANT_RAPPEL);
  return {
    candidat: {
      id: c.id,
      nom: c.nom,
      prenom: c.prenom,
      telephone: c.telephone,
      whatsapp: c.whatsapp,
      email: c.email,
      villeId: c.villeId,
      villeAutre: c.villeAutre,
      arrondissementId: c.arrondissementId,
      quartierId: c.quartierId,
      quartierAutre: c.quartierAutre,
      repere: c.repere,
      zonesTouteVille: c.zonesTouteVille,
      zonesArrondissementIds: c.zonesArrondissementIds,
      zonesQuartierIds: c.zonesQuartierIds,
      metiers: c.metiers,
      secteurs: c.secteurs,
      typesContrat: c.typesContrat,
      salaireMin: c.salaireMin,
      salaireMax: c.salaireMax,
      niveauEtudes: c.niveauEtudes,
      qualifications: c.qualifications,
      competences: c.competences,
      disponibilite: c.disponibilite,
      disponibleLe: c.disponibleLe,
      preavis: c.preavis,
      horaires: c.horaires,
      profilMisAJourLe: c.profilMisAJourLe,
    },
    /** Seule information de statut montrée au candidat (RG-09, RG-12). */
    enRecherche: enRecherche(c.statut),
    /** Placement confirmé (ADR 0011 §4) : il peut se déclarer de nouveau en recherche. */
    place: c.statut === 'place',
    experiences,
    documents,
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
    rappelMiseAJour: c.profilMisAJourLe < limiteRappel,
  };
}

export type EspaceCandidat = Awaited<ReturnType<typeof lireEspace>>;

/** Le profil dans le format du formulaire (pour la modification). */
export function versBrouillon(e: EspaceCandidat): BrouillonCandidat {
  const c = e.candidat;
  const txt = (n: number | null) => (n == null ? '' : String(n));
  return {
    nom: c.nom,
    prenom: c.prenom,
    telephone: c.telephone ?? '',
    whatsappIdentique: !c.whatsapp || c.whatsapp === c.telephone,
    whatsapp: c.whatsapp && c.whatsapp !== c.telephone ? c.whatsapp : '',
    email: c.email ?? '',
    villeId: c.villeId,
    villeAutre: c.villeAutre ?? '',
    arrondissementId: c.arrondissementId,
    quartierId: c.quartierId,
    quartierAutre: c.quartierAutre ?? '',
    repere: c.repere ?? '',
    zonesTouteVille: c.zonesTouteVille,
    zonesArrondissementIds: c.zonesArrondissementIds,
    zonesQuartierIds: c.zonesQuartierIds,
    metiers: c.metiers,
    secteurs: c.secteurs,
    typesContrat: c.typesContrat,
    salaireMin: txt(c.salaireMin),
    salaireMax: txt(c.salaireMax),
    niveauEtudes: c.niveauEtudes ?? '',
    qualifications: c.qualifications ?? '',
    experiences: e.experiences.map((x) => ({ poste: x.poste, employeur: x.employeur ?? '', ville: x.ville ?? '', duree: x.duree ?? '', missions: x.missions ?? '' })),
    competences: c.competences,
    disponibilite: c.disponibilite ?? '',
    disponibleLe: c.disponibleLe ?? '',
    preavis: c.preavis ?? '',
    horaires: c.horaires as BrouillonCandidat['horaires'],
    consentementTraitement: true,
    consentementContact: true,
    consentementMajorite: true,
  };
}

/** Modification du profil (RG-10). Le téléphone ne change pas ici (procédure assistée, RG-08). */
export async function modifierProfil(candidatId: number, brouillon: BrouillonCandidat, ip: string | null): Promise<void> {
  const db = getDb();
  const [c] = await db.select({ telephone: schema.candidat.telephone }).from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c?.telephone) throw new ErreurMetier('Compte introuvable.');
  const v = validerProfil({ ...brouillon, telephone: c.telephone });
  if (!v.ok) throw new ErreurMetier(Object.values(v.erreurs)[0] ?? 'Formulaire incomplet.');
  if (v.profil.whatsappIdentique) v.profil.whatsapp = c.telephone;
  await db.transaction(async (tx) => {
    await tx.update(schema.candidat).set({ ...colonnesProfil(v.profil), profilMisAJourLe: new Date() }).where(eq(schema.candidat.id, candidatId));
    await tx.delete(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, candidatId));
    if (v.profil.experiences.length) {
      await tx.insert(schema.candidatExperience).values(v.profil.experiences.map((e, i) => ({ ...e, candidatId, ordre: i + 1 })));
    }
    await journaliser({ ...acteur(candidatId, ip), action: 'candidat.profil_modifie', objetType: 'candidat', objetId: candidatId }, tx);
  });
}

/** Un candidat `placé` n'est plus proposé à d'autres Clients (ADR 0011 §4), comme un `indisponible`. */
const enRecherche = (statut: string) => statut !== 'indisponible' && statut !== 'place';

/**
 * « Je suis toujours en recherche » / « Je ne cherche plus » (RG-10). Depuis `placé`, la reprise
 * remet le candidat « à contacter » (ADR 0011 §4) ; `placé` n'est jamais restauré par une reprise.
 */
export async function definirRecherche(candidatId: number, actif: boolean, ip: string | null): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [c] = await tx.select({ statut: schema.candidat.statut, avant: schema.candidat.statutAvantIndisponible }).from(schema.candidat).where(eq(schema.candidat.id, candidatId));
    if (!c) throw new ErreurMetier('Compte introuvable.');
    if (actif === enRecherche(c.statut)) return;
    const repris = c.statut === 'indisponible' && c.avant && c.avant !== 'place' ? c.avant : ('a_contacter' as const);
    const valeurs = actif ? { statut: repris, statutAvantIndisponible: null } : { statut: 'indisponible' as const, statutAvantIndisponible: c.statut };
    await tx.update(schema.candidat).set({ ...valeurs, profilMisAJourLe: new Date() }).where(eq(schema.candidat.id, candidatId));
    await journaliser({ ...acteur(candidatId, ip), action: actif ? 'candidat.recherche_reprise' : 'candidat.recherche_arretee', objetType: 'candidat', objetId: candidatId, avant: { statut: c.statut }, apres: { statut: valeurs.statut } }, tx);
  });
}

// ─── Documents (RG-02 étape 6, RG-10) ─────────────────────────

const TYPES_CANDIDAT = ['pdf', 'docx', 'jpeg', 'png'] as const;

/** Ajoute un CV (remplace le précédent) ou un justificatif (5 au plus). */
export async function ajouterDocument(candidatId: number, categorie: 'cv' | 'justificatif', nom: string, octets: Uint8Array, ip: string | null) {
  const v = validerFichier(nom, octets);
  if (!v.ok) throw new ErreurMetier(v.erreur);
  if (!(TYPES_CANDIDAT as readonly string[]).includes(v.type)) throw new ErreurMetier('Formats acceptés : PDF, DOCX, JPEG ou PNG.');
  const db = getDb();
  if (categorie === 'justificatif') {
    const [n] = await db.select({ n: count() }).from(schema.candidatDocument).where(and(eq(schema.candidatDocument.candidatId, candidatId), eq(schema.candidatDocument.categorie, 'justificatif')));
    if ((n?.n ?? 0) >= MAX_JUSTIFICATIFS) throw new ErreurMetier(`${MAX_JUSTIFICATIFS} justificatifs au maximum : supprimez-en un d’abord.`);
  }
  const cle = nouvelleCle('candidats', v.type === 'jpeg' ? 'jpg' : v.type);
  await getStockage().deposer(cle, octets);
  const anciens = categorie === 'cv' ? await db.select({ id: schema.candidatDocument.id, cle: schema.candidatDocument.cle }).from(schema.candidatDocument).where(and(eq(schema.candidatDocument.candidatId, candidatId), eq(schema.candidatDocument.categorie, 'cv'))) : [];
  try {
    await db.transaction(async (tx) => {
      for (const a of anciens) await tx.delete(schema.candidatDocument).where(eq(schema.candidatDocument.id, a.id));
      const [d] = await tx.insert(schema.candidatDocument).values({ candidatId, categorie, cle, nomOrigine: nom.slice(0, 200), mime: v.mime, taille: octets.byteLength }).returning({ id: schema.candidatDocument.id });
      await tx.update(schema.candidat).set({ profilMisAJourLe: new Date() }).where(eq(schema.candidat.id, candidatId));
      await journaliser({ ...acteur(candidatId, ip), action: categorie === 'cv' ? (anciens.length ? 'candidat.cv_remplace' : 'candidat.cv_ajoute') : 'candidat.justificatif_ajoute', objetType: 'candidat_document', objetId: d!.id }, tx);
    });
  } catch (e) {
    await getStockage().supprimer(cle);
    throw e;
  }
  for (const a of anciens) await getStockage().supprimer(a.cle);
}

export async function supprimerDocument(candidatId: number, documentId: number, ip: string | null): Promise<void> {
  const db = getDb();
  const [d] = await db.select().from(schema.candidatDocument).where(and(eq(schema.candidatDocument.id, documentId), eq(schema.candidatDocument.candidatId, candidatId)));
  if (!d) throw new ErreurMetier('Document introuvable.');
  await db.transaction(async (tx) => {
    await tx.delete(schema.candidatDocument).where(eq(schema.candidatDocument.id, d.id));
    await journaliser({ ...acteur(candidatId, ip), action: 'candidat.document_supprime', objetType: 'candidat_document', objetId: d.id, details: { categorie: d.categorie } }, tx);
  });
  await getStockage().supprimer(d.cle);
}

/** Lecture d'un document par son propriétaire (téléchargement depuis l'espace). */
export async function lireDocument(candidatId: number, documentId: number) {
  const [d] = await getDb().select().from(schema.candidatDocument).where(and(eq(schema.candidatDocument.id, documentId), eq(schema.candidatDocument.candidatId, candidatId)));
  if (!d) return null;
  return { nom: d.nomOrigine, mime: d.mime, octets: await getStockage().lire(d.cle) };
}

// ─── Mot de passe oublié (RG-07) ──────────────────────────────

/**
 * Demande de réinitialisation. Avec e-mail : lien à usage unique (30 min). Sans e-mail : demande
 * assistée, tâche chez le référent (ou la Direction si le candidat n'est pas attribué) ; aucun lien
 * n'est envoyé automatiquement. Réponse identique dans tous les cas (aucune information sur
 * l'existence d'un compte).
 */
export async function demanderReinitialisation(telephoneSaisi: string, ip: string | null): Promise<void> {
  const telephone = normaliserTelephone(telephoneSaisi);
  if (!telephone) throw new ErreurMetier('Numéro invalide (ex. 6 90 00 00 00)');
  const db = getDb();
  const [c] = await db
    .select({ id: schema.candidat.id, email: schema.candidat.email, prenom: schema.candidat.prenom, nom: schema.candidat.nom, referentId: schema.candidat.referentId })
    .from(schema.candidat)
    .where(and(eq(schema.candidat.telephone, telephone), isNull(schema.candidat.suppressionDemandeeLe)));
  if (!c) {
    await journaliser({ acteurType: 'anonyme', action: 'candidat.reinitialisation_inconnue', ip, details: { telephone } });
    return;
  }
  if (c.email) {
    const jeton = genererJeton();
    await db.insert(schema.candidatJeton).values({ candidatId: c.id, type: 'reinitialisation', empreinte: empreinteJeton(jeton), expireLe: new Date(Date.now() + DUREE_REINITIALISATION_MS) });
    await journaliser({ ...acteur(c.id, ip), action: 'candidat.reinitialisation_email', objetType: 'candidat', objetId: c.id });
    const lien = `${env().BETTER_AUTH_URL}/candidat/reinitialiser/${jeton}`;
    await envoyerEmail({
      to: c.email,
      subject: 'Choisir un nouveau mot de passe — NEXCLEAN',
      text: `Bonjour ${c.prenom},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\nNEXCLEAN SARL`,
      html: `<p>Bonjour ${echapperHtml(c.prenom)},</p><p>Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :</p><p><a href="${echapperHtml(lien)}">Choisir un nouveau mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p><p>NEXCLEAN SARL</p>`,
    });
    return;
  }
  // Une seule demande assistée ouverte à la fois par candidat.
  await db.transaction(async (tx) => {
    const [ouverte] = await tx.select({ id: schema.candidatDemandeReinitialisation.id }).from(schema.candidatDemandeReinitialisation).where(and(eq(schema.candidatDemandeReinitialisation.candidatId, c.id), isNull(schema.candidatDemandeReinitialisation.traiteeLe)));
    if (ouverte) return;
    const [d] = await tx.insert(schema.candidatDemandeReinitialisation).values({ candidatId: c.id, ip }).returning({ id: schema.candidatDemandeReinitialisation.id });
    await journaliser({ ...acteur(c.id, ip), action: 'candidat.reinitialisation_assistee_demandee', objetType: 'candidat', objetId: c.id }, tx);
    await notifier(
      {
        destinataires: c.referentId ? [c.referentId] : await idsDirection(tx),
        type: 'reinitialisation_candidat',
        titre: `Mot de passe oublié : ${c.prenom} ${c.nom}`,
        texte: `${c.prenom} ${c.nom} (sans e-mail) demande à réinitialiser son mot de passe. Vérifiez son identité (au moins 2 informations du profil) avant de lui envoyer un lien sur WhatsApp.`,
        lien: `/admin/candidats/${c.id}`,
        cle: `reinitialisation-candidat-${d!.id}`,
        email: true,
      },
      tx,
    );
  });
}

/** Le lien de réinitialisation est-il valable ? (affichage du formulaire) */
export async function lireJetonReinitialisation(jeton: string): Promise<{ prenom: string } | null> {
  const [r] = await getDb()
    .select({ prenom: schema.candidat.prenom })
    .from(schema.candidatJeton)
    .innerJoin(schema.candidat, eq(schema.candidat.id, schema.candidatJeton.candidatId))
    .where(and(eq(schema.candidatJeton.empreinte, empreinteJeton(jeton)), isNull(schema.candidatJeton.utiliseLe), gt(schema.candidatJeton.expireLe, new Date()), isNull(schema.candidat.suppressionDemandeeLe)));
  return r ?? null;
}

/** Nouveau mot de passe à partir d'un lien à usage unique ; toutes les sessions sont fermées. */
export async function reinitialiserMotDePasse(jeton: string, motDePasse: string, ip: string | null): Promise<void> {
  const mdp = schemaMotDePasse.safeParse(motDePasse);
  if (!mdp.success) throw new ErreurMetier(mdp.error.issues[0]!.message);
  const empreinte = await hacherMotDePasse(motDePasse);
  await getDb().transaction(async (tx) => {
    const [j] = await tx
      .update(schema.candidatJeton)
      .set({ utiliseLe: new Date() })
      .where(and(eq(schema.candidatJeton.empreinte, empreinteJeton(jeton)), isNull(schema.candidatJeton.utiliseLe), gt(schema.candidatJeton.expireLe, new Date())))
      .returning({ candidatId: schema.candidatJeton.candidatId });
    if (!j) throw new ErreurMetier('Lien invalide ou expiré. Refaites une demande.');
    const [c] = await tx.select({ suppression: schema.candidat.suppressionDemandeeLe }).from(schema.candidat).where(eq(schema.candidat.id, j.candidatId));
    if (c?.suppression) throw new ErreurMetier(MESSAGE_SUPPRESSION_EN_COURS);
    await tx.update(schema.candidat).set({ motDePasse: empreinte }).where(eq(schema.candidat.id, j.candidatId));
    await tx.update(schema.candidatDemandeReinitialisation).set({ traiteeLe: new Date() }).where(and(eq(schema.candidatDemandeReinitialisation.candidatId, j.candidatId), isNull(schema.candidatDemandeReinitialisation.traiteeLe)));
    await fermerToutesLesSessions(j.candidatId, tx);
    await journaliser({ ...acteur(j.candidatId, ip), action: 'candidat.mot_de_passe_reinitialise', objetType: 'candidat', objetId: j.candidatId }, tx);
  });
}

// ─── Suppression des données (RG-15..18) ──────────────────────

export const MOTIF_RETRAIT_SUPPRESSION = 'Retrait du candidat (suppression des données)';

const jourLocal = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/**
 * RG-16 ; MVP2-03 RG-01 : les Propositions en cours passent à `retirée` (accès client révoqués),
 * les Placements encore annoncés sont abandonnés ; le référent de chaque Dossier est prévenu.
 */
async function retirerPropositionsEnCours(tx: Tx, candidatId: number, maintenant: Date): Promise<number> {
  const enCours = await tx
    .select({ id: schema.proposition.id })
    .from(schema.proposition)
    .where(and(eq(schema.proposition.candidatId, candidatId), inArray(schema.proposition.statut, [...STATUTS_EN_COURS])))
    .orderBy(asc(schema.proposition.id));
  const auteur = { type: 'candidat' as const, candidatId };
  for (const { id } of enCours) {
    const p = await chargerProposition(tx, id);
    await tx.update(schema.proposition).set({ statut: 'retiree', motif: MOTIF_RETRAIT_SUPPRESSION, accesRevoqueLe: maintenant, majLe: maintenant }).where(eq(schema.proposition.id, id));
    await tx.update(schema.accesProfil).set({ revoqueLe: maintenant }).where(and(eq(schema.accesProfil.propositionId, id), isNull(schema.accesProfil.revoqueLe)));
    const abandonnes = await tx
      .update(schema.placement)
      .set({ statut: 'abandonne', finLe: jourLocal(maintenant), finMotif: MOTIF_RETRAIT_SUPPRESSION })
      .where(and(eq(schema.placement.propositionId, id), eq(schema.placement.statut, 'annonce')))
      .returning({ id: schema.placement.id });
    await evenementDossier(tx, p.dossierId, 'proposition', `${p.libelle} : proposition retirée — ${MOTIF_RETRAIT_SUPPRESSION.toLowerCase()}${abandonnes.length ? ', placement annoncé abandonné' : ''}`, auteur, {
      propositionId: id,
      statut: 'retiree',
      placementsAbandonnes: abandonnes.map((a) => a.id),
    });
    await journaliser({ ...acteur(candidatId), action: 'proposition.retiree', objetType: 'proposition', objetId: id, avant: { statut: p.statut }, apres: { statut: 'retiree' }, details: { motif: MOTIF_RETRAIT_SUPPRESSION, placementsAbandonnes: abandonnes.map((a) => a.id) } }, tx);
    if (p.referentId) {
      await notifier(
        {
          destinataires: [p.referentId],
          type: 'proposition_retiree',
          titre: 'Proposition retirée',
          texte: `${p.libelle} (${p.numero}) : le candidat a demandé la suppression de ses données ; la proposition à ${p.client} est retirée${abandonnes.length ? ' et le placement annoncé abandonné' : ''}.`,
          lien: lienPropositionsDossier(p.dossierId),
          dossierId: p.dossierId,
          cle: `proposition_retiree_suppression:${id}`,
        },
        tx,
      );
    }
  }
  return enCours.length;
}

/** Demande de suppression : compte bloqué immédiatement, exécution différée (délai d'annulation). */
export async function demanderSuppression(candidatId: number, motDePasse: string, ip: string | null, maintenant = new Date()): Promise<{ prevueLe: Date }> {
  const db = getDb();
  const [c] = await db.select({ motDePasse: schema.candidat.motDePasse, suppression: schema.candidat.suppressionDemandeeLe }).from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c) throw new ErreurMetier('Compte introuvable.');
  if (c.suppression) throw new ErreurMetier(MESSAGE_SUPPRESSION_EN_COURS);
  if (!c.motDePasse || !(await verifierMotDePasse({ hash: c.motDePasse, password: motDePasse }))) throw new ErreurMetier('Mot de passe incorrect.');
  const prevueLe = new Date(maintenant.getTime() + JOURS_AVANT_SUPPRESSION * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.update(schema.candidat).set({ suppressionDemandeeLe: maintenant, suppressionPrevueLe: prevueLe }).where(eq(schema.candidat.id, candidatId));
    await fermerToutesLesSessions(candidatId, tx);
    await journaliser({ ...acteur(candidatId, ip), action: 'candidat.suppression_demandee', objetType: 'candidat', objetId: candidatId, details: { prevueLe: prevueLe.toISOString() } }, tx);
    await retirerPropositionsEnCours(tx, candidatId, maintenant);
  });
  return { prevueLe };
}

/**
 * RG-17 : les Propositions et Placements conservés ne doivent plus nommer la personne. Leur
 * historique dans les Dossiers (événements portant leur identifiant) et les notifications des
 * collaborateurs qui la citent reprennent le pseudonyme.
 */
async function pseudonymiserTraces(tx: Tx, candidatId: number, prenom: string, nom: string): Promise<void> {
  if (!prenom.trim() && !nom.trim()) return;
  const pseudo = pseudonyme(candidatId);
  const formes = [...new Set([`${prenom} ${nom}`.trim(), nomAffichable(prenom, nom)])].filter((f) => f.length > 2);
  const remplacer = (col: AnyPgColumn) => formes.reduce<SQL>((acc, f) => sql`replace(${acc}, ${f}, ${pseudo})`, sql`${col}`);
  const propositions = await tx.select({ id: schema.proposition.id, dossierId: schema.proposition.dossierId }).from(schema.proposition).where(eq(schema.proposition.candidatId, candidatId));
  const placements = await tx.select({ id: schema.placement.id }).from(schema.placement).where(eq(schema.placement.candidatId, candidatId));
  const e = schema.evenementDossier;
  const n = schema.notification;
  const ids = (l: { id: number }[]) => l.map((x) => String(x.id));
  if (propositions.length || placements.length) {
    const lies = [
      ...(propositions.length ? [inArray(sql<string>`${e.apres}->>'propositionId'`, ids(propositions))] : []),
      ...(placements.length ? [inArray(sql<string>`${e.apres}->>'placementId'`, ids(placements))] : []),
    ];
    await tx.update(e).set({ commentaire: remplacer(e.commentaire) }).where(or(...lies));
  }
  const dossiers = [...new Set(propositions.map((x) => x.dossierId))];
  await tx
    .update(n)
    .set({ titre: remplacer(n.titre), texte: remplacer(n.texte) })
    .where(or(eq(n.lien, lienFicheCandidat(candidatId)), dossiers.length ? inArray(n.dossierId, dossiers) : undefined));
}

/**
 * Exécute les suppressions arrivées à échéance (tâche planifiée). Profil, expériences, documents,
 * consentements, sessions, jetons et notifications du candidat sont supprimés ; il ne reste qu'un
 * pseudonyme (« Candidat #8F3A ») pour les Propositions et Placements conservés (MVP2-03, cas
 * limites). Les captures d'accord WhatsApp et preuves de placement sont des pièces de preuve
 * conservées ; ni les Propositions ni les Placements ne recopient de coordonnées du candidat.
 * Le journal d'audit est conservé.
 */
export async function executerSuppressionsDues(maintenant = new Date()): Promise<number> {
  const db = getDb();
  const dus = await db
    .select({ id: schema.candidat.id, email: schema.candidat.email, prenom: schema.candidat.prenom, nom: schema.candidat.nom })
    .from(schema.candidat)
    .where(and(lte(schema.candidat.suppressionPrevueLe, maintenant), isNull(schema.candidat.supprimeLe)));
  for (const c of dus) {
    const documents = await db.select({ cle: schema.candidatDocument.cle }).from(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, c.id));
    await db.transaction(async (tx) => {
      await tx.delete(schema.candidatDocument).where(eq(schema.candidatDocument.candidatId, c.id));
      await tx.delete(schema.candidatExperience).where(eq(schema.candidatExperience.candidatId, c.id));
      await tx.delete(schema.candidatConsentement).where(eq(schema.candidatConsentement.candidatId, c.id));
      await tx.delete(schema.candidatSession).where(eq(schema.candidatSession.candidatId, c.id));
      await tx.delete(schema.candidatJeton).where(eq(schema.candidatJeton.candidatId, c.id));
      await tx.delete(schema.candidatDemandeReinitialisation).where(eq(schema.candidatDemandeReinitialisation.candidatId, c.id));
      // RG-17 : les Candidatures sont supprimées (MVP2-02).
      await tx.delete(schema.candidature).where(eq(schema.candidature.candidatId, c.id));
      await tx.delete(schema.notificationCandidat).where(eq(schema.notificationCandidat.candidatId, c.id));
      await pseudonymiserTraces(tx, c.id, c.prenom, c.nom);
      await tx
        .update(schema.candidat)
        .set({
          telephone: null,
          whatsapp: null,
          email: null,
          nom: pseudonyme(c.id),
          prenom: '',
          villeAutre: null,
          arrondissementId: null,
          quartierId: null,
          quartierAutre: null,
          repere: null,
          zonesTouteVille: false,
          zonesArrondissementIds: [],
          zonesQuartierIds: [],
          metiers: [],
          secteurs: [],
          typesContrat: [],
          salaireMin: null,
          salaireMax: null,
          niveauEtudes: null,
          qualifications: null,
          competences: [],
          disponibilite: null,
          disponibleLe: null,
          preavis: null,
          horaires: [],
          statut: 'indisponible',
          statutAvantIndisponible: null,
          motDePasse: null,
          supprimeLe: maintenant,
        })
        .where(eq(schema.candidat.id, c.id));
      await journaliser({ acteurType: 'systeme', action: 'candidat.donnees_supprimees', objetType: 'candidat', objetId: c.id, details: { documents: documents.length } }, tx);
    });
    for (const d of documents) await getStockage().supprimer(d.cle);
    // RG-18 : e-mail à l'exécution si une adresse existait (lue avant l'effacement).
    if (c.email) {
      await envoyerEmail({
        to: c.email,
        subject: 'Vos données ont été supprimées — NEXCLEAN',
        text: `Bonjour ${c.prenom},\n\nComme vous l'avez demandé, votre compte candidat NEXCLEAN et vos données (profil, CV, justificatifs) ont été supprimés. Les copies de sauvegarde sont effacées sous 30 jours.\n\nNEXCLEAN SARL`,
        html: `<p>Bonjour ${echapperHtml(c.prenom)},</p><p>Comme vous l'avez demandé, votre compte candidat NEXCLEAN et vos données (profil, CV, justificatifs) ont été supprimés. Les copies de sauvegarde sont effacées sous 30 jours.</p><p>NEXCLEAN SARL</p>`,
      }).catch(() => {});
    }
  }
  return dus.length;
}
