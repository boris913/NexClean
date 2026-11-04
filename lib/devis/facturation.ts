// Facturation à la clôture de la recherche et avoirs de correction (specs/MVP2-04 RG-16..18,
// ADR 0010, 0020). Montant final = Σ commission figée × placements retenus (hors remplacements),
// TVA au taux figé du devis ; solde = montant final TTC − acompte facturé TTC → facture de solde,
// avoir sur la facture d'acompte, ou rien. Une facture émise ne se modifie pas : une erreur se
// corrige par un avoir (Direction).
import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { peutTraiter, peutVoir, type Demandeur } from '@/lib/dossiers/acces';
import { ErreurAccesDossier } from '@/lib/dossiers/service';
import { compterPlacementsRetenus } from '@/lib/propositions/domaine';
import { decomposerTtc, formaterMontant, montantFinal, regularisation, TYPES_FACTURE, type TypeFacture } from './domaine';
import { archiverPdfFacture, auditDe, emettreFacture, type AuteurEffet, type Tx } from './effets';

type Lecteur = Pick<ReturnType<typeof getDb>, 'select'>;

// ─── Lignes facturables ──────────────────────────────────────

export interface LigneFacturable {
  lignePosteId: number | null;
  intitule: string;
  /** Commission unitaire HT figée (devis initial, ou avenant pour une ligne nouvelle). */
  commission: number;
  nombre: number;
}

/**
 * Lignes facturables d'un Dossier : devis (`type = 'devis'`) accepté et ses avenants acceptés
 * (`devisInitialId` = ce devis), consolidés par ligne de poste. Pour une même `lignePosteId`, la
 * commission figée du devis initial est conservée ; le nombre est celui du dernier avenant accepté
 * qui la mentionne (nombre total de personnes après avenant). Les lignes d'avenant sans ligne de
 * poste sont ajoutées telles quelles.
 *
 * À LA FUSION : à remplacer par `lignesFacturables(dossierId)` de lib/devis/lignes.ts (lot A),
 * même forme de retour ; seul `devisAccepte` (taux de TVA figé, référence) reste lu ici.
 */
export async function lireLignesFacturables(db: Lecteur, dossierId: number): Promise<{ devis: typeof schema.devis.$inferSelect; lignes: LigneFacturable[] } | null> {
  const [initial] = await db
    .select()
    .from(schema.devis)
    .where(and(eq(schema.devis.dossierId, dossierId), eq(schema.devis.type, 'devis'), eq(schema.devis.statut, 'accepte')))
    .orderBy(desc(schema.devis.accepteLe), desc(schema.devis.id))
    .limit(1);
  if (!initial) return null;
  const avenants = await db
    .select()
    .from(schema.devis)
    .where(and(eq(schema.devis.devisInitialId, initial.id), eq(schema.devis.type, 'avenant'), eq(schema.devis.statut, 'accepte')))
    .orderBy(asc(schema.devis.accepteLe), asc(schema.devis.id));
  const parLigne = new Map<number, LigneFacturable>();
  const sansLigne: LigneFacturable[] = [];
  for (const d of [initial, ...avenants]) {
    for (const l of d.lignes) {
      if (l.lignePosteId === null) {
        sansLigne.push({ lignePosteId: null, intitule: l.intitule, commission: l.commission, nombre: l.nombre });
        continue;
      }
      const deja = parLigne.get(l.lignePosteId);
      parLigne.set(l.lignePosteId, deja ? { ...deja, nombre: l.nombre } : { lignePosteId: l.lignePosteId, intitule: l.intitule, commission: l.commission, nombre: l.nombre });
    }
  }
  return { devis: initial, lignes: [...parLigne.values(), ...sansLigne] };
}

// ─── Facturation à la clôture (RG-18) ────────────────────────

export interface ResultatFacturation {
  /** Montant final (null si aucun devis accepté : rien n'est facturé). */
  montantFinal: { totalHt: number; montantTva: number; totalTtc: number; placements: number } | null;
  /** Acompte facturé TTC (factures d'acompte, déduction faite des avoirs qui les corrigent). */
  acompteFactureTtc: number;
  /** Facture de solde ou avoir émis (à archiver en PDF après la transaction). */
  facture?: { id: number; numero: string; type: TypeFacture; totalTtc: number };
  /** Dossier sans devis accepté (MVP-1 ou mode transitoire) : aucune facture émise. */
  sansDevis?: boolean;
  avertissements: string[];
}

