// Candidatures aux offres (MVP2-02 RG-07..12) : création (candidat connecté, ou compte léger créé
// par le formulaire court), attribution au responsable de l'offre, notification interne, liste du
// Back-Office et traitement (reçue → retenue / refusée), responsables des offres.
// Remplace l'ancien envoi par e-mail avec CV et le webhook Google Sheet (ADR 0022).
import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { peut } from '@/lib/authz/permissions';
import { hacherMotDePasse } from '@/lib/auth/mot-de-passe';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { choisirReferent, evaluerCandidats } from '@/lib/dossiers/attribution';
import { validerFichier } from '@/lib/fichiers/validation';
import { idsDirection, notifier } from '@/lib/notifications';
import { getJobBySlug, jobs } from '@/content/jobs-data';
import { peutAccederVivier, type DemandeurVivier } from './acces';
import { attribuerCandidat } from './attribution';
import { CONSENTEMENTS, schemaMotDePasse, type TypeConsentement } from './domaine';
import {
  MESSAGE_DEJA_POSTULE,
  SANS_EXPERIENCE,
  choisirResponsable,
  refusOffre,
  schemaMotivation,
  transitionCandidaturePermise,
  validerCandidatureCourte,
  type BrouillonCandidature,
  type StatutCandidature,
} from './formulaire-candidature';
import { MESSAGE_DEJA_INSCRIT, ajouterDocument } from './service';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const TAILLE_PAGE_CANDIDATURES = 20;
const TYPES_CV = ['pdf', 'docx', 'jpeg', 'png'];

export const lienCandidaturesOffre = (slug: string) => `/admin/candidatures?offre=${encodeURIComponent(slug)}`;

/** Offre ouverte de `content/jobs-data.ts`, ou ErreurMetier (inconnue, pourvue). */
function offreOuverte(slug: string) {
  const offre = getJobBySlug(slug);
  const refus = refusOffre(offre);
  if (refus) throw new ErreurMetier(refus);
  return offre!;
}

// ─── Attribution et création (RG-08, RG-10) ───────────────────

/** Responsables actifs d'une offre, avec leur charge (candidatures reçues non traitées). */
async function responsablesOffre(tx: Tx | Db, slug: string) {
  const r = await tx
    .select({ id: schema.offreResponsable.userId, designeLe: schema.offreResponsable.creeLe })
    .from(schema.offreResponsable)
    .innerJoin(schema.user, eq(schema.user.id, schema.offreResponsable.userId))
    .where(and(eq(schema.offreResponsable.offreSlug, slug), eq(schema.user.active, true)));
  if (!r.length) return [];
  const charges = await tx
    .select({ id: schema.candidature.referentId, n: count() })
    .from(schema.candidature)
    .where(and(inArray(schema.candidature.referentId, r.map((x) => x.id)), eq(schema.candidature.statut, 'recue')))
    .groupBy(schema.candidature.referentId);
  return r.map((x) => ({ ...x, charge: charges.find((c) => c.id === x.id)?.n ?? 0 }));
}

/**
 * Crée la Candidature dans la transaction de l'appelant : unicité (RG-12), attribution (RG-10),
 * journal, notification interne in-app + e-mail sans pièce jointe ni CV (RG-11).
 */
