// Outils communs aux tests de bout en bout.
import { createHmac } from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const MOT_DE_PASSE = 'Mot-De-Passe-E2E-Solide-1';
export const NUMERO_DOSSIER = /[A-Z]{2,3}-\d{4}-\d{5}/;

/** Code TOTP courant (RFC 6238 : SHA-1, 6 chiffres, 30 s) pour un secret en base32. */
export function codeTotp(secret: string, instant = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const cle = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2)));
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(Math.floor(instant / 30_000)));
  const h = createHmac('sha1', cle).update(compteur).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/**
 * Contexte mobile isolé (375 px), comme le projet « mobile-375 ». Seule l'application testée est
 * joignable : les services tiers sont coupés, et WhatsApp est remplacé par une page vide.
 */
export async function contexteMobile(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  });
  const origine = new URL(baseURL ?? 'http://localhost:3000').origin;
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origine) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (/wa\.me|whatsapp\.com/.test(url)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' });
    return route.abort();
  });
  return ctx;
}

/** Aucune largeur cachée : pas de défilement horizontal sur mobile. */
export async function sansDefilementHorizontal(page: Page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(deborde, `défilement horizontal sur ${page.url()}`).toBe(false);
}

export function lienActivation(): string {
  const lien = process.env.E2E_LIEN_ACTIVATION;
  if (!lien) throw new Error('E2E_LIEN_ACTIVATION manquant : lancez initialiser.cjs et passez le lien affiché.');
  return lien;
}
