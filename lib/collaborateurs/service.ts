// Gestion des comptes collaborateurs (M1-AUT-03, 04, 09 ; M1-ROL-02, 05).
// Fonctions métier sans dépendance à Next.js : utilisées par les actions serveur,
// le script d'initialisation et les tests d'intégration.
import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { echapperHtml, envoyerEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { hacherMotDePasse, LONGUEUR_MIN_COLLABORATEUR } from '@/lib/auth/mot-de-passe';
import { DOSSIER_TYPE_CODES, ROLE_CODES, type DossierType, type Role } from '@/lib/domain/referentiels';
import { DUREE_ACTIVATION_MS, empreinteJeton, genererJeton } from './jetons';

export class ErreurMetier extends Error {}

/** Auteur d'une action (collaborateur connecté, ou système pour le script d'initialisation). */
export interface Auteur {
  id: string | null;
  ip?: string | null;
}

const auteurAudit = (a: Auteur) => ({ acteurType: a.id ? ('collaborateur' as const) : ('systeme' as const), acteurId: a.id, ip: a.ip ?? null });

export const schemaNouveauCollaborateur = z.object({
  nom: z.string().trim().min(2, 'Nom trop court').max(80),
  email: z.string().trim().toLowerCase().email('E-mail invalide'),
  roles: z.array(z.enum(ROLE_CODES)).min(1, 'Au moins un rôle'),
});

export type NouveauCollaborateur = z.infer<typeof schemaNouveauCollaborateur>;

/**
 * Crée un compte sans mot de passe et renvoie le lien d'activation (48 h).
 * Le lien est aussi envoyé par e-mail.
 */
export async function creerCollaborateur(donnees: NouveauCollaborateur, auteur: Auteur): Promise<{ userId: string; lienActivation: string }> {
  const d = schemaNouveauCollaborateur.parse(donnees);
  const db = getDb();
  const userId = randomUUID();
  const jeton = genererJeton();

  await db.transaction(async (tx) => {
    const [existant] = await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, d.email));
    if (existant) throw new ErreurMetier('Un compte existe déjà avec cet e-mail.');
    await tx.insert(schema.user).values({ id: userId, name: d.nom, email: d.email, emailVerified: false, active: true });
    await tx.insert(schema.collaborateurRole).values(d.roles.map((role) => ({ userId, role })));
    await tx.insert(schema.collaborateurProfil).values({ userId });
    await tx.insert(schema.jetonActivation).values({ userId, empreinte: empreinteJeton(jeton), expireLe: new Date(Date.now() + DUREE_ACTIVATION_MS) });
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.cree', objetType: 'user', objetId: userId, apres: { nom: d.nom, email: d.email, roles: d.roles } }, tx);
  });

  const lienActivation = `${env().BETTER_AUTH_URL}/admin/activation/${jeton}`;
  await envoyerEmail({
    to: d.email,
    subject: 'Activez votre compte NEXCLEAN Back-Office',
    text: `Bonjour ${d.nom},\n\nUn compte a été créé pour vous sur le Back-Office NEXCLEAN.\nChoisissez votre mot de passe avec ce lien (valable 48 heures) :\n${lienActivation}`,
    html: `<p>Bonjour ${echapperHtml(d.nom)},</p><p>Un compte a été créé pour vous sur le Back-Office NEXCLEAN.</p><p><a href="${lienActivation}">Choisir mon mot de passe</a> (lien valable 48 heures)</p>`,
  });
  return { userId, lienActivation };
}

/** Nouveau lien d'activation (l'ancien reste invalide s'il a expiré ; les autres non utilisés sont révoqués). */
export async function regenererActivation(userId: string, auteur: Auteur): Promise<string> {
  const db = getDb();
  const jeton = genererJeton();
  const [u] = await db.select({ name: schema.user.name, email: schema.user.email }).from(schema.user).where(eq(schema.user.id, userId));
  if (!u) throw new ErreurMetier('Collaborateur introuvable.');
  await db.transaction(async (tx) => {
    await tx.update(schema.jetonActivation).set({ expireLe: new Date() }).where(and(eq(schema.jetonActivation.userId, userId), isNull(schema.jetonActivation.utiliseLe)));
    await tx.insert(schema.jetonActivation).values({ userId, empreinte: empreinteJeton(jeton), expireLe: new Date(Date.now() + DUREE_ACTIVATION_MS) });
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.activation_regeneree', objetType: 'user', objetId: userId }, tx);
  });
  const lien = `${env().BETTER_AUTH_URL}/admin/activation/${jeton}`;
  await envoyerEmail({
    to: u.email,
    subject: 'Votre lien d’activation NEXCLEAN Back-Office',
    text: `Bonjour ${u.name},\n\nVoici votre nouveau lien d'activation (valable 48 heures) :\n${lien}`,
    html: `<p>Bonjour ${echapperHtml(u.name)},</p><p><a href="${lien}">Choisir mon mot de passe</a> (lien valable 48 heures)</p>`,
  });
  return lien;
}