async function creerCandidature(tx: Tx, candidatId: number, offre: { slug: string; title: string }, motivation: string | null, ip: string | null, maintenant: Date) {
  const [c] = await tx
    .select({ nom: schema.candidat.nom, prenom: schema.candidat.prenom, referentId: schema.candidat.referentId, villeId: schema.candidat.villeId, compteLeger: schema.candidat.compteLeger })
    .from(schema.candidat)
    .where(eq(schema.candidat.id, candidatId));
  if (!c) throw new ErreurMetier('Compte introuvable.');

  const responsables = await responsablesOffre(tx, offre.slug);
  const parVille = !responsables.length && !c.referentId ? choisirReferent(await evaluerCandidats(tx, { type: 'REC', villeId: c.villeId }, maintenant), null)?.id ?? null : null;
  const choix = choisirResponsable(responsables, c.referentId, parVille);

  const [cree] = await tx
    .insert(schema.candidature)
    .values({ candidatId, offreSlug: offre.slug, offreTitre: offre.title, motivation, referentId: choix.referentId, creeLe: maintenant })
    .onConflictDoNothing()
    .returning({ id: schema.candidature.id });
  // RG-12 : l'index unique candidat + offre tranche, y compris entre deux envois simultanés.
  if (!cree) throw new ErreurMetier(MESSAGE_DEJA_POSTULE);

  await journaliser(
    { acteurType: 'candidat', acteurId: String(candidatId), ip, action: 'candidature.creee', objetType: 'candidature', objetId: cree.id, apres: { offre: offre.slug, referentId: choix.referentId, regle: choix.regle } },
    tx,
  );
  const ligne = `${c.prenom} ${c.nom} a postulé à « ${offre.title} »${c.compteLeger ? ' (nouveau compte, profil à compléter)' : ''}.`;
  if (choix.referentId) {
    await notifier({ destinataires: [choix.referentId], type: 'candidature_recue', titre: 'Nouvelle candidature', texte: `${ligne}\nRègle d’attribution : ${choix.regle}.`, lien: lienCandidaturesOffre(offre.slug), cle: `candidature:${cree.id}`, email: true }, tx);
  } else {
    await notifier(
      { destinataires: await idsDirection(tx), type: 'candidature_non_attribuee', titre: 'Candidature non attribuée', texte: `${ligne}\nAucun responsable ni référent recrutement éligible : à attribuer.`, lien: lienCandidaturesOffre(offre.slug), cle: `candidature:${cree.id}`, email: true },
      tx,
    );
  }
  return { candidatureId: cree.id, referentId: choix.referentId };
}

/** RG-07 : candidat connecté — bouton « Postuler », motivation facultative. */
export async function postuler(candidatId: number, slug: string, motivationSaisie: unknown, ip: string | null, maintenant = new Date()) {
  const offre = offreOuverte(slug);
  const motivation = schemaMotivation.parse(typeof motivationSaisie === 'string' ? motivationSaisie : '');
  return getDb().transaction(async (tx) => {
    const [c] = await tx.select({ suppression: schema.candidat.suppressionDemandeeLe }).from(schema.candidat).where(eq(schema.candidat.id, candidatId)).for('update');
    if (!c || c.suppression) throw new ErreurMetier('Compte introuvable.');
    return creerCandidature(tx, candidatId, offre, motivation, ip, maintenant);
  });
}

export interface FichierCv {
  nom: string;
  octets: Uint8Array;
}

/** Contrôle du CV facultatif (type réel par signature, 5 Mo) avant toute création de compte. */
export function controlerCv(cv: FichierCv | null): string | null {
  if (!cv) return null;
  const v = validerFichier(cv.nom, cv.octets);
  if (!v.ok) return v.erreur;
  if (!TYPES_CV.includes(v.type)) return 'Formats acceptés : PDF, DOCX, JPEG ou PNG.';
  return null;
}

/**
 * RG-07 : visiteur non inscrit — formulaire court. Crée un compte candidat léger (profil incomplet,
 * consentements tracés, attribué comme toute inscription : RG-01) et la Candidature, dans une seule
 * transaction ; le CV facultatif est enregistré ensuite. Un numéro déjà inscrit est refusé avec le
 * message de l'inscription MVP2-01 (RG-04), sans autre information.
 */