interface FactureDossier {
  id: number;
  numero: string;
  type: TypeFacture;
  factureOrigineId: number | null;
  totalHt: number;
  montantTva: number;
  totalTtc: number;
}

/** Montant restant d'une facture après les avoirs déjà émis sur elle (HT, TVA, TTC). */
function restant(f: FactureDossier, toutes: readonly FactureDossier[]) {
  const avoirs = toutes.filter((x) => x.type === 'avoir' && x.factureOrigineId === f.id);
  return {
    totalHt: f.totalHt - avoirs.reduce((s, a) => s + a.totalHt, 0),
    montantTva: f.montantTva - avoirs.reduce((s, a) => s + a.montantTva, 0),
    totalTtc: f.totalTtc - avoirs.reduce((s, a) => s + a.totalTtc, 0),
  };
}

const facturesDuDossier = (db: Lecteur, dossierId: number): Promise<FactureDossier[]> =>
  db
    .select({ id: schema.facture.id, numero: schema.facture.numero, type: schema.facture.type, factureOrigineId: schema.facture.factureOrigineId, totalHt: schema.facture.totalHt, montantTva: schema.facture.montantTva, totalTtc: schema.facture.totalTtc })
    .from(schema.facture)
    .where(eq(schema.facture.dossierId, dossierId))
    .orderBy(asc(schema.facture.id));

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * RG-18 : appelée **dans la transaction** de la clôture de la recherche. Calcule le montant final
 * (commission figée × placements retenus par ligne de poste, hors remplacements ; TVA au taux figé
 * du devis), le compare à l'acompte facturé et émet la facture de solde ou l'avoir sur la facture
 * d'acompte. Sans devis accepté, n'émet rien et le signale.
 */
