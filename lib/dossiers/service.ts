// Service métier des dossiers (specs/MVP1-02). Indépendant de Next.js : utilisé par les
// actions serveur, les routes publiques (formulaires du site) et les tests d'intégration.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { DOSSIER_TYPE_CODES, type DossierType } from '@/lib/domain/referentiels';
import { getStockage, nouvelleCle } from '@/lib/fichiers/stockage';
import { validerFichier } from '@/lib/fichiers/validation';
import { normaliserTelephone } from '@/lib/telephone';
import { peutTraiter, peutVoir, type Demandeur } from './acces';
import { anneeDouala, formaterNumero } from './numero';
import { estFinal, STATUTS, verifierTransition, type Statut } from './statuts';

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

export interface Acteur extends Demandeur {
  ip?: string | null;
}

/** Fenêtre de l'anti-doublon (MVP1-02 §10). */
export const FENETRE_DOUBLON_MS = 10 * 60 * 1000;
/** Expiration du lien de suivi après fermeture du dossier (RG-29). */
export const EXPIRATION_SUIVI_MS = 90 * 24 * 60 * 60 * 1000;

// ─── Schémas d'entrée ─────────────────────────────────────────

const texte = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const schemaClient = z.object({
  type: z.enum(['entreprise', 'particulier']),
  nom: z.string().trim().min(2, 'Nom du client trop court').max(120),
  contact: texte(80),
  whatsapp: z.string().trim().min(1, 'Numéro WhatsApp obligatoire'),
  autreTelephone: texte(30),
  email: z.string().trim().toLowerCase().email('E-mail invalide').max(120).optional().nullable().or(z.literal('').transform(() => null)),
});

export const schemaLignePoste = z.object({
  intitule: z.string().trim().min(2, 'Intitulé du poste trop court').max(120),
  nombre: z.number().int().min(1, 'Au moins 1 personne').max(100, '100 personnes maximum par poste'),
  missions: texte(1000),
  competences: texte(500),
  experience: texte(40),
  salaire: texte(120),
  typeContrat: texte(40),
  duree: texte(80),
  horaires: texte(120),
  joursRepos: z.array(z.string().max(12)).max(7).default([]),
  avantages: texte(300),
  datePriseFonction: z.string().date().optional().nullable().transform((v) => v ?? null),
  desQuePossible: z.boolean().default(false),
});

export type LignePosteSaisie = z.input<typeof schemaLignePoste>;

export const schemaLieu = z.object({
  villeId: z.number().int().positive().nullable(),
  villeAutre: texte(80),
  quartierId: z.number().int().positive().nullable(),
  quartierAutre: texte(80),
  lieu: texte(200),
  secteur: texte(80),
  description: texte(3000),
});

export const schemaNouvelleDemande = schemaLieu.extend({
  type: z.enum(DOSSIER_TYPE_CODES),
  canal: z.enum(['site', 'whatsapp', 'telephone', 'email', 'visite', 'autre']),
  formulaire: z.string().trim().min(1).max(40),
  client: schemaClient,
  lignes: z.array(schemaLignePoste).max(10, '10 postes maximum').default([]),
  /** Données brutes conservées telles quelles dans la Demande (RG-06). */
  donnees: z.record(z.string(), z.unknown()),
  /** Saisie manuelle : rattacher à un dossier existant (RG-07, RG-19). */
  dossierExistantId: z.number().int().positive().optional(),
  /** Saisie manuelle : « Me l'attribuer » (RG-20). */
  meLAttribuer: z.boolean().optional(),
});

export type NouvelleDemande = z.input<typeof schemaNouvelleDemande>;

export interface ResultatCreation {
  dossierId: number;
  numero: string;
  jetonSuivi: string;
  /** Soumission identique récente : aucune nouvelle demande créée (anti-doublon). */
  doublon: boolean;
  /** Le client existant avait des coordonnées différentes (RG-04). */
  coordonneesDifferentes: boolean;
}