export async function postulerAvecCompteLeger(
  brouillon: BrouillonCandidature,
  motDePasse: string,
  slug: string,
  cv: FichierCv | null,
  contexte: { ip: string | null },
  maintenant = new Date(),
): Promise<{ candidatId: number; candidatureId: number; cvEnregistre: boolean; erreurCv?: string }> {
  const offre = offreOuverte(slug);
  const v = validerCandidatureCourte(brouillon);
  if (!v.ok) throw new ErreurMetier(Object.values(v.erreurs)[0] ?? 'Formulaire incomplet.');
  const mdp = schemaMotDePasse.safeParse(motDePasse);
  if (!mdp.success) throw new ErreurMetier(mdp.error.issues[0]!.message);
  const refusCv = controlerCv(cv);
  if (refusCv) throw new ErreurMetier(`CV : ${refusCv}`);

  const d = v.donnees;
  const empreinte = await hacherMotDePasse(motDePasse);
  const r = await getDb().transaction(async (tx) => {
    const [existant] = await tx.select({ id: schema.candidat.id }).from(schema.candidat).where(eq(schema.candidat.telephone, d.telephone));
    if (existant) throw new ErreurMetier(MESSAGE_DEJA_INSCRIT);
    // Le quartier choisi doit appartenir à la ville ; son arrondissement en est déduit.
    let arrondissementId: number | null = null;
    if (d.quartierId) {
      const [q] = await tx.select({ villeId: schema.quartier.villeId, arrondissementId: schema.quartier.arrondissementId }).from(schema.quartier).where(eq(schema.quartier.id, d.quartierId));
      if (!q || q.villeId !== d.villeId) throw new ErreurMetier('Quartier inconnu pour cette ville.');
      arrondissementId = q.arrondissementId;
    }
    const [c] = await tx
      .insert(schema.candidat)
      .values({
        nom: d.nom,
        prenom: d.prenom,
        telephone: d.telephone,
        whatsapp: d.telephone,
        villeId: d.villeId,
        villeAutre: d.villeAutre,
        arrondissementId,
        quartierId: d.quartierId,
        quartierAutre: d.quartierAutre,
        metiers: [d.metier],
        disponibilite: d.disponibilite,
        disponibleLe: d.disponibleLe,
        preavis: d.preavis,
        compteLeger: true,
        motDePasse: empreinte,
        canalInscription: 'site',
        creeLe: maintenant,
      })
      .onConflictDoNothing()
      .returning({ id: schema.candidat.id });
    if (!c) throw new ErreurMetier(MESSAGE_DEJA_INSCRIT);
    if (d.experience !== SANS_EXPERIENCE) {
      await tx.insert(schema.candidatExperience).values({ candidatId: c.id, ordre: 1, poste: d.metier, duree: d.experience });
    }
    await tx.insert(schema.candidatConsentement).values(
      (Object.keys(CONSENTEMENTS) as TypeConsentement[]).map((type) => ({ candidatId: c.id, type, version: CONSENTEMENTS[type].version, canal: 'site' as const, ip: contexte.ip })),
    );
    await journaliser({ acteurType: 'candidat', acteurId: String(c.id), ip: contexte.ip, action: 'candidat.inscrit', objetType: 'candidat', objetId: c.id, details: { canal: 'site', compteLeger: true, offre: offre.slug } }, tx);
    // RG-01 : file « Nouveaux candidats » du référent recrutement de sa ville.
    await attribuerCandidat(tx, c.id, maintenant);
    const { candidatureId } = await creerCandidature(tx, c.id, offre, d.motivation, contexte.ip, maintenant);
    return { candidatId: c.id, candidatureId };
  });

  if (!cv) return { ...r, cvEnregistre: false };
  try {
    await ajouterDocument(r.candidatId, 'cv', cv.nom, cv.octets, contexte.ip);
    return { ...r, cvEnregistre: true };
  } catch (e) {
    console.error('Candidature : CV non enregistré', e);
    return { ...r, cvEnregistre: false, erreurCv: e instanceof ErreurMetier ? e.message : 'CV non enregistré.' };
  }
}

// ─── Espace candidat ──────────────────────────────────────────

/** A-t-il déjà postulé à cette offre ? (affichage de la fiche d'offre) */
export async function aDejaPostule(candidatId: number, slug: string): Promise<boolean> {
  const [r] = await getDb()
    .select({ id: schema.candidature.id })
    .from(schema.candidature)
    .where(and(eq(schema.candidature.candidatId, candidatId), eq(schema.candidature.offreSlug, slug)));
  return !!r;
}

/** Candidatures du candidat et état « compte léger » (tableau de bord, MVP2-01 RG-09). */
export async function lireCandidaturesCandidat(candidatId: number) {
  const db = getDb();
  const [[c], candidatures] = await Promise.all([
    db.select({ compteLeger: schema.candidat.compteLeger }).from(schema.candidat).where(eq(schema.candidat.id, candidatId)),
    db
      .select({ id: schema.candidature.id, offreSlug: schema.candidature.offreSlug, offreTitre: schema.candidature.offreTitre, statut: schema.candidature.statut, creeLe: schema.candidature.creeLe })
      .from(schema.candidature)
      .where(eq(schema.candidature.candidatId, candidatId))
      .orderBy(desc(schema.candidature.creeLe)),
  ]);
  return { profilIncomplet: !!c?.compteLeger, candidatures };
}

