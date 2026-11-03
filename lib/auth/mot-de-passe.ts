// Hachage des mots de passe en Argon2id (M1-AUT-01).
import { hash, verify } from '@node-rs/argon2';

// Paramètres recommandés OWASP pour Argon2id (m = 19 Mio, t = 2, p = 1).
// L'algorithme par défaut de @node-rs/argon2 est Argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const LONGUEUR_MIN_COLLABORATEUR = 10;

export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return hash(motDePasse, OPTIONS);
}

export async function verifierMotDePasse({ hash: empreinte, password }: { hash: string; password: string }): Promise<boolean> {
  try {
    return await verify(empreinte, password);
  } catch {
    return false;
  }
}
