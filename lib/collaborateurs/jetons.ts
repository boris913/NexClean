// Jetons aléatoires à usage unique : seule leur empreinte est stockée en base.
import { createHash, randomBytes } from 'node:crypto';

/** Jeton de 256 bits encodé en base64url. */
export function genererJeton(): string {
  return randomBytes(32).toString('base64url');
}

export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

export const DUREE_ACTIVATION_MS = 48 * 60 * 60 * 1000;