/** Le profil complet a été enregistré (validation MVP2-01 passée) : le compte n'est plus « léger ». */
export async function marquerProfilComplet(candidatId: number, ip: string | null): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [r] = await tx
      .update(schema.candidat)
      .set({ compteLeger: false })
      .where(and(eq(schema.candidat.id, candidatId), eq(schema.candidat.compteLeger, true)))
      .returning({ id: schema.candidat.id });
    if (r) await journaliser({ acteurType: 'candidat', acteurId: String(candidatId), ip, action: 'candidat.profil_complete', objetType: 'candidat', objetId: candidatId }, tx);
  });
}

// ─── Back-Office : liste et traitement (RG-09, RG-10) ─────────

export interface ActeurCandidatures extends DemandeurVivier {
  ip?: string | null;
}

export interface FiltresCandidatures {
  offre?: string;
  statut?: StatutCandidature;
  /** Direction : « aucune » = non attribuées, « moi » = les siennes. */
  attribution?: 'aucune' | 'moi';
  page?: number;
}

/** Un Référent voit les candidatures qui lui sont attribuées ; la Direction toutes (+ non attribuées). */
export async function listerCandidatures(a: ActeurCandidatures, f: FiltresCandidatures) {
  if (!(await peutAccederVivier(a))) throw new ErreurMetier('Accès réservé aux référents recrutement et à la Direction.');
  const direction = a.roles.includes('direction');
  const k = schema.candidature;
  const conditions: SQL[] = [isNull(schema.candidat.supprimeLe)];
  if (!direction) conditions.push(eq(k.referentId, a.id));
  else if (f.attribution === 'aucune') conditions.push(isNull(k.referentId));
  else if (f.attribution === 'moi') conditions.push(eq(k.referentId, a.id));
  if (f.offre) conditions.push(eq(k.offreSlug, f.offre));
  if (f.statut) conditions.push(eq(k.statut, f.statut));
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const lignes = await getDb()
    .select({
      id: k.id,
      offreSlug: k.offreSlug,
      offreTitre: k.offreTitre,
      motivation: k.motivation,
      statut: k.statut,
      creeLe: k.creeLe,
      traiteeLe: k.traiteeLe,
      referentId: k.referentId,
      referentNom: schema.user.name,
      candidatId: schema.candidat.id,
      nom: schema.candidat.nom,
      prenom: schema.candidat.prenom,
      telephone: schema.candidat.telephone,
      compteLeger: schema.candidat.compteLeger,
      ville: sql<string | null>`coalesce(${schema.ville.nom}, ${schema.candidat.villeAutre})`,
      quartier: sql<string | null>`coalesce(${schema.quartier.nom}, ${schema.candidat.quartierAutre})`,
    })
    .from(k)
    .innerJoin(schema.candidat, eq(schema.candidat.id, k.candidatId))
    .leftJoin(schema.user, eq(schema.user.id, k.referentId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.candidat.villeId))
    .leftJoin(schema.quartier, eq(schema.quartier.id, schema.candidat.quartierId))
    .where(and(...conditions))
    .orderBy(desc(k.creeLe), desc(k.id))
    .limit(TAILLE_PAGE_CANDIDATURES + 1)
    .offset((page - 1) * TAILLE_PAGE_CANDIDATURES);
  return { lignes: lignes.slice(0, TAILLE_PAGE_CANDIDATURES), suivante: lignes.length > TAILLE_PAGE_CANDIDATURES, page, direction };
}

/**
 * RG-09 : reçue → retenue / refusée, journalisé. Un Référent ne traite que ses candidatures ; la
 * Direction toutes. « Retenue » ne crée rien en MVP2-02 (la Proposition viendra avec MVP2-03).
 */
export async function changerStatutCandidature(candidatureId: number, vers: StatutCandidature, a: ActeurCandidatures, maintenant = new Date()): Promise<void> {
  if (!(await peutAccederVivier(a, 'candidat.traiter'))) throw new ErreurMetier('Accès réservé aux référents recrutement et à la Direction.');
  await getDb().transaction(async (tx) => {
    const [k] = await tx.select({ statut: schema.candidature.statut, referentId: schema.candidature.referentId }).from(schema.candidature).where(eq(schema.candidature.id, candidatureId)).for('update');
    if (!k) throw new ErreurMetier('Candidature introuvable.');
    if (!a.roles.includes('direction') && k.referentId !== a.id) throw new ErreurMetier('Cette candidature est suivie par un autre référent.');
    if (!transitionCandidaturePermise(k.statut, vers)) throw new ErreurMetier(k.statut === 'recue' ? 'Statut inconnu.' : 'Cette candidature a déjà été traitée.');
    await tx.update(schema.candidature).set({ statut: vers, traiteeLe: maintenant, traiteePar: a.id }).where(eq(schema.candidature.id, candidatureId));
    await journaliser(
      { acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'candidature.statut_modifie', objetType: 'candidature', objetId: candidatureId, avant: { statut: k.statut }, apres: { statut: vers } },
      tx,
    );
  });
}