// ─── Utilitaires ──────────────────────────────────────────────

/** JSON stable (clés triées) pour l'empreinte anti-doublon. */
function jsonStable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonStable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${jsonStable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(typeof v === 'string' ? v.trim() : v);
}

export const empreinteDonnees = (donnees: unknown) => createHash('sha256').update(jsonStable(donnees)).digest('hex');

const genererJetonSuivi = () => randomBytes(24).toString('base64url'); // 192 bits

async function prochainNumero(tx: Tx, type: DossierType, date = new Date()): Promise<string> {
  const annee = anneeDouala(date);
  // Incrément atomique : deux transactions concurrentes n'obtiennent jamais le même numéro.
  const [ligne] = await tx
    .insert(schema.sequenceDossier)
    .values({ type, annee, dernier: 1 })
    .onConflictDoUpdate({ target: [schema.sequenceDossier.type, schema.sequenceDossier.annee], set: { dernier: sql`${schema.sequenceDossier.dernier} + 1` } })
    .returning({ dernier: schema.sequenceDossier.dernier });
  return formaterNumero(type, annee, ligne!.dernier);
}

async function evenement(tx: Tx, e: typeof schema.evenementDossier.$inferInsert) {
  await tx.insert(schema.evenementDossier).values(e);
  await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, e.dossierId));
}

const auteurAudit = (a?: Acteur | null) => (a ? { acteurType: 'collaborateur' as const, acteurId: a.id, ip: a.ip ?? null } : { acteurType: 'client' as const, acteurId: null });

async function chargerPourEcriture(tx: Tx, dossierId: number, a: Acteur) {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
  return d;
}

export class ErreurAccesDossier extends ErreurMetier {
  constructor() {
    super('Accès refusé à ce dossier.');
  }
}

// ─── Création (RG-03..07, RG-19..20, anti-doublon) ────────────

