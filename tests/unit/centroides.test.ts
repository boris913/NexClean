// Migration 0008 : les modèles WhatsApp candidat et les centroïdes des quartiers doivent rester
// identiques aux constantes du code (MODELES_CANDIDAT_PAR_DEFAUT, CENTROIDES_INITIAUX).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CENTROIDES_INITIAUX, VILLES_INITIALES } from '@/lib/geo/donnees-initiales';
import { distanceKm } from '@/lib/candidats/recherche';

vi.mock('@/lib/db', () => ({ getDb: () => ({}), schema: {} }));

const migration = readFileSync('lib/db/migrations/0008_modeles_candidat_centroides.sql', 'utf8');
const point = ([latitude, longitude]: [number, number]) => ({ latitude, longitude });
const sqlTexte = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Centres approximatifs, pour écarter une erreur grossière de géocodage. */
const CENTRES: Record<string, [number, number]> = { Douala: [4.05, 9.7], Yaoundé: [3.866, 11.516] };
const RAYON_MAX_KM: Record<string, number> = { Douala: 25, Yaoundé: 15 };

describe('Migration 0008 — modèles WhatsApp candidat', () => {
  it('insère chaque modèle par défaut avec le texte exact du code, sans écraser l’existant', async () => {
    const { MODELES_CANDIDAT_PAR_DEFAUT } = await import('@/lib/candidats/fiche');
    expect(MODELES_CANDIDAT_PAR_DEFAUT).toHaveLength(3);
    for (const m of MODELES_CANDIDAT_PAR_DEFAUT) expect(migration).toContain(`(${sqlTexte(m.nom)}, '{}', ${sqlTexte(m.texte)})`);
    expect(migration).toContain('ON CONFLICT ("nom") DO NOTHING');
  });
});

describe('Centroïdes des quartiers', () => {
  const entrees = Object.entries(CENTROIDES_INITIAUX).flatMap(([ville, qs]) => Object.entries(qs).map(([nom, coord]) => ({ ville, nom, coord })));

  it('ne concernent que des quartiers du référentiel initial', () => {
    for (const { ville, nom } of entrees) {
      const v = VILLES_INITIALES.find((x) => x.nom === ville);
      expect(v, ville).toBeDefined();
      expect(Object.values(v!.arrondissements).flat(), `${ville} / ${nom}`).toContain(nom);
    }
  });

  it('sont plausibles (dans un rayon raisonnable autour du centre de la ville)', () => {
    for (const { ville, nom, coord } of entrees) expect(distanceKm(point(coord), point(CENTRES[ville]!)), `${ville} / ${nom}`).toBeLessThan(RAYON_MAX_KM[ville]!);
  });

  it('sont repris à l’identique par la migration, sans écraser une saisie du Référentiel', () => {
    for (const { ville, nom, coord } of entrees) expect(migration).toContain(`(${sqlTexte(ville)}, ${sqlTexte(nom)}, ${coord[0].toFixed(5)}, ${coord[1].toFixed(5)})`);
    const lignes = migration.match(/^\('[^']+', '[^']+', -?[0-9.]+, -?[0-9.]+\),?$/gm) ?? [];
    expect(lignes).toHaveLength(entrees.length);
    expect(migration).toContain('q."latitude" IS NULL AND q."longitude" IS NULL');
  });
});