// ─── Responsables des offres (RG-10, Direction) ───────────────

/** Collaborateurs pouvant suivre une offre : actifs, Direction ou Référent avec le service Recrutement. */
export async function collaborateursEligiblesOffre(): Promise<{ id: string; nom: string }[]> {
  const db = getDb();
  const [direction, recrutement] = await Promise.all([
    db
      .selectDistinct({ id: schema.user.id, nom: schema.user.name })
      .from(schema.user)
      .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
      .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'direction'))),
    db
      .selectDistinct({ id: schema.user.id, nom: schema.user.name })
      .from(schema.user)
      .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
      .innerJoin(schema.collaborateurService, eq(schema.collaborateurService.userId, schema.user.id))
      .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'referent'), eq(schema.collaborateurService.typeDossier, 'REC'))),
  ]);
  const tous = new Map([...direction, ...recrutement].map((u) => [u.id, u]));
  return [...tous.values()].sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
}

/** Responsables désignés, par offre (slug → collaborateurs, dans l'ordre de désignation). */
export async function lireResponsablesOffres(): Promise<Record<string, { id: string; nom: string; actif: boolean }[]>> {
  const r = await getDb()
    .select({ slug: schema.offreResponsable.offreSlug, id: schema.user.id, nom: schema.user.name, actif: schema.user.active })
    .from(schema.offreResponsable)
    .innerJoin(schema.user, eq(schema.user.id, schema.offreResponsable.userId))
    .orderBy(asc(schema.offreResponsable.creeLe), asc(schema.user.name));
  const parOffre: Record<string, { id: string; nom: string; actif: boolean }[]> = {};
  for (const x of r) (parOffre[x.slug] ??= []).push({ id: x.id, nom: x.nom, actif: x.actif });
  return parOffre;
}

/** Désigne les responsables d'une offre (remplace la liste), journalisé. Réservé à la Direction. */
export async function definirResponsablesOffre(slug: string, userIds: string[], a: ActeurCandidatures): Promise<void> {
  if (!peut(a.roles, 'offre.responsables')) throw new ErreurMetier('Réservé à la Direction.');
  if (!jobs.some((j) => j.slug === slug)) throw new ErreurMetier('Offre inconnue.');
  const ids = [...new Set(userIds)];
  const eligibles = new Set((await collaborateursEligiblesOffre()).map((u) => u.id));
  if (ids.some((id) => !eligibles.has(id))) throw new ErreurMetier('Seuls la Direction et les référents ayant le service Recrutement peuvent suivre une offre.');
  await getDb().transaction(async (tx) => {
    const avant = (await tx.select({ id: schema.offreResponsable.userId }).from(schema.offreResponsable).where(eq(schema.offreResponsable.offreSlug, slug)).orderBy(asc(schema.offreResponsable.creeLe))).map((x) => x.id);
    if (avant.length === ids.length && avant.every((x) => ids.includes(x))) return;
    const retires = avant.filter((x) => !ids.includes(x));
    if (retires.length) await tx.delete(schema.offreResponsable).where(and(eq(schema.offreResponsable.offreSlug, slug), inArray(schema.offreResponsable.userId, retires)));
    const ajoutes = ids.filter((x) => !avant.includes(x));
    // Ordre de désignation conservé pour les responsables maintenus (départage à charge égale).
    const base = Date.now();
    if (ajoutes.length) await tx.insert(schema.offreResponsable).values(ajoutes.map((userId, i) => ({ offreSlug: slug, userId, creeLe: new Date(base + i) })));
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'offre.responsables_modifies', objetType: 'offre', objetId: slug, avant: { responsables: avant }, apres: { responsables: ids } }, tx);
  });
}