export async function creerDemande(entree: NouvelleDemande, auteur?: Acteur | null): Promise<ResultatCreation> {
  const d = schemaNouvelleDemande.parse(entree);
  const whatsapp = normaliserTelephone(d.client.whatsapp);
  if (!whatsapp) throw new ErreurMetier('Numéro WhatsApp invalide.');
  const autreTelephone = d.client.autreTelephone ? normaliserTelephone(d.client.autreTelephone) : null;
  if (d.client.autreTelephone && !autreTelephone) throw new ErreurMetier('Autre téléphone invalide.');
  if (d.type !== 'REC' && d.lignes.length > 0) throw new ErreurMetier('Les lignes de poste ne concernent que les dossiers de recrutement.');
  if (d.type === 'REC' && d.lignes.length === 0 && !d.dossierExistantId) throw new ErreurMetier('Indiquez au moins un poste.');
  const empreinte = empreinteDonnees(d.donnees);

  return getDb().transaction(async (tx) => {
    // Client : identifié par le numéro WhatsApp ; ses données existantes ne sont pas écrasées (RG-04).
    const [existant] = await tx.select().from(schema.client).where(eq(schema.client.whatsapp, whatsapp)).for('update');
    let clientId: number;
    let coordonneesDifferentes = false;
    if (existant) {
      clientId = existant.id;
      coordonneesDifferentes =
        existant.nom !== d.client.nom || (existant.contact ?? null) !== d.client.contact || (!!d.client.email && existant.email !== d.client.email) || (!!autreTelephone && existant.autreTelephone !== autreTelephone);
    } else {
      const [c] = await tx
        .insert(schema.client)
        .values({ type: d.client.type, nom: d.client.nom, contact: d.client.contact, whatsapp, autreTelephone, email: d.client.email ?? null, villeId: d.villeId, quartierId: d.quartierId })
        .returning({ id: schema.client.id });
      clientId = c!.id;
    }

    // Anti-doublon : même client + même formulaire + mêmes données depuis moins de 10 min.
    if (!auteur) {
      const [doublon] = await tx
        .select({ dossierId: schema.demande.dossierId, numero: schema.dossier.numero, jeton: schema.dossier.jetonSuivi })
        .from(schema.demande)
        .innerJoin(schema.dossier, eq(schema.dossier.id, schema.demande.dossierId))
        .where(and(eq(schema.demande.clientId, clientId), eq(schema.demande.formulaire, d.formulaire), eq(schema.demande.empreinte, empreinte), gt(schema.demande.creeLe, new Date(Date.now() - FENETRE_DOUBLON_MS))))
        .limit(1);
      if (doublon) return { dossierId: doublon.dossierId, numero: doublon.numero, jetonSuivi: doublon.jeton, doublon: true, coordonneesDifferentes };
    }

    // Instantané des coordonnées saisies, pour proposer leur mise à jour au référent (RG-04).
    const donneesDemande = { ...d.donnees, client: { ...d.client, whatsapp, autreTelephone } };
    const valeursDemande = { clientId, canal: d.canal, formulaire: d.formulaire, donnees: donneesDemande, empreinte, auteurId: auteur?.id ?? null };

    // Rattachement direct à un dossier existant (saisie manuelle).
    if (d.dossierExistantId) {
      if (!auteur) throw new ErreurMetier('Rattachement réservé aux collaborateurs.');
      const cible = await chargerPourEcriture(tx, d.dossierExistantId, auteur);
      if (estFinal(cible.statut)) throw new ErreurMetier('Impossible de rattacher une demande à un dossier fermé.');
      const [dem] = await tx.insert(schema.demande).values({ ...valeursDemande, dossierId: cible.id }).returning({ id: schema.demande.id });
      await evenement(tx, { dossierId: cible.id, auteurId: auteur.id, type: 'rattachement', commentaire: `Nouvelle demande n° ${dem!.id} saisie (${d.canal})` });
      await journaliser({ ...auteurAudit(auteur), action: 'dossier.demande_rattachee', objetType: 'dossier', objetId: cible.id, details: { demandeId: dem!.id } }, tx);
      return { dossierId: cible.id, numero: cible.numero, jetonSuivi: cible.jetonSuivi, doublon: false, coordonneesDifferentes };
    }

    const numero = await prochainNumero(tx, d.type);
    const [dossier] = await tx
      .insert(schema.dossier)
      .values({
        numero,
        type: d.type,
        clientId,
        villeId: d.villeId,
        villeAutre: d.villeAutre,
        quartierId: d.quartierId,
        quartierAutre: d.quartierAutre,
        lieu: d.lieu,
        secteur: d.secteur,
        description: d.description,
        jetonSuivi: genererJetonSuivi(),
      })
      .returning();
    if (d.lignes.length) {
      await tx.insert(schema.lignePoste).values(d.lignes.map((l, i) => ({ ...l, dossierId: dossier!.id, ordre: i + 1 })));
    }
    await tx.insert(schema.demande).values({ ...valeursDemande, dossierId: dossier!.id });
    await evenement(tx, { dossierId: dossier!.id, auteurId: auteur?.id ?? null, type: 'creation', versStatut: 'nouvelle_demande', commentaire: `Demande reçue (${d.canal}, ${d.formulaire})` });

    if (auteur && d.meLAttribuer) {
      await tx.update(schema.dossier).set({ referentId: auteur.id, statut: 'attribuee' }).where(eq(schema.dossier.id, dossier!.id));
      await evenement(tx, { dossierId: dossier!.id, auteurId: auteur.id, type: 'attribution', deStatut: 'nouvelle_demande', versStatut: 'attribuee', apres: { referentId: auteur.id, regle: 'saisie — moi-même' } });
    }
    await journaliser({ ...auteurAudit(auteur), action: 'dossier.cree', objetType: 'dossier', objetId: dossier!.id, details: { numero, type: d.type, canal: d.canal } }, tx);
    return { dossierId: dossier!.id, numero, jetonSuivi: dossier!.jetonSuivi, doublon: false, coordonneesDifferentes };
  });
}

