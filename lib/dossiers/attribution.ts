// Attribution automatique et réaffectation des dossiers (MVP1-05 RG-01..09, ADR 0019).
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { peut } from '@/lib/authz/permissions';
import { DOSSIER_TYPES, type DossierType, type Role } from '@/lib/domain/referentiels';
import { declencherEnvoi, idsDirection, notifier } from '@/lib/notifications';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { dateLocale } from './heures-ouvrees';
import { STATUT_CODES, STATUTS_FINAUX, estFinal, estOuvert, type Statut } from './statuts';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executeur = Db | Tx;

export type Regle = 'continuité' | 'charge minimale' | 'tour de rôle' | 'manuelle' | 'saisie — moi-même';

/** Statuts comptés dans la charge d'un référent (phase antérieure à « Terminé »). */
export const STATUTS_OUVERTS: Statut[] = STATUT_CODES.filter(estOuvert);
/** Types hors V1 (ADR 0012) : pas d'alerte de couverture manquante. */
const TYPES_HORS_V1: DossierType[] = ['MAD'];
const DOUZE_MOIS_MS = 365 * 24 * 60 * 60 * 1000;

export interface Candidat {
  id: string;
  nom: string;
  charge: number;
  capacite: number | null;
  derniereAttributionLe: Date | null;
  /** Motifs d'inéligibilité ; vide = éligible (RG-02). */
  raisons: string[];
}

// ─── Règles pures (RG-02, RG-03) ──────────────────────────────

export function estAbsent(absentDu: string | null, absentAu: string | null, jour: string): boolean {
  if (!absentDu && !absentAu) return false;
  return (!absentDu || absentDu <= jour) && (!absentAu || absentAu >= jour);
}

/**
 * RG-03 : continuité si le référent précédent est éligible, sinon charge minimale ;
 * à égalité de charge, la dernière attribution la plus ancienne (jamais = la plus ancienne).
 */
export function choisirReferent(candidats: Candidat[], continuiteId: string | null): { id: string; regle: Regle } | null {
  const eligibles = candidats.filter((c) => c.raisons.length === 0);
  if (!eligibles.length) return null;
  if (continuiteId && eligibles.some((c) => c.id === continuiteId)) return { id: continuiteId, regle: 'continuité' };
  const min = Math.min(...eligibles.map((c) => c.charge));
  const exaequo = eligibles
    .filter((c) => c.charge === min)
    .sort((a, b) => (a.derniereAttributionLe?.getTime() ?? -Infinity) - (b.derniereAttributionLe?.getTime() ?? -Infinity) || a.nom.localeCompare(b.nom) || a.id.localeCompare(b.id));
  return { id: exaequo[0]!.id, regle: exaequo.length > 1 ? 'tour de rôle' : 'charge minimale' };
}

// ─── Évaluation des collaborateurs ────────────────────────────

/**
 * Évalue l'éligibilité de collaborateurs pour un dossier (type + ville).
 * Par défaut : tous les référents actifs ; `ids` permet d'évaluer des personnes précises.
 */
