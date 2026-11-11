// Bibliothèque de modèles de messages WhatsApp (MVP1-05 RG-14..17).
// Le contrôle des droits (modeles.gerer) est fait par l'appelant.
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { DOSSIER_TYPE_CODES, DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { ErreurMetier, type Auteur } from '@/lib/collaborateurs/service';
import { formaterTelephone } from '@/lib/telephone';
import { formaterMontant } from '@/lib/devis/domaine';
import { encaissementsNets } from '@/lib/encaissements/domaine';
import { estModeleCandidat, estModeleDevis, estModeleProposition, estModeleSolde, variableInconnue, VARIABLES, type ContexteMessage } from './variables';

export const schemaModele = z.object({
  nom: z.string().trim().min(2, 'Nom trop court').max(80),
  types: z.array(z.enum(DOSSIER_TYPE_CODES)).max(DOSSIER_TYPE_CODES.length).default([]),
  langue: z.string().trim().min(2).max(5).default('fr'),
  texte: z.string().trim().min(5, 'Texte trop court').max(2000, '2 000 caractères maximum'),
  actif: z.boolean().default(true),
  // COM2-02 RG-03 : nom et langue du modèle Meta correspondant, et variables passées en {{1}}, {{2}}…
  metaNom: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, 'Nom Meta : minuscules, chiffres et « _ » uniquement').nullable().optional().transform((v) => v || null),
  metaLangue: z.string().trim().min(2).max(10).default('fr'),
  metaParametres: z.array(z.string()).max(20).default([]),
});

function verifierTexte(texte: string, parametres: string[] = []) {
  const v = variableInconnue(texte);
  if (v !== null) throw new ErreurMetier(`Variable inconnue : ${v}`);
  const p = parametres.find((x) => !(x in VARIABLES));
  if (p) throw new ErreurMetier(`Paramètre Meta inconnu : ${p}`);
}

/**
 * Avec `type` (fiche dossier), les modèles candidat, proposition et devis (variables `candidat.*`, `devis.*`…) sont exclus ;
 * les modèles de relance de solde (`solde.*`, MVP2-05 RG-09) ne sont proposés que si `soldeImpaye` est vrai
 * (voir `contexteDossier` : `solde.facture` renseigné).
 */
export async function listerModeles(options: { type?: DossierType; actifsSeulement?: boolean; soldeImpaye?: boolean } = {}) {
  const tous = await getDb().select().from(schema.modeleMessage).orderBy(asc(schema.modeleMessage.nom));
  return tous.filter(
    (m) =>
      (!options.actifsSeulement || m.actif) &&
      (!options.type || ((m.types.length === 0 || m.types.includes(options.type)) && !estModeleCandidat(m.texte) && !estModeleProposition(m.texte) && !estModeleDevis(m.texte) && (!estModeleSolde(m.texte) || !!options.soldeImpaye))),
  );
}

export async function enregistrerModele(id: number | null, entree: z.input<typeof schemaModele>, auteur: Auteur): Promise<number> {
  const m = schemaModele.parse(entree);
  verifierTexte(m.texte, m.metaParametres);
  return getDb().transaction(async (tx) => {
    const [doublon] = await tx.select({ id: schema.modeleMessage.id }).from(schema.modeleMessage).where(eq(schema.modeleMessage.nom, m.nom));
    if (doublon && doublon.id !== id) throw new ErreurMetier('Un modèle porte déjà ce nom.');
    if (id === null) {
      const [r] = await tx.insert(schema.modeleMessage).values({ ...m, modifiePar: auteur.id }).returning({ id: schema.modeleMessage.id });
      await journaliser({ acteurType: 'collaborateur', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'modele.cree', objetType: 'modele_message', objetId: r!.id, apres: m }, tx);
      return r!.id;
    }
    const [avant] = await tx.select().from(schema.modeleMessage).where(eq(schema.modeleMessage.id, id)).for('update');
    if (!avant) throw new ErreurMetier('Modèle introuvable.');
    await tx.update(schema.modeleMessage).set({ ...m, modifieLe: new Date(), modifiePar: auteur.id }).where(eq(schema.modeleMessage.id, id));
    await journaliser({ acteurType: 'collaborateur', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'modele.modifie', objetType: 'modele_message', objetId: id, avant: { nom: avant.nom, types: avant.types, texte: avant.texte, actif: avant.actif }, apres: m }, tx);
    return id;
  });
}