// ─── Transitions (RG-12..18) ──────────────────────────────────

export async function changerStatut(dossierId: number, vers: Statut, commentaire: string | null, a: Acteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, dossierId, a);
    const docs = await tx
      .select({ categorie: schema.document.categorie })
      .from(schema.document)
      .where(and(eq(schema.document.dossierId, dossierId), isNull(schema.document.supprimeLe)));
    const verdict = verifierTransition({
      type: d.type,
      de: d.statut,
      vers,
      commentaire,
      direction: a.roles.includes('direction'),
      aUnDevisExterne: docs.some((x) => x.categorie === 'devis_externe'),
      aUnJustificatif: docs.some((x) => x.categorie === 'justificatif'),
    });
    if (!verdict.ok) throw new ErreurMetier(verdict.erreur);
    await tx
      .update(schema.dossier)
      .set({ statut: vers, fermeLe: estFinal(vers) ? new Date() : null })
      .where(eq(schema.dossier.id, dossierId));
    await evenement(tx, { dossierId, auteurId: a.id, type: 'transition', deStatut: d.statut, versStatut: vers, commentaire: commentaire?.trim() || null });
    await journaliser({ ...auteurAudit(a), action: 'dossier.transition', objetType: 'dossier', objetId: dossierId, avant: d.statut, apres: vers, details: commentaire ? { commentaire } : undefined }, tx);
  });
}

// ─── Modifications (RG-10, RG-11) ─────────────────────────────

export async function modifierLieu(dossierId: number, champs: z.input<typeof schemaLieu>, a: Acteur): Promise<void> {
  const c = schemaLieu.parse(champs);
  await getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, dossierId, a);
    const avant = { villeId: d.villeId, villeAutre: d.villeAutre, quartierId: d.quartierId, quartierAutre: d.quartierAutre, lieu: d.lieu, secteur: d.secteur, description: d.description };
    const changes = Object.fromEntries(Object.entries(c).filter(([k, v]) => (avant as Record<string, unknown>)[k] !== v));
    if (Object.keys(changes).length === 0) return;
    await tx.update(schema.dossier).set(changes).where(eq(schema.dossier.id, dossierId));
    await evenement(tx, { dossierId, auteurId: a.id, type: 'modification', avant: Object.fromEntries(Object.keys(changes).map((k) => [k, (avant as Record<string, unknown>)[k]])), apres: changes });
  });
}

export async function remplacerLignes(dossierId: number, lignes: LignePosteSaisie[], a: Acteur): Promise<void> {
  const nouvelles = z.array(schemaLignePoste).min(1, 'Au moins un poste').max(10).parse(lignes);
  await getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, dossierId, a);
    if (d.type !== 'REC') throw new ErreurMetier('Les lignes de poste ne concernent que les dossiers de recrutement.');
    const avant = await tx.select().from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(schema.lignePoste.ordre);
    await tx.delete(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId));
    await tx.insert(schema.lignePoste).values(nouvelles.map((l, i) => ({ ...l, dossierId, ordre: i + 1 })));
    await evenement(tx, {
      dossierId,
      auteurId: a.id,
      type: 'modification',
      commentaire: 'Postes modifiés',
      avant: avant.map(({ id: _id, dossierId: _d, ...l }) => l),
      apres: nouvelles,
    });
  });
}

export async function ajouterNote(dossierId: number, texteNote: string, a: Acteur): Promise<void> {
  const note = z.string().trim().min(1, 'Note vide').max(3000).parse(texteNote);
  await getDb().transaction(async (tx) => {
    await chargerPourEcriture(tx, dossierId, a);
    await evenement(tx, { dossierId, auteurId: a.id, type: 'note', commentaire: note });
  });
}