export async function facturerCloture(tx: Tx, dossierId: number, auteur: AuteurEffet): Promise<ResultatFacturation> {
  const facturables = await lireLignesFacturables(tx, dossierId);
  if (!facturables) return { montantFinal: null, acompteFactureTtc: 0, sansDevis: true, avertissements: ['Aucun devis accepté sur ce dossier : aucune facture de solde n’est émise.'] };
  const { devis, lignes } = facturables;
  const avertissements: string[] = [];

  const placements = await tx
    .select({ lignePosteId: schema.placement.lignePosteId, statut: schema.placement.statut, remplacement: schema.placement.remplacement })
    .from(schema.placement)
    .where(eq(schema.placement.dossierId, dossierId));
  const intitules = new Map((await tx.select({ id: schema.lignePoste.id, intitule: schema.lignePoste.intitule }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId))).map((l) => [l.id, l.intitule]));
  const parLigne = lignes
    .filter((l) => l.lignePosteId !== null)
    .map((l) => ({ ...l, placementsRetenus: compterPlacementsRetenus(placements.filter((p) => p.lignePosteId === l.lignePosteId)) }));
  // Placements sur une ligne de poste absente du devis et de ses avenants : pas de commission figée.
  const connues = new Set(parLigne.map((l) => l.lignePosteId));
  for (const id of new Set(placements.map((p) => p.lignePosteId))) {
    const n = compterPlacementsRetenus(placements.filter((p) => p.lignePosteId === id));
    if (!connues.has(id) && n > 0) avertissements.push(`« ${intitules.get(id) ?? `ligne ${id}`} » : ${pluriel(n, 'placement')} hors devis, non facturé(s) (avenant nécessaire).`);
  }
  const final = montantFinal(parLigne, devis.tauxTva);
  const placementsTotal = parLigne.reduce((s, l) => s + l.placementsRetenus, 0);

  const factures = await facturesDuDossier(tx, dossierId);
  const acomptes = factures.filter((f) => f.type === 'acompte').map((f) => ({ f, r: restant(f, factures) }));
  const acompte = acomptes.reduce((s, a) => ({ totalHt: s.totalHt + a.r.totalHt, montantTva: s.montantTva + a.r.montantTva, totalTtc: s.totalTtc + a.r.totalTtc }), { totalHt: 0, montantTva: 0, totalTtc: 0 });
  const resultat: ResultatFacturation = { montantFinal: { ...final, placements: placementsTotal }, acompteFactureTtc: acompte.totalTtc, avertissements };
  const reg = regularisation(final.totalTtc, acompte.totalTtc);
  const refAcomptes = acomptes.map((a) => a.f.numero).join(', ');
  const libelleFinal = `Montant final : ${pluriel(placementsTotal, 'placement confirmé')} (devis ${devis.numero})`;

  if (reg.type === 'solde') {
    const lignesFacture = parLigne
      .filter((l) => l.placementsRetenus > 0)
      .map((l) => ({ libelle: `${l.intitule} — ${pluriel(l.placementsRetenus, 'placement confirmé')}`, quantite: l.placementsRetenus, prixUnitaire: l.commission, montantHt: l.commission * l.placementsRetenus }));
    if (acompte.totalHt > 0) lignesFacture.push({ libelle: `Déduction de l’acompte facturé (${refAcomptes})`, quantite: 1, prixUnitaire: -acompte.totalHt, montantHt: -acompte.totalHt });
    resultat.facture = {
      ...(await emettreFacture(
        tx,
        {
          type: 'solde',
          dossierId,
          devisId: devis.id,
          libelle: `Solde du devis ${devis.numero} (version ${devis.version}) à la clôture de la recherche — ${libelleFinal.charAt(0).toLowerCase()}${libelleFinal.slice(1)}, soit ${formaterMontant(final.totalTtc)}, moins l’acompte facturé de ${formaterMontant(acompte.totalTtc)}.`,
          lignes: lignesFacture,
          tauxTva: devis.tauxTva,
          totalHt: final.totalHt - acompte.totalHt,
          montantTva: final.montantTva - acompte.montantTva,
          totalTtc: reg.montantTtc,
        },
        auteur,
      )),
      type: 'solde',
      totalTtc: reg.montantTtc,
    };
  } else if (reg.type === 'avoir') {
    // Avoir de la différence sur la (dernière) facture d'acompte.
    const origine = acomptes.at(-1)!.f;
    const totalHt = acompte.totalHt - final.totalHt;
    const montantTva = acompte.montantTva - final.montantTva;
    resultat.facture = {
      ...(await emettreFacture(
        tx,
        {
          type: 'avoir',
          dossierId,
          devisId: devis.id,
          factureOrigineId: origine.id,
          libelle: `Régularisation à la clôture de la recherche : ${libelleFinal.charAt(0).toLowerCase()}${libelleFinal.slice(1)}, soit ${formaterMontant(final.totalTtc)}, inférieur à l’acompte facturé de ${formaterMontant(acompte.totalTtc)} (${refAcomptes}).`,
          lignes: [{ libelle: `Trop-perçu sur l’acompte (${refAcomptes}) — montant final ${formaterMontant(final.totalTtc)}`, quantite: 1, prixUnitaire: totalHt, montantHt: totalHt }],
          tauxTva: devis.tauxTva,
          totalHt,
          montantTva,
          totalTtc: reg.montantTtc,
        },
        auteur,
      )),
      type: 'avoir',
      totalTtc: reg.montantTtc,
    };
  }
  await journaliser(
    { ...auditDe(auteur), action: 'dossier.montant_final', objetType: 'dossier', objetId: dossierId, apres: { ...resultat.montantFinal, acompteFactureTtc: acompte.totalTtc, regularisation: reg }, details: { devisId: devis.id, facture: resultat.facture?.numero ?? null, avertissements } },
    tx,
  );
  return resultat;
}

/** Archive le PDF d'une facture sans faire échouer l'opération appelante (journalisé en console). */
export async function archiverPdfFactureSansEchec(factureId: number): Promise<number | null> {
  try {
    return await archiverPdfFacture(factureId);
  } catch (e) {
    console.error(`Archivage du PDF de la facture ${factureId} impossible :`, e);
    return null;
  }
}

// ─── Avoir de correction (RG-17, ADR 0020) ───────────────────

export const MESSAGE_DIRECTION_AVOIR = 'Seule la Direction peut émettre un avoir de correction.';

export interface ActeurFacture extends Demandeur {
  ip?: string | null;
}

/**
 * RG-17 : une facture émise ne se modifie pas ; une erreur se corrige par un **avoir** (Direction).
 * Montant : total de la facture d'origine, diminué des avoirs déjà émis sur elle (une facture
 * n'est jamais créditée au-delà de son montant). Le PDF est archivé après la transaction.
 */
