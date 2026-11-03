// Paramètres administrables par Direction / Administrateur (MVP1-03 RG-05).
// La grille tarifaire complète arrive en MVP-2 ; en MVP-1 la commission est un montant unique.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import type { Auteur } from '@/lib/collaborateurs/service';

/** ADR 0008 : 5 000 FCFA par personne placée. */
export const COMMISSION_PAR_DEFAUT = 5000;

export const METIERS_PAR_DEFAUT = [
  'Agent d’entretien',
  'Femme / homme de ménage',
  'Nounou',
  'Cuisinier(ère)',
  'Aide-cuisinier(ère)',
  'Serveur(se)',
  'Barman / barmaid',
  'Réceptionniste',
  'Femme / valet de chambre',
  'Gardien / vigile',
  'Chauffeur',
  'Livreur',
  'Caissier(ère)',
  'Vendeur(se)',
  'Magasinier',
  'Manutentionnaire',
  'Jardinier',
  'Secrétaire',
  'Assistant(e) administratif(ve)',
  'Commercial(e)',
  'Aide-soignant(e)',
  'Technicien de maintenance',
];

const DEFINITIONS = {
  commission_par_personne: { defaut: COMMISSION_PAR_DEFAUT, schema: z.number().int('Montant entier').min(0).max(1_000_000) },
  metiers: {
    defaut: METIERS_PAR_DEFAUT,
    schema: z.array(z.string().trim().min(2).max(80)).max(200).transform((l) => [...new Set(l)]),
  },
} as const;

export type CleParametre = keyof typeof DEFINITIONS;
type Valeur<K extends CleParametre> = z.output<(typeof DEFINITIONS)[K]['schema']>;

export async function lireParametre<K extends CleParametre>(cle: K): Promise<Valeur<K>> {
  const [ligne] = await getDb().select({ valeur: schema.parametre.valeur }).from(schema.parametre).where(eq(schema.parametre.cle, cle));
  if (!ligne) return DEFINITIONS[cle].defaut as Valeur<K>;
  const lu = DEFINITIONS[cle].schema.safeParse(ligne.valeur);
  return (lu.success ? lu.data : DEFINITIONS[cle].defaut) as Valeur<K>;
}

/** Le contrôle des droits (tarifs.modifier) est fait par l'appelant. */
export async function definirParametre<K extends CleParametre>(cle: K, valeur: unknown, auteur: Auteur): Promise<void> {
  const nouvelle = DEFINITIONS[cle].schema.parse(valeur);
  await getDb().transaction(async (tx) => {
    const [avant] = await tx.select().from(schema.parametre).where(eq(schema.parametre.cle, cle)).for('update');
    await tx
      .insert(schema.parametre)
      .values({ cle, valeur: nouvelle, modifieLe: new Date(), modifiePar: auteur.id })
      .onConflictDoUpdate({ target: schema.parametre.cle, set: { valeur: nouvelle, modifieLe: new Date(), modifiePar: auteur.id } });
    await journaliser(
      { acteurType: auteur.id ? 'collaborateur' : 'systeme', acteurId: auteur.id, ip: auteur.ip ?? null, action: 'parametre.modifie', objetType: 'parametre', objetId: cle, avant: avant?.valeur ?? DEFINITIONS[cle].defaut, apres: nouvelle },
      tx,
    );
  });
}