/** Statuts antérieurs à « Devis envoyé » : changement de type autorisé (MVP1-02 §10). */
const STATUTS_TYPE_MODIFIABLE: Statut[] = ['nouvelle_demande', 'attribuee', 'en_qualification', 'a_completer', 'devis_pret'];

export async function changerType(dossierId: number, type: DossierType, a: Acteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, dossierId, a);
    if (!STATUTS_TYPE_MODIFIABLE.includes(d.statut)) throw new ErreurMetier('Le type ne peut plus être modifié après l’envoi du devis.');
    if (d.type === type) return;
    if (d.type === 'REC') {
      const lignes = await tx.select({ id: schema.lignePoste.id }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId));
      if (lignes.length) throw new ErreurMetier('Supprimez d’abord les postes avant de changer le type d’un dossier de recrutement.');
    }
    // Le numéro (et son préfixe) ne change jamais (RG-02).
    await tx.update(schema.dossier).set({ type }).where(eq(schema.dossier.id, dossierId));
    await evenement(tx, { dossierId, auteurId: a.id, type: 'modification', commentaire: 'Type de dossier modifié', avant: { type: d.type }, apres: { type } });
    await journaliser({ ...auteurAudit(a), action: 'dossier.type_modifie', objetType: 'dossier', objetId: dossierId, avant: d.type, apres: type }, tx);
  });
}

// ─── Rattachement a posteriori (RG-08) ────────────────────────

export async function rattacherDemande(demandeId: number, dossierCibleId: number, a: Acteur): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [dem] = await tx.select().from(schema.demande).where(eq(schema.demande.id, demandeId)).for('update');
    if (!dem) throw new ErreurMetier('Demande introuvable.');
    if (dem.dossierId === dossierCibleId) throw new ErreurMetier('La demande appartient déjà à ce dossier.');
    // Verrouillage dans un ordre stable pour éviter les interblocages.
    const [premier, second] = [dem.dossierId, dossierCibleId].sort((x, y) => x - y);
    const d1 = await chargerPourEcriture(tx, premier!, a);
    const d2 = await chargerPourEcriture(tx, second!, a);
    const source = d1.id === dem.dossierId ? d1 : d2;
    const cible = d1.id === dossierCibleId ? d1 : d2;
    if (estFinal(cible.statut)) throw new ErreurMetier('Impossible de rattacher une demande à un dossier fermé.');

    await tx.update(schema.demande).set({ dossierId: cible.id }).where(eq(schema.demande.id, demandeId));
    await evenement(tx, { dossierId: cible.id, auteurId: a.id, type: 'rattachement', commentaire: `Demande n° ${demandeId} rattachée depuis ${source.numero}` });
    await evenement(tx, { dossierId: source.id, auteurId: a.id, type: 'rattachement', commentaire: `Demande n° ${demandeId} rattachée à ${cible.numero}` });

    const [{ restantes }] = (await tx
      .select({ restantes: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.demande)
      .where(eq(schema.demande.dossierId, source.id))) as [{ restantes: number }];
    if (restantes === 0 && !estFinal(source.statut)) {
      await tx.update(schema.dossier).set({ statut: 'sans_suite', fermeLe: new Date() }).where(eq(schema.dossier.id, source.id));
      await evenement(tx, { dossierId: source.id, auteurId: a.id, type: 'transition', deStatut: source.statut, versStatut: 'sans_suite', commentaire: `Fusionné dans ${cible.numero}` });
    }
    await journaliser({ ...auteurAudit(a), action: 'dossier.demande_rattachee', objetType: 'demande', objetId: demandeId, avant: { dossierId: source.id }, apres: { dossierId: cible.id } }, tx);
  });
}

// ─── Clients (RG-04, RG-05) ───────────────────────────────────

