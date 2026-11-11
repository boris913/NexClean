// COM2-01 RG-01 : signature des webhooks Meta (HMAC-SHA256 du corps brut, secret de l'application).
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Vrai si l'en-tête `X-Hub-Signature-256` (« sha256=<hex> ») correspond au corps brut. */
export function signatureValide(corpsBrut: string, entete: string | null, secret: string): boolean {
  if (!entete?.startsWith('sha256=')) return false;
  const recue = Buffer.from(entete.slice(7), 'hex');
  const attendue = createHmac('sha256', secret).update(corpsBrut, 'utf8').digest();
  return recue.length === attendue.length && timingSafeEqual(recue, attendue);
}

export const signer = (corpsBrut: string, secret: string) => `sha256=${createHmac('sha256', secret).update(corpsBrut, 'utf8').digest('hex')}`;
