// Migration 0008 rejouée sur une base peuplée comme la production avant MVP2-02 : référentiel
// créé sans coordonnées, un quartier déjà géolocalisé à la main, un modèle candidat déjà modifié.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { baseDisponible, configurerEnvironnementTest, reinitialiserBase } from './aide';

configurerEnvironnementTest();

describe.skipIf(!baseDisponible)('Migration 0008 — modèles candidat et centroïdes (intégration)', async () => {
  const { and, eq, isNotNull, sql } = await import('drizzle-orm');
  const { getDb, schema } = await import('@/lib/db');
  const geo = await import('@/lib/geo/service');
  const { CENTROIDES_INITIAUX } = await import('@/lib/geo/donnees-initiales');

  const rejouer = async () => {
    const texte = readFileSync('lib/db/migrations/0008_modeles_candidat_centroides.sql', 'utf8');
    for (const instruction of texte.split('--> statement-breakpoint')) await getDb().execute(sql.raw(instruction));
  };
  const quartier = async (ville: string, nom: string) => {
    const [q] = await getDb()
      .select({ latitude: schema.quartier.latitude, longitude: schema.quartier.longitude })
      .from(schema.quartier)
      .innerJoin(schema.ville, eq(schema.ville.id, schema.quartier.villeId))
      .where(and(eq(schema.ville.nom, ville), eq(schema.quartier.nom, nom)));
    return q!;
  };

  beforeAll(async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    // État de la production : quartiers créés sans coordonnées, modèles candidat absents.
    await getDb().update(schema.quartier).set({ latitude: null, longitude: null });
    await getDb().delete(schema.modeleMessage).where(sql`${schema.modeleMessage.texte} like '%{{candidat.%'`);
    await getDb().update(schema.quartier).set({ latitude: 4.1, longitude: 9.8 }).where(eq(schema.quartier.nom, 'Akwa'));
    await getDb().insert(schema.modeleMessage).values({ nom: 'Bienvenue candidat', texte: 'Texte modifié par la Direction {{candidat.prenom}}' });
    await rejouer();
  }, 120_000);

  it('remplit les quartiers sans coordonnées et laisse Kotto / PK12 à saisir', async () => {
    expect(await quartier('Douala', 'Bonapriso')).toEqual({ latitude: CENTROIDES_INITIAUX.Douala!.Bonapriso![0], longitude: CENTROIDES_INITIAUX.Douala!.Bonapriso![1] });
    expect(await quartier('Yaoundé', 'Bastos')).toEqual({ latitude: CENTROIDES_INITIAUX['Yaoundé']!.Bastos![0], longitude: CENTROIDES_INITIAUX['Yaoundé']!.Bastos![1] });
    expect(await quartier('Douala', 'Kotto')).toEqual({ latitude: null, longitude: null });
    const geolocalises = await getDb().select({ id: schema.quartier.id }).from(schema.quartier).where(isNotNull(schema.quartier.latitude));
    const attendus = Object.values(CENTROIDES_INITIAUX).reduce((n, qs) => n + Object.keys(qs).length, 0);
    expect(geolocalises).toHaveLength(attendus);
  });

  it('n’écrase ni une saisie du Référentiel ni un modèle déjà présent', async () => {
    expect(await quartier('Douala', 'Akwa')).toEqual({ latitude: 4.1, longitude: 9.8 });
    const modeles = await getDb().select().from(schema.modeleMessage).where(sql`${schema.modeleMessage.texte} like '%{{candidat.%'`);
    expect(modeles.map((m) => m.nom).sort()).toEqual(['Bienvenue candidat', 'Compléter votre profil', 'Lien de réinitialisation']);
    expect(modeles.find((m) => m.nom === 'Bienvenue candidat')!.texte).toBe('Texte modifié par la Direction {{candidat.prenom}}');
  });

  it('peut être rejouée sans effet', async () => {
    await rejouer();
    expect(await quartier('Douala', 'Akwa')).toEqual({ latitude: 4.1, longitude: 9.8 });
  });

  it('une nouvelle installation reçoit directement les centroïdes', async () => {
    await reinitialiserBase();
    await geo.initialiserReferentiel();
    expect(await quartier('Douala', 'Bonapriso')).toEqual({ latitude: CENTROIDES_INITIAUX.Douala!.Bonapriso![0], longitude: CENTROIDES_INITIAUX.Douala!.Bonapriso![1] });
  }, 120_000);
});