export async function mettreAJourClient(clientId: number, champs: Partial<z.input<typeof schemaClient>>, a: Acteur & { dossierId: number }): Promise<void> {
  const c = schemaClient.partial().omit({ whatsapp: true }).parse(champs);
  await getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, a.dossierId, a);
    if (d.clientId !== clientId) throw new ErreurAccesDossier();
    const [avant] = await tx.select().from(schema.client).where(eq(schema.client.id, clientId));
    const autreTelephone = c.autreTelephone === undefined ? undefined : c.autreTelephone ? normaliserTelephone(c.autreTelephone) : null;
    if (c.autreTelephone && !autreTelephone) throw new ErreurMetier('Autre téléphone invalide.');
    const maj = { ...c, ...(autreTelephone !== undefined ? { autreTelephone } : {}), majLe: new Date() };
    await tx.update(schema.client).set(maj).where(eq(schema.client.id, clientId));
    await evenement(tx, { dossierId: d.id, auteurId: a.id, type: 'client', commentaire: 'Coordonnées du client mises à jour', avant, apres: c });
    await journaliser({ ...auteurAudit(a), action: 'client.modifie', objetType: 'client', objetId: clientId, avant, apres: c }, tx);
  });
}

/** Fusion de deux clients (Direction) : les dossiers et demandes passent au client conservé. */
export async function fusionnerClients(conserveId: number, absorbeId: number, a: Acteur): Promise<void> {
  if (!a.roles.includes('direction')) throw new ErreurAccesDossier();
  if (conserveId === absorbeId) throw new ErreurMetier('Choisissez deux clients différents.');
  await getDb().transaction(async (tx) => {
    const [absorbe] = await tx.select().from(schema.client).where(eq(schema.client.id, absorbeId)).for('update');
    const [conserve] = await tx.select().from(schema.client).where(eq(schema.client.id, conserveId)).for('update');
    if (!absorbe || !conserve) throw new ErreurMetier('Client introuvable.');
    const dossiers = await tx.update(schema.dossier).set({ clientId: conserveId }).where(eq(schema.dossier.clientId, absorbeId)).returning({ id: schema.dossier.id });
    await tx.update(schema.demande).set({ clientId: conserveId }).where(eq(schema.demande.clientId, absorbeId));
    await tx.delete(schema.client).where(eq(schema.client.id, absorbeId));
    for (const d of dossiers) {
      await evenement(tx, { dossierId: d.id, auteurId: a.id, type: 'client', commentaire: `Client fusionné : ${absorbe.nom} (${absorbe.whatsapp}) → ${conserve.nom}` });
    }
    await journaliser({ ...auteurAudit(a), action: 'client.fusionne', objetType: 'client', objetId: conserveId, avant: absorbe, details: { dossiers: dossiers.map((d) => d.id) } }, tx);
  });
}

/** Séparation (RG-05) : déplacer un dossier vers un nouveau client (Direction). */
export async function deplacerVersNouveauClient(dossierId: number, nouveau: z.input<typeof schemaClient>, a: Acteur): Promise<number> {
  if (!a.roles.includes('direction')) throw new ErreurAccesDossier();
  const c = schemaClient.parse(nouveau);
  const whatsapp = normaliserTelephone(c.whatsapp);
  if (!whatsapp) throw new ErreurMetier('Numéro WhatsApp invalide.');
  return getDb().transaction(async (tx) => {
    const d = await chargerPourEcriture(tx, dossierId, a);
    const [pris] = await tx.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.whatsapp, whatsapp));
    if (pris) throw new ErreurMetier('Un client existe déjà avec ce numéro WhatsApp.');
    const [nc] = await tx.insert(schema.client).values({ ...c, whatsapp, email: c.email ?? null }).returning({ id: schema.client.id });
    await tx.update(schema.dossier).set({ clientId: nc!.id }).where(eq(schema.dossier.id, dossierId));
    await tx.update(schema.demande).set({ clientId: nc!.id }).where(eq(schema.demande.dossierId, dossierId));
    await evenement(tx, { dossierId, auteurId: a.id, type: 'client', commentaire: 'Dossier déplacé vers un nouveau client', avant: { clientId: d.clientId }, apres: { clientId: nc!.id } });
    await journaliser({ ...auteurAudit(a), action: 'client.separe', objetType: 'dossier', objetId: dossierId, avant: d.clientId, apres: nc!.id }, tx);
    return nc!.id;
  });
}

