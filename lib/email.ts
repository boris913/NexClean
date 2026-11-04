// Envoi d'e-mails transactionnels via Resend (ADR 0005).
import { env } from '@/lib/env';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Pièces jointes (ex. PDF du devis, MVP2-04 RG-10), envoyées en base64 à Resend. */
  pieces?: { nom: string; contenu: Uint8Array }[];
}

export const echapperHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Envoie un e-mail. Sans RESEND_API_KEY (développement), l'e-mail est affiché dans
 * la console au lieu d'être envoyé. 3 tentatives en cas d'erreur (M1-NOT RG-13).
 */
export async function envoyerEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, BACKOFFICE_FROM_EMAIL } = env();
  if (!RESEND_API_KEY) {
    const pieces = email.pieces?.length ? `\nPièces jointes : ${email.pieces.map((p) => `${p.nom} (${Math.ceil(p.contenu.byteLength / 1024)} Ko)`).join(', ')}` : '';
    console.info(`[email non envoyé — RESEND_API_KEY absente] À : ${email.to}\nObjet : ${email.subject}\n${email.text}${pieces}`);
    return;
  }
  const attachments = email.pieces?.map((p) => ({ filename: p.nom, content: Buffer.from(p.contenu).toString('base64') }));
  let derniereErreur: unknown;
  for (let tentative = 1; tentative <= 3; tentative++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: BACKOFFICE_FROM_EMAIL, to: [email.to], subject: email.subject, html: email.html, text: email.text, ...(attachments?.length ? { attachments } : {}) }),
      });
      if (res.ok) return;
      derniereErreur = new Error(`Resend ${res.status}: ${await res.text()}`);
    } catch (e) {
      derniereErreur = e;
    }
    await new Promise((r) => setTimeout(r, 500 * tentative));
  }
  throw derniereErreur;
}
