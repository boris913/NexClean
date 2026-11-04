// MVP2-04 RG-09 : consolidation du devis accepté et de ses avenants (lignes facturables).
import { describe, expect, it } from 'vitest';
import { consoliderLignes } from '@/lib/devis/lignes';

const l = (lignePosteId: number | null, intitule: string, nombre: number, commission = 5000) => ({ lignePosteId, intitule, nombre, commission });

describe('consoliderLignes (RG-09)', () => {
  it('additionne les écarts des avenants par ligne de poste et commission figée', () => {
    const devis = [l(1, 'Serveur', 10), l(2, 'Cuisinier', 2)];
    const avenant1 = [l(1, 'Serveur', 2)];
    const avenant2 = [l(2, 'Cuisinier', -1), l(3, 'Plongeur', 1, 6000)];
    expect(consoliderLignes([devis, avenant1, avenant2])).toEqual([
      { lignePosteId: 1, intitule: 'Serveur', commission: 5000, nombre: 12 },
      { lignePosteId: 2, intitule: 'Cuisinier', commission: 5000, nombre: 1 },
      { lignePosteId: 3, intitule: 'Plongeur', commission: 6000, nombre: 1 },
    ]);
  });

  it('ne descend jamais sous zéro ; lignes sans ligne de poste regroupées par intitulé', () => {
    expect(consoliderLignes([[l(1, 'Serveur', 1)], [l(1, 'Serveur', -3)]])).toEqual([{ lignePosteId: 1, intitule: 'Serveur', commission: 5000, nombre: 0 }]);
    expect(consoliderLignes([[l(null, 'Chauffeur', 1)], [l(null, 'Chauffeur', 1), l(null, 'Gardien', 1)]])).toEqual([
      { lignePosteId: null, intitule: 'Chauffeur', commission: 5000, nombre: 2 },
      { lignePosteId: null, intitule: 'Gardien', commission: 5000, nombre: 1 },
    ]);
  });
});