// ─── Lien de suivi (RG-24..29) ────────────────────────────────

export async function regenererJetonSuivi(dossierId: number, a: Acteur): Promise<string> {
  return getDb().transaction(async (tx) => {
    await chargerPourEcriture(tx, dossierId, a);
    const jeton = genererJetonSuivi();
    await tx.update(schema.dossier).set({ jetonSuivi: jeton }).where(eq(schema.dossier.id, dossierId));
    await evenement(tx, { dossierId, auteurId: a.id, type: 'lien_suivi', commentaire: 'Lien de suivi régénéré (l’ancien ne fonctionne plus)' });
    await journaliser({ ...auteurAudit(a), action: 'dossier.lien_suivi_regenere', objetType: 'dossier', objetId: dossierId }, tx);
    return jeton;
  });
}

export interface VueSuivi {
  numero: string;
  type: DossierType;
  contact: string;
  creeLe: Date;
  statut: Statut;
  derniereActionLe: Date;
}

/** Page de suivi publique : informations minimales (RG-25), consultation journalisée (RG-27). */
export async function lireSuivi(jeton: string, ip: string | null, maintenant = new Date()): Promise<VueSuivi | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton)) return null;
  const [r] = await getDb()
    .select({
      id: schema.dossier.id,
      numero: schema.dossier.numero,
      type: schema.dossier.type,
      statut: schema.dossier.statut,
      creeLe: schema.dossier.creeLe,
      derniereActionLe: schema.dossier.derniereActionLe,
      fermeLe: schema.dossier.fermeLe,
      contact: schema.client.contact,
      nom: schema.client.nom,
    })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .where(eq(schema.dossier.jetonSuivi, jeton));
  if (!r) return null;
  if (r.fermeLe && maintenant.getTime() - r.fermeLe.getTime() > EXPIRATION_SUIVI_MS) return null;
  await journaliser({ acteurType: 'client', action: 'suivi.consulte', objetType: 'dossier', objetId: r.id, ip });
  return { numero: r.numero, type: r.type, contact: r.contact ?? r.nom, creeLe: r.creeLe, statut: r.statut, derniereActionLe: r.derniereActionLe };
}

// ─── Documents (M1-DOC-03..05) ────────────────────────────────

export const CATEGORIES_DOCUMENT = {
  piece_client: 'Pièce client',
  devis_externe: 'Devis externe',
  justificatif: 'Justificatif',
  autre: 'Autre',
} as const;

export type CategorieDocument = keyof typeof CATEGORIES_DOCUMENT;

export async function ajouterDocument(dossierId: number, fichier: { nom: string; octets: Uint8Array }, categorie: CategorieDocument, a: Acteur): Promise<number> {
  const v = validerFichier(fichier.nom, fichier.octets);
  if (!v.ok) throw new ErreurMetier(v.erreur);
  const nomOrigine = fichier.nom.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150);
  const cle = nouvelleCle('dossiers', v.type === 'jpeg' ? 'jpg' : v.type);
  // Vérification des droits avant d'écrire sur le disque.
  const [d] = await getDb().select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (!peutTraiter(a, d.referentId)) throw new ErreurAccesDossier();
  await getStockage().deposer(cle, fichier.octets);
  try {
    return await getDb().transaction(async (tx) => {
      await chargerPourEcriture(tx, dossierId, a);
      const [doc] = await tx
        .insert(schema.document)
        .values({ dossierId, cle, nomOrigine, mime: v.mime, taille: fichier.octets.byteLength, categorie, auteurId: a.id })
        .returning({ id: schema.document.id });
      await evenement(tx, { dossierId, auteurId: a.id, type: 'document', commentaire: `Document ajouté : ${nomOrigine} (${CATEGORIES_DOCUMENT[categorie]})` });
      await journaliser({ ...auteurAudit(a), action: 'document.televerse', objetType: 'document', objetId: doc!.id, details: { dossierId, categorie, taille: fichier.octets.byteLength } }, tx);
      return doc!.id;
    });
  } catch (e) {
    await getStockage().supprimer(cle); // pas de fichier orphelin
    throw e;
  }
}

