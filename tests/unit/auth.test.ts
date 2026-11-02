// M1-AUT-01 (hachage), M1-AUT-06 (verrouillage), M1-AUT-03 (jetons d'activation).
import { describe, expect, it } from 'vitest';
import { hacherMotDePasse, verifierMotDePasse } from '@/lib/auth/mot-de-passe';
import { doitBloquer, MAX_ECHECS } from '@/lib/auth/verrouillage';
import { empreinteJeton, genererJeton } from '@/lib/collaborateurs/jetons';

describe('Mot de passe Argon2id (M1-AUT-01)', () => {
  it('produit une empreinte Argon2id vérifiable', async () => {
    const h = await hacherMotDePasse('MotDePasse-Solide-2026');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifierMotDePasse({ hash: h, password: 'MotDePasse-Solide-2026' })).toBe(true);
    expect(await verifierMotDePasse({ hash: h, password: 'mauvais' })).toBe(false);
  });

  it('renvoie faux (sans lever) pour une empreinte invalide', async () => {
    expect(await verifierMotDePasse({ hash: 'pas-une-empreinte', password: 'x' })).toBe(false);
  });
});

describe('Verrouillage (M1-AUT-06)', () => {
  it(`bloque à partir de ${MAX_ECHECS} échecs pour le compte`, () => {
    expect(doitBloquer(4, 0)).toBe(false);
    expect(doitBloquer(5, 0)).toBe(true);
  });
  it(`bloque à partir de ${MAX_ECHECS} échecs pour l'IP`, () => {
    expect(doitBloquer(0, 4)).toBe(false);
    expect(doitBloquer(0, 5)).toBe(true);
  });
});

describe("Jetons d'activation (M1-AUT-03)", () => {
  it('sont aléatoires (256 bits) et seule une empreinte SHA-256 est stockée', () => {
    const a = genererJeton();
    const b = genererJeton();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(empreinteJeton(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteJeton(a)).toBe(empreinteJeton(a));
    expect(empreinteJeton(a)).not.toContain(a);
  });
});