export async function evaluerCandidats(db: Executeur, d: { type: DossierType; villeId: number | null }, maintenant = new Date(), ids?: string[]): Promise<Candidat[]> {
  const jour = dateLocale(maintenant);
  const p = schema.collaborateurProfil;
  const base = db
    .selectDistinct({ id: schema.user.id, nom: schema.user.name, active: schema.user.active, capacite: p.capacite, absentDu: p.absentDu, absentAu: p.absentAu, derniereAttributionLe: p.derniereAttributionLe })
    .from(schema.user)
    .leftJoin(p, eq(p.userId, schema.user.id));
  const personnes = ids
    ? ids.length
      ? await base.where(inArray(schema.user.id, ids))
      : []
    : await base.innerJoin(schema.collaborateurRole, eq(schema.collaborateurRole.userId, schema.user.id)).where(and(eq(schema.user.active, true), eq(schema.collaborateurRole.role, 'referent')));
  if (!personnes.length) return [];
  const liste = personnes.map((x) => x.id);

  const [roles, services, villes, charges, villeDossier] = await Promise.all([
    db.select().from(schema.collaborateurRole).where(inArray(schema.collaborateurRole.userId, liste)),
    db.select().from(schema.collaborateurService).where(inArray(schema.collaborateurService.userId, liste)),
    db.select().from(schema.collaborateurVille).where(inArray(schema.collaborateurVille.userId, liste)),
    db
      .select({ id: schema.dossier.referentId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.dossier)
      .where(and(inArray(schema.dossier.referentId, liste), inArray(schema.dossier.statut, STATUTS_OUVERTS)))
      .groupBy(schema.dossier.referentId),
    d.villeId ? db.select({ nom: schema.ville.nom, couverte: schema.ville.couverte, actif: schema.ville.actif }).from(schema.ville).where(eq(schema.ville.id, d.villeId)) : Promise.resolve([]),
  ]);
  const ville = villeDossier[0];

  return personnes.map((x) => {
    const charge = charges.find((c) => c.id === x.id)?.n ?? 0;
    const raisons: string[] = [];
    if (!x.active) raisons.push('compte désactivé');
    if (!roles.some((r) => r.userId === x.id && r.role === 'referent')) raisons.push('n’a pas le rôle Référent');
    if (!services.some((s) => s.userId === x.id && s.typeDossier === d.type)) raisons.push(`ne traite pas « ${DOSSIER_TYPES[d.type]} »`);
    if (!d.villeId || !ville) raisons.push('ville hors référentiel');
    else if (!ville.couverte || !ville.actif) raisons.push(`${ville.nom} n’est pas une ville couverte`);
    else if (!villes.some((v) => v.userId === x.id && v.villeId === d.villeId)) raisons.push(`ne couvre pas ${ville.nom}`);
    if (estAbsent(x.absentDu, x.absentAu, jour)) raisons.push('absent');
    if (x.capacite !== null && x.capacite !== undefined && charge >= x.capacite) raisons.push(`capacité atteinte (${charge}/${x.capacite})`);
    return { id: x.id, nom: x.nom, charge, capacite: x.capacite ?? null, derniereAttributionLe: x.derniereAttributionLe ?? null, raisons };
  });
}

/** RG-03 (1) : référent du dossier le plus récent du même client (ouvert, ou fermé depuis moins de 12 mois). */
async function referentDeContinuite(db: Executeur, clientId: number, saufId: number, maintenant: Date): Promise<string | null> {
  const [r] = await db
    .select({ referentId: schema.dossier.referentId })
    .from(schema.dossier)
    .where(
      and(
        eq(schema.dossier.clientId, clientId),
        ne(schema.dossier.id, saufId),
        isNotNull(schema.dossier.referentId),
        or(notInArray(schema.dossier.statut, [...STATUTS_FINAUX]), gt(schema.dossier.fermeLe, new Date(maintenant.getTime() - DOUZE_MOIS_MS))),
      ),
    )
    .orderBy(desc(schema.dossier.creeLe), desc(schema.dossier.id))
    .limit(1);
  return r?.referentId ?? null;
}

// ─── Utilitaires ──────────────────────────────────────────────

/** Informations sans budget ni salaire pour les notifications (RG-12). */
async function resume(db: Executeur, dossierId: number) {
  const [r] = await db
    .select({ numero: schema.dossier.numero, type: schema.dossier.type, villeNom: schema.ville.nom, villeAutre: schema.dossier.villeAutre, client: schema.client.nom })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(eq(schema.dossier.id, dossierId));
  if (!r) throw new ErreurMetier('Dossier introuvable.');
  const ville = r.villeNom ?? r.villeAutre ?? 'ville non précisée';
  return { ...r, ville, ligne: `${r.numero} — ${DOSSIER_TYPES[r.type]} — ${ville} — ${r.client}`, lien: `/admin/dossiers/${dossierId}` };
}

async function evenement(tx: Tx, e: typeof schema.evenementDossier.$inferInsert) {
  await tx.insert(schema.evenementDossier).values(e);
  await tx.update(schema.dossier).set({ derniereActionLe: new Date() }).where(eq(schema.dossier.id, e.dossierId));
}

async function noterAttribution(tx: Tx, userId: string, quand: Date) {
  await tx
    .insert(schema.collaborateurProfil)
    .values({ userId, derniereAttributionLe: quand })
    .onConflictDoUpdate({ target: schema.collaborateurProfil.userId, set: { derniereAttributionLe: quand } });
}

// ─── Attribution automatique (RG-01..05) ──────────────────────

export type ResultatAttribution = { referentId: string; regle: Regle } | { referentId: null; raison: string };

/** À appeler dans la transaction de création du dossier. */
export async function attribuerAutomatiquement(tx: Tx, dossierId: number, maintenant = new Date()): Promise<ResultatAttribution> {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  if (d.referentId) return { referentId: d.referentId, regle: 'manuelle' };

  const candidats = await evaluerCandidats(tx, d, maintenant);
  const choix = choisirReferent(candidats, await referentDeContinuite(tx, d.clientId, d.id, maintenant));
  const r = await resume(tx, dossierId);

  if (choix) {
    const statut: Statut = d.statut === 'nouvelle_demande' ? 'attribuee' : d.statut;
    await tx.update(schema.dossier).set({ referentId: choix.id, statut, enFileDepuis: null, derniereRelanceLe: null }).where(eq(schema.dossier.id, dossierId));
    await noterAttribution(tx, choix.id, maintenant);
    await evenement(tx, { dossierId, auteurId: null, type: 'attribution', deStatut: d.statut, versStatut: statut, apres: { referentId: choix.id, regle: choix.regle } });
    await notifier({ destinataires: [choix.id], type: 'attribution', dossierId, titre: `Nouveau dossier ${r.numero}`, texte: `Un dossier vous a été attribué (${choix.regle}) :\n${r.ligne}`, lien: r.lien, email: true }, tx);
    await journaliser({ acteurType: 'systeme', action: 'dossier.attribue', objetType: 'dossier', objetId: dossierId, apres: { referentId: choix.id, regle: choix.regle } }, tx);
    return { referentId: choix.id, regle: choix.regle };
  }

  // RG-05 : file « Non attribués », Direction prévenue.
  const raison = candidats.length === 0 ? 'aucun référent actif' : 'aucun référent éligible';
  const depuis = d.enFileDepuis ?? maintenant;
  await tx.update(schema.dossier).set({ enFileDepuis: depuis }).where(eq(schema.dossier.id, dossierId));
  await evenement(tx, { dossierId, auteurId: null, type: 'attribution', commentaire: `Non attribué : ${raison}`, apres: { referentId: null, raison } });
  await notifier(
    { destinataires: await idsDirection(tx), type: 'non_attribue', dossierId, titre: `Dossier non attribué ${r.numero}`, texte: `Aucun référent n’a pu prendre ce dossier (${raison}) :\n${r.ligne}`, lien: r.lien, cle: `non_attribue:${dossierId}:${depuis.toISOString()}`, email: true },
    tx,
  );
  return { referentId: null, raison };
}

// ─── Réaffectation (RG-08, RG-09) ─────────────────────────────

export interface Reaffecteur {
  id: string;
  roles: Role[];
  ip?: string | null;
}

export async function reaffecter(dossierId: number, nouveauId: string, motif: string, a: Reaffecteur): Promise<{ avertissements: string[] }> {
  if (!peut(a.roles, 'dossier.reaffecter')) throw new ErreurMetier('Réaffectation réservée à la Direction.');
  const m = motif.trim();
  if (m.length < 3) throw new ErreurMetier('Motif obligatoire.');
  if (m.length > 500) throw new ErreurMetier('Motif trop long (500 caractères maximum).');
  const maintenant = new Date();
  const res = await getDb().transaction(async (tx) => {
    const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId)).for('update');
    if (!d) throw new ErreurMetier('Dossier introuvable.');
    if (estFinal(d.statut)) throw new ErreurMetier('Ce dossier est fermé.');
    if (d.referentId === nouveauId) throw new ErreurMetier('Ce collaborateur est déjà le référent du dossier.');
    const [cible] = await evaluerCandidats(tx, d, maintenant, [nouveauId]);
    if (!cible || cible.raisons.includes('compte désactivé')) throw new ErreurMetier('Collaborateur introuvable ou désactivé.');

    const statut: Statut = d.statut === 'nouvelle_demande' ? 'attribuee' : d.statut;
    await tx.update(schema.dossier).set({ referentId: nouveauId, statut, enFileDepuis: null, derniereRelanceLe: null }).where(eq(schema.dossier.id, dossierId));
    await noterAttribution(tx, nouveauId, maintenant);
    await evenement(tx, {
      dossierId,
      auteurId: a.id,
      type: d.referentId ? 'reaffectation' : 'attribution',
      deStatut: d.statut !== statut ? d.statut : null,
      versStatut: d.statut !== statut ? statut : null,
      commentaire: m,
      avant: { referentId: d.referentId },
      apres: { referentId: nouveauId, regle: 'manuelle', ...(cible.raisons.length ? { avertissements: cible.raisons } : {}) },
    });
    const r = await resume(tx, dossierId);
    await notifier({ destinataires: [nouveauId], type: 'attribution', dossierId, titre: `Dossier ${r.numero} attribué`, texte: `La Direction vous a attribué ce dossier :\n${r.ligne}\nMotif : ${m}`, lien: r.lien, email: true }, tx);
    if (d.referentId) await notifier({ destinataires: [d.referentId], type: 'retrait', dossierId, titre: `Dossier ${r.numero} réaffecté`, texte: `Ce dossier a été confié à ${cible.nom}.\nMotif : ${m}`, lien: r.lien }, tx);
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'dossier.reaffecte', objetType: 'dossier', objetId: dossierId, avant: { referentId: d.referentId }, apres: { referentId: nouveauId }, details: { motif: m, avertissements: cible.raisons } }, tx);
    return { avertissements: cible.raisons };
  });
  declencherEnvoi();
  return res;
}