/** Vérifie qu'un jeton d'activation est valide ; renvoie le compte concerné. */
export async function lireActivation(jeton: string) {
  const [ligne] = await getDb()
    .select({ id: schema.jetonActivation.id, userId: schema.jetonActivation.userId, nom: schema.user.name, email: schema.user.email })
    .from(schema.jetonActivation)
    .innerJoin(schema.user, eq(schema.user.id, schema.jetonActivation.userId))
    .where(and(eq(schema.jetonActivation.empreinte, empreinteJeton(jeton)), isNull(schema.jetonActivation.utiliseLe), gt(schema.jetonActivation.expireLe, new Date()), eq(schema.user.active, true)));
  return ligne ?? null;
}

/** Définit le mot de passe initial et consomme le jeton (usage unique). */
export async function activerCompte(jeton: string, motDePasse: string, ip?: string | null): Promise<void> {
  if (motDePasse.length < LONGUEUR_MIN_COLLABORATEUR) throw new ErreurMetier(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_COLLABORATEUR} caractères.`);
  const activation = await lireActivation(jeton);
  if (!activation) throw new ErreurMetier('Lien invalide ou expiré.');
  const empreinte = await hacherMotDePasse(motDePasse);
  await getDb().transaction(async (tx) => {
    // Consommation atomique : un second appel concurrent ne trouve plus de jeton libre.
    const consommes = await tx
      .update(schema.jetonActivation)
      .set({ utiliseLe: new Date() })
      .where(and(eq(schema.jetonActivation.id, activation.id), isNull(schema.jetonActivation.utiliseLe)))
      .returning({ id: schema.jetonActivation.id });
    if (consommes.length === 0) throw new ErreurMetier('Lien invalide ou expiré.');
    const [compte] = await tx.select({ id: schema.account.id }).from(schema.account).where(and(eq(schema.account.userId, activation.userId), eq(schema.account.providerId, 'credential')));
    if (compte) {
      await tx.update(schema.account).set({ password: empreinte, updatedAt: new Date() }).where(eq(schema.account.id, compte.id));
    } else {
      await tx.insert(schema.account).values({ id: randomUUID(), accountId: activation.userId, providerId: 'credential', userId: activation.userId, password: empreinte });
    }
    await tx.update(schema.user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(schema.user.id, activation.userId));
    await journaliser({ acteurType: 'collaborateur', acteurId: activation.userId, action: 'collaborateur.active', objetType: 'user', objetId: activation.userId, ip: ip ?? null }, tx);
  });
}

async function nombreAdminsActifs(tx: Pick<ReturnType<typeof getDb>, 'select'>, saufUserId?: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(distinct ${schema.user.id})`.mapWith(Number) })
    .from(schema.user)
    .innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id))
    .where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'admin'), saufUserId ? ne(schema.user.id, saufUserId) : undefined));
  return r?.n ?? 0;
}

async function estAdmin(tx: Pick<ReturnType<typeof getDb>, 'select'>, userId: string): Promise<boolean> {
  const r = await tx.select().from(schema.collaborateurRole).where(and(eq(schema.collaborateurRole.userId, userId), eq(schema.collaborateurRole.role, 'admin')));
  return r.length > 0;
}

/** M1-AUT-04 : désactivation (jamais de suppression) et révocation immédiate des sessions. */
export async function desactiverCollaborateur(userId: string, auteur: Auteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    // Verrou de ligne pour sérialiser les désactivations concurrentes d'administrateurs.
    await tx.execute(sql`select id from ${schema.user} where ${schema.user.id} = ${userId} for update`);
    if ((await estAdmin(tx, userId)) && (await nombreAdminsActifs(tx, userId)) === 0) {
      throw new ErreurMetier('Impossible de désactiver le dernier administrateur actif.');
    }
    const maj = await tx.update(schema.user).set({ active: false, updatedAt: new Date() }).where(and(eq(schema.user.id, userId), eq(schema.user.active, true))).returning({ id: schema.user.id });
    if (maj.length === 0) throw new ErreurMetier('Collaborateur introuvable ou déjà désactivé.');
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
    // MVP1-05 : ses dossiers ouverts retournent en « Non attribués », la Direction est prévenue.
    const { libererDossiersDe } = await import('@/lib/dossiers/attribution');
    const liberes = await libererDossiersDe(tx, userId, auteur.id);
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.desactive', objetType: 'user', objetId: userId, details: liberes ? { dossiersLiberes: liberes } : undefined }, tx);
  });
  const { declencherEnvoi } = await import('@/lib/notifications');
  declencherEnvoi();
}

export async function reactiverCollaborateur(userId: string, auteur: Auteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    const maj = await tx.update(schema.user).set({ active: true, updatedAt: new Date() }).where(and(eq(schema.user.id, userId), eq(schema.user.active, false))).returning({ id: schema.user.id });
    if (maj.length === 0) throw new ErreurMetier('Collaborateur introuvable ou déjà actif.');
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.reactive', objetType: 'user', objetId: userId }, tx);
  });
}