export async function emettreAvoirCorrection(factureId: number, motif: string, a: ActeurFacture): Promise<{ id: number; numero: string }> {
  if (!a.roles.includes('direction')) throw new ErreurMetier(MESSAGE_DIRECTION_AVOIR);
  const m = motif.trim().slice(0, 500);
  if (!m) throw new ErreurMetier('Indiquez le motif de la correction.');
  const auteur: AuteurEffet = { type: 'collaborateur', id: a.id, ip: a.ip ?? null };
  const emis = await getDb().transaction(async (tx) => {
    const [f] = await tx.select().from(schema.facture).where(eq(schema.facture.id, factureId));
    if (!f) throw new ErreurMetier('Facture introuvable.');
    if (f.type === 'avoir') throw new ErreurMetier('Un avoir ne se corrige pas par un avoir.');
    // Verrou du Dossier : deux corrections simultanées ne créditent pas deux fois la facture.
    await tx.select({ id: schema.dossier.id }).from(schema.dossier).where(eq(schema.dossier.id, f.dossierId)).for('update');
    const factures = await facturesDuDossier(tx, f.dossierId);
    const r = restant(f, factures);
    if (r.totalTtc <= 0) throw new ErreurMetier(`La facture ${f.numero} est déjà intégralement créditée.`);
    const montants = r.totalTtc === f.totalTtc ? { totalHt: f.totalHt, montantTva: f.montantTva, totalTtc: f.totalTtc } : decomposerTtc(r.totalTtc, f.tauxTva);
    const avoir = await emettreFacture(
      tx,
      {
        type: 'avoir',
        dossierId: f.dossierId,
        devisId: f.devisId,
        factureOrigineId: f.id,
        libelle: `Avoir de correction de la ${TYPES_FACTURE[f.type].toLowerCase()} ${f.numero} — motif : ${m}`,
        lignes: [{ libelle: `Annulation de la facture ${f.numero}${r.totalTtc === f.totalTtc ? '' : ' (solde non encore crédité)'}`, quantite: 1, prixUnitaire: montants.totalHt, montantHt: montants.totalHt }],
        tauxTva: f.tauxTva,
        ...montants,
      },
      auteur,
    );
    await journaliser({ ...auditDe(auteur), action: 'facture.avoir_correction', objetType: 'facture', objetId: f.id, apres: { avoir: avoir.numero, totalTtc: montants.totalTtc }, details: { motif: m } }, tx);
    return avoir;
  });
  await archiverPdfFactureSansEchec(emis.id);
  return emis;
}

// ─── Lectures et actions Back-Office ─────────────────────────

export interface VueFacture {
  id: number;
  numero: string;
  type: TypeFacture;
  libelle: string;
  emiseLe: Date;
  totalTtc: number;
  factureOrigine: string | null;
  /** Document archivé (PDF), s'il existe. */
  documentId: number | null;
  /** Montant restant à créditer (factures hors avoirs) : un avoir de correction est possible si > 0. */
  restantTtc: number;
}

/** Factures et avoirs d'un Dossier (droits de consultation du Dossier). */
export async function listerFactures(dossierId: number, a: Demandeur): Promise<VueFacture[]> {
  const [d] = await getDb().select({ referentId: schema.dossier.referentId }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (!d) return [];
  if (!peutVoir(a, d.referentId)) throw new ErreurAccesDossier();
  const lignes = await getDb()
    .select({ f: schema.facture, documentId: schema.facturePdf.documentId })
    .from(schema.facture)
    .leftJoin(schema.facturePdf, eq(schema.facturePdf.factureId, schema.facture.id))
    .where(eq(schema.facture.dossierId, dossierId))
    .orderBy(asc(schema.facture.id));
  const toutes = lignes.map((l) => l.f);
  const numeros = new Map(toutes.map((f) => [f.id, f.numero]));
  return lignes.map(({ f, documentId }) => ({
    id: f.id,
    numero: f.numero,
    type: f.type,
    libelle: f.libelle,
    emiseLe: f.emiseLe,
    totalTtc: f.totalTtc,
    factureOrigine: f.factureOrigineId ? (numeros.get(f.factureOrigineId) ?? null) : null,
    documentId: documentId ?? null,
    restantTtc: f.type === 'avoir' ? 0 : restant(f, toutes).totalTtc,
  }));
}

/** « Générer le PDF » depuis le Back-Office (référent du Dossier, Direction ou Finances). */
export async function genererPdfFactureBackOffice(factureId: number, a: Demandeur): Promise<number> {
  const [f] = await getDb()
    .select({ dossierId: schema.facture.dossierId, referentId: schema.dossier.referentId })
    .from(schema.facture)
    .innerJoin(schema.dossier, eq(schema.dossier.id, schema.facture.dossierId))
    .where(eq(schema.facture.id, factureId));
  if (!f) throw new ErreurMetier('Facture introuvable.');
  if (!peutTraiter(a, f.referentId) && !a.roles.includes('finances')) throw new ErreurAccesDossier();
  return archiverPdfFacture(factureId);
}