/** Téléchargement contrôlé et journalisé (M1-DOC-04). Les refus sont journalisés. */
export async function lireDocument(documentId: number, a: Acteur): Promise<{ nom: string; mime: string; octets: Uint8Array }> {
  const [doc] = await getDb()
    .select({ doc: schema.document, referentId: schema.dossier.referentId })
    .from(schema.document)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.document.dossierId))
    .where(and(eq(schema.document.id, documentId), isNull(schema.document.supprimeLe)));
  if (!doc) throw new ErreurMetier('Document introuvable.');
  if (!peutVoir(a, doc.referentId)) {
    await journaliser({ ...auteurAudit(a), action: 'acces.refuse', objetType: 'document', objetId: documentId });
    throw new ErreurAccesDossier();
  }
  const octets = await getStockage().lire(doc.doc.cle);
  await journaliser({ ...auteurAudit(a), action: 'document.telecharge', objetType: 'document', objetId: documentId, details: { dossierId: doc.doc.dossierId } });
  return { nom: doc.doc.nomOrigine, mime: doc.doc.mime, octets };
}

/** Suppression logique : auteur dans les 24 h, ou Direction (M1-DOC-05). */
export async function supprimerDocument(documentId: number, a: Acteur, maintenant = new Date()): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [doc] = await tx.select().from(schema.document).where(and(eq(schema.document.id, documentId), isNull(schema.document.supprimeLe))).for('update');
    if (!doc) throw new ErreurMetier('Document introuvable.');
    await chargerPourEcriture(tx, doc.dossierId, a);
    const auteurRecent = doc.auteurId === a.id && maintenant.getTime() - doc.creeLe.getTime() < 24 * 60 * 60 * 1000;
    if (!auteurRecent && !a.roles.includes('direction')) throw new ErreurMetier('Seul l’auteur (dans les 24 h) ou la Direction peut supprimer ce document.');
    await tx.update(schema.document).set({ supprimeLe: maintenant, supprimePar: a.id }).where(eq(schema.document.id, documentId));
    await evenement(tx, { dossierId: doc.dossierId, auteurId: a.id, type: 'document', commentaire: `Document supprimé : ${doc.nomOrigine}` });
    await journaliser({ ...auteurAudit(a), action: 'document.supprime', objetType: 'document', objetId: documentId }, tx);
  });
}

/** Purge physique des documents supprimés depuis plus de 30 jours (tâche planifiée). */
export async function purgerDocuments(maintenant = new Date()): Promise<number> {
  const limite = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
  const aPurger = await getDb()
    .select({ id: schema.document.id, cle: schema.document.cle })
    .from(schema.document)
    .where(and(lt(schema.document.supprimeLe, limite), sql`${schema.document.cle} not like 'purge:%'`));
  let n = 0;
  for (const doc of aPurger) {
    await getStockage().supprimer(doc.cle);
    await getDb().update(schema.document).set({ cle: `purge:${doc.id}` }).where(eq(schema.document.id, doc.id));
    n++;
  }
  if (n) await journaliser({ acteurType: 'systeme', action: 'document.purge', details: { nombre: n } });
  return n;
}

export { STATUTS };