/** M1-ROL-05 : remplacement des rôles, journalisé avant / après. */
export async function definirRoles(userId: string, roles: Role[], auteur: Auteur): Promise<void> {
  const nouveaux = z.array(z.enum(ROLE_CODES)).min(1, 'Au moins un rôle').parse([...new Set(roles)]);
  await getDb().transaction(async (tx) => {
    const avant = (await tx.select({ role: schema.collaborateurRole.role }).from(schema.collaborateurRole).where(eq(schema.collaborateurRole.userId, userId))).map((r) => r.role);
    if (avant.includes('admin') && !nouveaux.includes('admin') && (await nombreAdminsActifs(tx, userId)) === 0) {
      throw new ErreurMetier('Impossible de retirer le rôle Administrateur au dernier administrateur actif.');
    }
    await tx.delete(schema.collaborateurRole).where(eq(schema.collaborateurRole.userId, userId));
    await tx.insert(schema.collaborateurRole).values(nouveaux.map((role) => ({ userId, role })));
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.roles_modifies', objetType: 'user', objetId: userId, avant, apres: nouveaux }, tx);
  });
}

export const schemaAttributs = z
  .object({
    services: z.array(z.enum(DOSSIER_TYPE_CODES)),
    villeIds: z.array(z.number().int().positive()),
    telephone: z.string().trim().max(30).nullable(),
    capacite: z.number().int().min(1).max(500).nullable(),
    absentDu: z.string().date().nullable(),
    absentAu: z.string().date().nullable(),
  })
  .refine((a) => !a.absentDu || !a.absentAu || a.absentDu <= a.absentAu, { message: 'La fin d’absence précède le début.', path: ['absentAu'] })
  .refine((a) => !a.absentDu === !a.absentAu, { message: 'Indiquez le début et la fin de l’absence.', path: ['absentAu'] });

export type Attributs = z.infer<typeof schemaAttributs>;

export async function lireAttributs(userId: string): Promise<Attributs> {
  const db = getDb();
  const [profil] = await db.select().from(schema.collaborateurProfil).where(eq(schema.collaborateurProfil.userId, userId));
  const services = (await db.select({ t: schema.collaborateurService.typeDossier }).from(schema.collaborateurService).where(eq(schema.collaborateurService.userId, userId))).map((r) => r.t as DossierType);
  const villeIds = (await db.select({ v: schema.collaborateurVille.villeId }).from(schema.collaborateurVille).where(eq(schema.collaborateurVille.userId, userId))).map((r) => r.v);
  return {
    services,
    villeIds,
    telephone: profil?.telephone ?? null,
    capacite: profil?.capacite ?? null,
    absentDu: profil?.absentDu ?? null,
    absentAu: profil?.absentAu ?? null,
  };
}

/** M1-ROL-02 : attributs utilisés par l'attribution automatique (ADR 0019). */
export async function definirAttributs(userId: string, attributs: Attributs, auteur: Auteur): Promise<void> {
  const a = schemaAttributs.parse(attributs);
  const avant = await lireAttributs(userId);
  await getDb().transaction(async (tx) => {
    await tx
      .insert(schema.collaborateurProfil)
      .values({ userId, telephone: a.telephone, capacite: a.capacite, absentDu: a.absentDu, absentAu: a.absentAu })
      .onConflictDoUpdate({ target: schema.collaborateurProfil.userId, set: { telephone: a.telephone, capacite: a.capacite, absentDu: a.absentDu, absentAu: a.absentAu } });
    await tx.delete(schema.collaborateurService).where(eq(schema.collaborateurService.userId, userId));
    if (a.services.length) await tx.insert(schema.collaborateurService).values([...new Set(a.services)].map((typeDossier) => ({ userId, typeDossier })));
    await tx.delete(schema.collaborateurVille).where(eq(schema.collaborateurVille.userId, userId));
    if (a.villeIds.length) await tx.insert(schema.collaborateurVille).values([...new Set(a.villeIds)].map((villeId) => ({ userId, villeId })));
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.attributs_modifies', objetType: 'user', objetId: userId, avant, apres: a }, tx);
  });
}

/** Réinitialisation de la 2FA par un administrateur (perte du téléphone). */
export async function reinitialiser2FA(userId: string, auteur: Auteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
    await tx.update(schema.user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.2fa_reinitialisee', objetType: 'user', objetId: userId }, tx);
  });
}

/** Changement d'e-mail par l'administrateur uniquement (cas limite §2). */
export async function changerEmail(userId: string, email: string, auteur: Auteur): Promise<void> {
  const nouvel = z.string().trim().toLowerCase().email('E-mail invalide').parse(email);
  await getDb().transaction(async (tx) => {
    const [u] = await tx.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, userId));
    if (!u) throw new ErreurMetier('Collaborateur introuvable.');
    const [pris] = await tx.select({ id: schema.user.id }).from(schema.user).where(and(eq(schema.user.email, nouvel), ne(schema.user.id, userId)));
    if (pris) throw new ErreurMetier('Cet e-mail est déjà utilisé.');
    await tx.update(schema.user).set({ email: nouvel, updatedAt: new Date() }).where(eq(schema.user.id, userId));
    await journaliser({ ...auteurAudit(auteur), action: 'collaborateur.email_modifie', objetType: 'user', objetId: userId, avant: u.email, apres: nouvel }, tx);
  });
}