const formaterDateLongue = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'long' }).format(d);

/** MVP2-05 RG-09 : dernière facture de solde du Dossier et reste à payer (montant final − encaissements nets) ; null si rien d'impayé. */
export async function soldeImpaye(dossierId: number): Promise<{ facture: string; emiseLe: Date; reste: number } | null> {
  const db = getDb();
  const [d] = await db.select({ montantFinalTtc: schema.dossier.montantFinalTtc }).from(schema.dossier).where(eq(schema.dossier.id, dossierId));
  if (d?.montantFinalTtc == null) return null;
  const [f] = await db
    .select({ numero: schema.facture.numero, emiseLe: schema.facture.emiseLe })
    .from(schema.facture)
    .where(and(eq(schema.facture.dossierId, dossierId), eq(schema.facture.type, 'solde')))
    .orderBy(desc(schema.facture.emiseLe), desc(schema.facture.id))
    .limit(1);
  if (!f) return null;
  const ecritures = await db.select({ montant: schema.encaissement.montant }).from(schema.encaissement).where(eq(schema.encaissement.dossierId, dossierId));
  const reste = d.montantFinalTtc - encaissementsNets(ecritures.map((e, i) => ({ id: i, type: 'encaissement' as const, nature: 'autre' as const, montant: e.montant })));
  return reste > 0 ? { facture: f.numero, emiseLe: f.emiseLe, reste } : null;
}

/** Valeurs des variables pour un dossier (sans budget ni salaire). */
export async function contexteDossier(dossierId: number, utilisateurCourant: { id: string; nom: string }): Promise<ContexteMessage> {
  const db = getDb();
  const [d] = await db
    .select({ numero: schema.dossier.numero, type: schema.dossier.type, jeton: schema.dossier.jetonSuivi, referentId: schema.dossier.referentId, villeNom: schema.ville.nom, villeAutre: schema.dossier.villeAutre, clientNom: schema.client.nom, contact: schema.client.contact })
    .from(schema.dossier)
    .innerJoin(schema.client, eq(schema.client.id, schema.dossier.clientId))
    .leftJoin(schema.ville, eq(schema.ville.id, schema.dossier.villeId))
    .where(eq(schema.dossier.id, dossierId));
  if (!d) throw new ErreurMetier('Dossier introuvable.');
  const referentId = d.referentId ?? utilisateurCourant.id;
  const [ref] = await db
    .select({ nom: schema.user.name, telephone: schema.collaborateurProfil.telephone })
    .from(schema.user)
    .leftJoin(schema.collaborateurProfil, eq(schema.collaborateurProfil.userId, schema.user.id))
    .where(eq(schema.user.id, referentId));
  const lignes = d.type === 'REC' ? await db.select({ intitule: schema.lignePoste.intitule, nombre: schema.lignePoste.nombre }).from(schema.lignePoste).where(eq(schema.lignePoste.dossierId, dossierId)).orderBy(asc(schema.lignePoste.ordre)) : [];
  const nomRef = ref?.nom ?? utilisateurCourant.nom;
  const solde = d.type === 'REC' ? await soldeImpaye(dossierId) : null;
  return {
    'client.contact': d.contact ?? d.clientNom,
    'client.nom': d.clientNom,
    'dossier.numero': d.numero,
    'dossier.type': DOSSIER_TYPES[d.type],
    'dossier.ville': d.villeNom ?? d.villeAutre ?? '',
    'dossier.lien_suivi': `${env().BETTER_AUTH_URL}/suivi/${d.jeton}`,
    'referent.prenom': nomRef.split(/\s+/)[0] ?? nomRef,
    'referent.telephone': ref?.telephone ? formaterTelephone(ref.telephone) : '',
    'postes.resume': lignes.map((l) => `${l.nombre} × ${l.intitule}`).join(', '),
    ...(solde ? { 'solde.facture': solde.facture, 'solde.emise_le': formaterDateLongue(solde.emiseLe), 'solde.reste': formaterMontant(solde.reste) } : {}),
  };
}
