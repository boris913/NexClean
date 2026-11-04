// Jetons des liens d'accès temporaires aux profils et attestations (specs/MVP2-03 RG-10, RG-15).
// Seule l'empreinte SHA-256 est stockée (table acces_profil) ; le jeton clair n'apparaît que
// dans le lien envoyé au client.
import { createHash, randomBytes } from 'node:crypto';

/** 256 bits, base64url (43 caractères). */
export const genererJetonAcces = () => randomBytes(32).toString('base64url');
export const empreinteJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
export const jetonAccesValide = (jeton: string) => /^[A-Za-z0-9_-]{43}$/.test(jeton);

/** Chemin public d'un lien d'accès (page servie par app/(site)/profil/[jeton]). */
export const cheminAcces = (jeton: string) => `/profil/${jeton}`;