/** RG-09 : réaffectation en masse (motif commun). Chaque dossier est traité séparément. */
export async function reaffecterEnMasse(dossierIds: number[], nouveauId: string, motif: string, a: Reaffecteur) {
  if (!dossierIds.length) throw new ErreurMetier('Aucun dossier sélectionné.');
  if (motif.trim().length < 3) throw new ErreurMetier('Motif obligatoire.');
  const resultats: { dossierId: number; ok: boolean; erreur?: string }[] = [];
  for (const id of [...new Set(dossierIds)]) {
    try {
      await reaffecter(id, nouveauId, motif, a);
      resultats.push({ dossierId: id, ok: true });
    } catch (e) {
      resultats.push({ dossierId: id, ok: false, erreur: e instanceof Error ? e.message : 'erreur' });
    }
  }
  return resultats;
}

/** Cas limite : référent désactivé → ses dossiers ouverts retournent en « Non attribués ». */
export async function libererDossiersDe(tx: Tx, userId: string, auteurId: string | null): Promise<number> {
  const dossiers = await tx
    .select({ id: schema.dossier.id, statut: schema.dossier.statut, numero: schema.dossier.numero })
    .from(schema.dossier)
    .where(and(eq(schema.dossier.referentId, userId), inArray(schema.dossier.statut, STATUTS_OUVERTS)))
    .for('update');
  if (!dossiers.length) return 0;
  const maintenant = new Date();
  for (const d of dossiers) {
    const statut: Statut = d.statut === 'attribuee' ? 'nouvelle_demande' : d.statut;
    await tx.update(schema.dossier).set({ referentId: null, statut, enFileDepuis: maintenant, derniereRelanceLe: null }).where(eq(schema.dossier.id, d.id));
    await evenement(tx, { dossierId: d.id, auteurId, type: 'reaffectation', deStatut: d.statut !== statut ? d.statut : null, versStatut: d.statut !== statut ? statut : null, commentaire: 'Référent désactivé : dossier remis en « Non attribués »', avant: { referentId: userId }, apres: { referentId: null } });
  }
  const [u] = await tx.select({ nom: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
  await notifier(
    {
      destinataires: await idsDirection(tx),
      type: 'non_attribue',
      titre: `${dossiers.length} dossier(s) à réaffecter`,
      texte: `Le compte de ${u?.nom ?? 'un référent'} a été désactivé. Ses dossiers ouverts sont en « Non attribués » :\n${dossiers.map((d) => d.numero).join(', ')}`,
      lien: '/admin/attribution',
      cle: `desactivation:${userId}:${maintenant.toISOString()}`,
      email: true,
    },
    tx,
  );
  return dossiers.length;
}

/** RG-01 : après un changement de type ou de ville, proposer une réaffectation si le référent n'est plus éligible. */
export async function signalerSiReferentIneligible(tx: Tx, dossierId: number): Promise<void> {
  const [d] = await tx.select().from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d?.referentId || estFinal(d.statut)) return;
  const [c] = await evaluerCandidats(tx, d, new Date(), [d.referentId]);
  // L'absence et la capacité ne remettent pas en cause un dossier déjà suivi.
  const raisons = (c?.raisons ?? []).filter((x) => x !== 'absent' && !x.startsWith('capacité'));
  if (!raisons.length) return;
  const r = await resume(tx, dossierId);
  await notifier(
    { destinataires: await idsDirection(tx), type: 'referent_ineligible', dossierId, titre: `Réaffectation à envisager : ${r.numero}`, texte: `Après modification du dossier, ${c!.nom} n’est plus éligible (${raisons.join(', ')}) :\n${r.ligne}`, lien: r.lien, email: false },
    tx,
  );
}

// ─── Lecture pour la Direction ────────────────────────────────

/** Dossiers ouverts sans référent (file « Non attribués »). */
export async function fileNonAttribues() {
  return getDb()
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, type: schema.dossier.type, statut: schema.dossier.statut, villeId: schema.dossier.villeId, villeNom: schema.ville.nom, villeAutre: schema.dossier.villeAutre, client: schema.client.nom, creeLe: schema.dossier.creeLe, enFileDepuis: schema.dossier.enFileDepuis })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(and(isNull(schema.dossier.referentId), notInArray(schema.dossier.statut, [...STATUTS_FINAUX])))
    .orderBy(asc(schema.dossier.creeLe));
}

