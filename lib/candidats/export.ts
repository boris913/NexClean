// Export « Mes données » de l'espace candidat (ADR 0017 §6, specs/POST-04 RG-09..14) : lecture des
// données du seul candidat connecté, limite de fréquence, journalisation, rendu JSON ou PDF.
// Indépendant de Next.js : la session est contrôlée par l'appelant (route de l'espace candidat).
import { and, asc, count, desc, eq, gte, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { COMPANY, CONTACT } from '@/lib/constants';
import { lireParametre } from '@/lib/parametres';
import { listerPropositionsCandidat } from '@/lib/propositions/candidat';
import { construireExport, MAX_EXPORTS_PAR_JOUR, MESSAGE_LIMITE_EXPORT, nomFichierExport, type ExportDonnees, type FormatExport, type LignesExport } from './donnees';
import { pdfMesDonnees } from './donnees-pdf';

const JOUR_MS = 24 * 60 * 60 * 1000;
export const ACTION_EXPORT = 'candidat.export_donnees';

/** Lit en base tout ce que l'export contient, pour ce candidat uniquement (RG-11). */
export async function lireDonneesCandidat(candidatId: number): Promise<LignesExport> {
  const db = getDb();
  const [c] = await db.select().from(schema.candidat).where(eq(schema.candidat.id, candidatId));
  if (!c || c.supprimeLe) throw new ErreurMetier('Compte introuvable.');
  const noms = async (table: typeof schema.arrondissement | typeof schema.quartier, ids: number[]) =>
    ids.length ? (await db.select({ nom: table.nom }).from(table).where(inArray(table.id, ids))).map((x) => x.nom) : [];
  const nom = async (table: typeof schema.ville | typeof schema.arrondissement | typeof schema.quartier, id: number | null) =>
    id ? ((await db.select({ nom: table.nom }).from(table).where(eq(table.id, id)))[0]?.nom ?? null) : null;

  const [ville, arrondissement, quartier, zonesArr, zonesQuartiers, consentements, experiences, documents, candidatures, propositions, accords, placements, notifications] = await Promise.all([
    nom(schema.ville, c.villeId),
    nom(schema.arrondissement, c.arrondissementId),
    nom(schema.quartier, c.quartierId),
    noms(schema.arrondissement, c.zonesArrondissementIds),
    noms(schema.quartier, c.zonesQuartierIds),
    db
      .select({ type: schema.candidatConsentement.type, version: schema.candidatConsentement.version, canal: schema.candidatConsentement.canal, ip: schema.candidatConsentement.ip, horodatage: schema.candidatConsentement.horodatage })
      .from(schema.candidatConsentement)
      .where(eq(schema.candidatConsentement.candidatId, candidatId))
      .orderBy(asc(schema.candidatConsentement.horodatage), asc(schema.candidatConsentement.id)),
    db
      .select({ poste: schema.candidatExperience.poste, employeur: schema.candidatExperience.employeur, ville: schema.candidatExperience.ville, duree: schema.candidatExperience.duree, missions: schema.candidatExperience.missions })
      .from(schema.candidatExperience)
      .where(eq(schema.candidatExperience.candidatId, candidatId))
      .orderBy(asc(schema.candidatExperience.ordre)),
    db
      .select({ categorie: schema.candidatDocument.categorie, nomOrigine: schema.candidatDocument.nomOrigine, taille: schema.candidatDocument.taille, creeLe: schema.candidatDocument.creeLe })
      .from(schema.candidatDocument)
      .where(eq(schema.candidatDocument.candidatId, candidatId))
      .orderBy(asc(schema.candidatDocument.creeLe)),
    db
      .select({ offreTitre: schema.candidature.offreTitre, offreSlug: schema.candidature.offreSlug, motivation: schema.candidature.motivation, statut: schema.candidature.statut, creeLe: schema.candidature.creeLe })
      .from(schema.candidature)
      .where(eq(schema.candidature.candidatId, candidatId))
      .orderBy(desc(schema.candidature.creeLe)),
    // Même lecture que l'espace candidat : rien de plus n'est révélé (retours client, motifs internes).
    listerPropositionsCandidat(candidatId),
    db
      .select({ id: schema.proposition.id, accordMode: schema.proposition.accordMode, accordLe: schema.proposition.accordLe })
      .from(schema.proposition)
      .where(eq(schema.proposition.candidatId, candidatId)),
    db
      .select({
        propositionId: schema.placement.propositionId,
        poste: schema.placement.poste,
        client: schema.client.nom,
        statut: schema.placement.statut,
        datePrevue: schema.placement.datePrevue,
        datePriseDePoste: schema.placement.datePriseDePoste,
        finLe: schema.placement.finLe,
      })
      .from(schema.placement)
      .innerJoin(schema.proposition, eq(schema.proposition.id, schema.placement.propositionId))
      .innerJoin(schema.client, eq(schema.client.id, schema.proposition.clientId))
      .where(eq(schema.placement.candidatId, candidatId))
      .orderBy(asc(schema.placement.creeLe), asc(schema.placement.id)),
    db
      .select({ titre: schema.notificationCandidat.titre, texte: schema.notificationCandidat.texte, creeLe: schema.notificationCandidat.creeLe, luLe: schema.notificationCandidat.luLe })
      .from(schema.notificationCandidat)
      .where(eq(schema.notificationCandidat.candidatId, candidatId))
      .orderBy(desc(schema.notificationCandidat.creeLe), desc(schema.notificationCandidat.id)),
  ]);
  const accordDe = new Map(accords.map((a) => [a.id, a]));

  return {
    candidat: {
      id: c.id,
      nom: c.nom,
      prenom: c.prenom,
      telephone: c.telephone,
      whatsapp: c.whatsapp,
      email: c.email,
      ville: ville ?? c.villeAutre,
      arrondissement,
      quartier: quartier ?? c.quartierAutre,
      repere: c.repere,
      zonesTouteVille: c.zonesTouteVille,
      zones: [...zonesArr, ...zonesQuartiers],
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
      enRecherche: c.statut !== 'indisponible' && c.statut !== 'place',
      canalInscription: c.canalInscription,
      creeLe: c.creeLe,
      profilMisAJourLe: c.profilMisAJourLe,
      derniereConnexionLe: c.derniereConnexionLe,
    },
    consentements,
    experiences,
    documents,
    candidatures,
    propositions: [...propositions.enAttente, ...propositions.historique].map((x) => ({
      id: x.id,
      poste: x.poste,
      client: x.client,
      libelleStatut: x.libelleStatut,
      secteur: x.secteur,
      ville: [x.quartier, x.ville].filter(Boolean).join(', ') || null,
      typeContrat: x.typeContrat,
      salaire: x.salaire,
      creeLe: x.creeLe,
      accordMode: accordDe.get(x.id)?.accordMode ?? null,
      accordLe: accordDe.get(x.id)?.accordLe ?? null,
      reponseLe: x.reponseLe,
      numeroCommunicable: x.numeroCommunicable,
      entretienLe: x.entretienLe,
      entretienLieu: x.entretienLieu,
    })),
    placements,
    notifications,
  };
}

const RESPONSABLE = { nom: COMPANY.legalName, contact: `${CONTACT.email} — WhatsApp ${CONTACT.phoneDisplay}` };

/** L'export complet (objet JSON), sans contrôle de fréquence ni journalisation. */
export async function construireExportCandidat(candidatId: number, maintenant = new Date()): Promise<ExportDonnees> {
  return construireExport(await lireDonneesCandidat(candidatId), maintenant, RESPONSABLE);
}

export interface FichierExport {
  nom: string;
  mime: string;
  octets: Uint8Array;
}

/**
 * RG-09..14 : export demandé par le candidat connecté. Au plus `MAX_EXPORTS_PAR_JOUR` sur 24 h
 * glissantes (compté dans le journal) ; chaque export est journalisé avec son format.
 */
export async function exporterDonnees(candidatId: number, format: FormatExport, ip: string | null, maintenant = new Date()): Promise<FichierExport> {
  const j = schema.journalAudit;
  const [deja] = await getDb()
    .select({ n: count() })
    .from(j)
    .where(and(eq(j.action, ACTION_EXPORT), eq(j.objetType, 'candidat'), eq(j.objetId, String(candidatId)), gte(j.horodatage, new Date(maintenant.getTime() - JOUR_MS))));
  if ((deja?.n ?? 0) >= MAX_EXPORTS_PAR_JOUR) throw new ErreurMetier(MESSAGE_LIMITE_EXPORT);
  const donnees = await construireExportCandidat(candidatId, maintenant);
  const fichier: FichierExport =
    format === 'json'
      ? { nom: nomFichierExport('json', maintenant), mime: 'application/json; charset=utf-8', octets: new TextEncoder().encode(JSON.stringify(donnees, null, 2)) }
      : { nom: nomFichierExport('pdf', maintenant), mime: 'application/pdf', octets: await pdfMesDonnees(donnees, await lireParametre('mentions_legales')) };
  await journaliser({ acteurType: 'candidat', acteurId: String(candidatId), ip, action: ACTION_EXPORT, objetType: 'candidat', objetId: candidatId, details: { format, taille: fichier.octets.byteLength } });
  return fichier;
}
