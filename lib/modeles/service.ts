// Bibliothèque de modèles de messages WhatsApp (MVP1-05 RG-14..17).
// Le contrôle des droits (modeles.gerer) est fait par l'appelant.
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { env } from '@/lib/env';
import { DOSSIER_TYPE_CODES, DOSSIER_TYPES, type DossierType } from '@/lib/domain/referentiels';
import { ErreurMetier, type Auteur } from '@/lib/collaborateurs/service';
import { formaterTelephone } from '@/lib/telephone';
import { estModeleCandidat, variableInconnue, type ContexteMessage } from './variables';

export const schemaModele = z.object({
  nom: z.string().trim().min(2, 'Nom trop court').max(80),
  types: z.array(z.enum(DOSSIER_TYPE_CODES)).max(DOSSIER_TYPE_CODES.length).default([]),
  langue: z.string().trim().min(2).max(5).default('fr'),
  texte: z.string().trim().min(5, 'Texte trop court').max(2000, '2 000 caractères maximum'),
  actif: z.boolean().default(true),
});

function verifierTexte(texte: string) {
  const v = variableInconnue(texte);
  if (v !== null) throw new ErreurMetier(`Variable inconnue : ${v}`);
}

/** Avec `type` (fiche dossier), les modèles candidat (variables `candidat.*`) sont exclus. */
export async function listerModeles(options: { type?: DossierType; actifsSeulement?: boolean } = {}) {
  const tous = await getDb().select().from(schema.modeleMessage).orderBy(asc(schema.modeleMessage.nom));
  return tous.filter((m) => (!options.actifsSeulement || m.actif) && (!options.type || ((m.types.length === 0 || m.types.includes(options.type)) && !estModeleCandidat(m.texte))));
}

export async function enregistrerModele(id: number | null, entree: z.input<typeof schemaModele>, auteur: Auteur): Promise<number> {
  const m = schemaModele.parse(entree);
  verifierTexte(m.texte);
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
  };
}