/** RG-09 : dossiers ouverts des collaborateurs absents aujourd'hui. */
export async function dossiersDesAbsents(maintenant = new Date()) {
  const jour = dateLocale(maintenant);
  const p = schema.collaborateurProfil;
  const absents = (await getDb().select({ id: p.userId, absentDu: p.absentDu, absentAu: p.absentAu }).from(p)).filter((x) => estAbsent(x.absentDu, x.absentAu, jour)).map((x) => x.id);
  if (!absents.length) return [];
  return getDb()
    .select({ id: schema.dossier.id, numero: schema.dossier.numero, type: schema.dossier.type, statut: schema.dossier.statut, client: schema.client.nom, referentId: schema.dossier.referentId, referentNom: schema.user.name })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .innerJoin(schema.user, eq(schema.user.id, schema.dossier.referentId))
    .where(and(inArray(schema.dossier.referentId, absents), inArray(schema.dossier.statut, STATUTS_OUVERTS)))
    .orderBy(asc(schema.user.name), asc(schema.dossier.creeLe));
}

/** Cas limite « démarrage » : combinaisons service × ville couverte sans aucun référent actif configuré. */
export async function couverturesManquantes(): Promise<{ type: DossierType; ville: string }[]> {
  const db = getDb();
  const [villes, refs] = await Promise.all([
    db.select({ id: schema.ville.id, nom: schema.ville.nom }).from(schema.ville).where(and(eq(schema.ville.couverte, true), eq(schema.ville.actif, true))),
    db
      .select({ type: schema.collaborateurService.typeDossier, villeId: schema.collaborateurVille.villeId })
      .from(schema.user)
      .innerJoin(schema.collaborateurRole, and(eq(schema.collaborateurRole.userId, schema.user.id), eq(schema.collaborateurRole.role, 'referent')))
      .innerJoin(schema.collaborateurService, eq(schema.collaborateurService.userId, schema.user.id))
      .innerJoin(schema.collaborateurVille, eq(schema.collaborateurVille.userId, schema.user.id))
      .where(eq(schema.user.active, true)),
  ]);
  const manquantes: { type: DossierType; ville: string }[] = [];
  for (const type of (Object.keys(DOSSIER_TYPES) as DossierType[]).filter((t) => !TYPES_HORS_V1.includes(t))) {
    for (const v of villes) if (!refs.some((r) => r.type === type && r.villeId === v.id)) manquantes.push({ type, ville: v.nom });
  }
  return manquantes;
}
