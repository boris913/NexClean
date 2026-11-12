// Base de connaissances de l'agent (specs/COM3-02 RG-03) : administrée par la Direction, chaque
// modification est versionnée et journalisée. Les faits tirés du système (services, villes,
// horaires, garantie) sont ajoutés automatiquement : ils ne peuvent pas diverger de la réalité.
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { journaliser } from '@/lib/audit';
import { ErreurMetier } from '@/lib/collaborateurs/service';
import { lireParametre } from '@/lib/parametres';
import { couverturePublique } from '@/lib/geo/service';
import { services } from '@/content/services-data';
import { libelleHoraires } from '@/lib/whatsapp/automate';
import { contientMontant } from './controle';

export const schemaConnaissance = z.object({
  titre: z.string().trim().min(3, 'Titre trop court').max(120),
  contenu: z.string().trim().min(10, 'Contenu trop court').max(4000, '4 000 caractères maximum'),
  ordre: z.number().int().min(0).max(999).default(0),
  actif: z.boolean().default(true),
});

export async function listerConnaissances() {
  return getDb().select().from(schema.connaissance).orderBy(asc(schema.connaissance.ordre), asc(schema.connaissance.id));
}

/** Création ou modification (version + 1), journalisée. Aucun prix : l'agent n'en cite que par l'estimation. */
export async function enregistrerConnaissance(id: number | null, entree: z.input<typeof schemaConnaissance>, a: { id: string; ip?: string | null }): Promise<number> {
  const c = schemaConnaissance.parse(entree);
  if (contientMontant(c.contenu)) throw new ErreurMetier('Pas de prix dans la base de connaissances : l’agent ne cite que l’estimation calculée par le serveur.');
  return getDb().transaction(async (tx) => {
    if (id === null) {
      const [r] = await tx.insert(schema.connaissance).values({ ...c, majPar: a.id }).returning({ id: schema.connaissance.id });
      await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'agent.connaissance_creee', objetType: 'connaissance', objetId: r!.id, apres: c }, tx);
      return r!.id;
    }
    const [avant] = await tx.select().from(schema.connaissance).where(eq(schema.connaissance.id, id)).for('update');
    if (!avant) throw new ErreurMetier('Fiche introuvable.');
    await tx.update(schema.connaissance).set({ ...c, version: avant.version + 1, majLe: new Date(), majPar: a.id }).where(eq(schema.connaissance.id, id));
    await journaliser({ acteurType: 'collaborateur', acteurId: a.id, ip: a.ip ?? null, action: 'agent.connaissance_modifiee', objetType: 'connaissance', objetId: id, avant: { titre: avant.titre, contenu: avant.contenu, actif: avant.actif, version: avant.version }, apres: { ...c, version: avant.version + 1 } }, tx);
    return id;
  });
}

/** Version globale de la base (somme des versions des fiches actives) : tracée avec chaque réponse. */
export async function versionBase(): Promise<string> {
  const fiches = await listerConnaissances();
  return `kb-${fiches.filter((f) => f.actif).reduce((s, f) => s + f.version * 1000 + f.id, 0)}`;
}

/** Texte de la base remis à l'agent : faits du système puis fiches actives de la Direction. */
export async function texteBase(): Promise<string> {
  const [fiches, horaires, garantie, couverture] = await Promise.all([listerConnaissances(), lireParametre('heures_ouvrees'), lireParametre('garantie_jours'), couverturePublique().catch(() => ({ villes: [] as string[], quartiers: [] as { ville: string; noms: string[] }[] }))]);
  const faits = [
    `## Services\n${services.map((s) => `- ${s.name} : ${s.description}`).join('\n')}`,
    `## Villes et quartiers couverts\nVilles : ${couverture.villes.join(', ') || 'Douala, Yaoundé'}.${couverture.quartiers.map((q) => `\n${q.ville} : ${q.noms.join(', ')}`).join('')}\nAilleurs : à étudier par un conseiller (frais de déplacement possibles).`,
    `## Horaires\n${libelleHoraires(horaires)}.`,
    `## Garantie de remplacement (recrutement)\nSi la personne placée quitte son poste ou ne convient pas dans les ${garantie} jours suivant la prise de poste, NEXCLEAN propose un remplacement.`,
  ];
  const direction = fiches.filter((f) => f.actif).map((f) => `## ${f.titre}\n${f.contenu}`);
  return [...faits, ...direction].join('\n\n');
}
